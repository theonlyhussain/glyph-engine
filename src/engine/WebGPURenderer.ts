import type { Renderer, RenderSettings } from './Renderer';
import { VideoSource } from './VideoSource';
import { GlyphAtlas } from './GlyphAtlas';
import analyzeShaderCode from './shaders/analyze.wgsl?raw';
import renderShaderCode from './shaders/render.wgsl?raw';

export class WebGPURenderer implements Renderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private analyzePipeline: GPUComputePipeline | null = null;
  private glyphPipeline: GPURenderPipeline | null = null;
  private sampler: GPUSampler | null = null;
  private atlasSampler: GPUSampler | null = null;
  private uniformsBuffer: GPUBuffer | null = null;
  private cellDataBuffer: GPUBuffer | null = null;
  private stagingBuffer: GPUBuffer | null = null;
  private atlasTexture: GPUTexture | null = null;

  private source: VideoSource | null = null;
  private atlas: GlyphAtlas | null = null;
  private settings: RenderSettings = { 
    density: 2, 
    colorMode: 0, 
    renderMode: 0,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    quality: 1
  };
  public getSettings(): RenderSettings { return this.settings; }
  
  private gridSize = { w: 0, h: 0 };
  public instanceCount = 0;
  public isPxlMode = false;
  public pxlDimensions = { width: 0, height: 0 };

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No appropriate GPUAdapter found');
    this.device = await adapter.requestDevice();
    this.context = canvas.getContext('webgpu') as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });

    // Compute Pipeline
    const analyzeModule = this.device.createShaderModule({ code: analyzeShaderCode });
    this.analyzePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: analyzeModule, entryPoint: 'main' },
    });

    // Render Pipeline
    const glyphModule = this.device.createShaderModule({ code: renderShaderCode });
    this.glyphPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: glyphModule, entryPoint: 'vs_main' },
      fragment: {
        module: glyphModule, entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    this.atlasSampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    // Uniforms: 64 bytes (16 floats) to hold new adjustments
    // vec2 sourceSize, vec2 gridSize (16)
    // float cellSize, float time, float atlasCols, float atlasRows (16)
    // u32 colorMode, u32 renderMode, u32 quality, float brightness (16)
    // float contrast, float saturation, vec2 padding (16)
    this.uniformsBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  public updateSettings(settings: Partial<RenderSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  public setSource(source: VideoSource): void {
    this.source = source;
    // Force grid recalculation on new source
    this.gridSize = { w: 0, h: 0 };
  }

  public async setAtlas(atlas: GlyphAtlas): Promise<void> {
    this.atlas = atlas;
    if (!this.device) return;

    if (this.atlasTexture) {
      this.atlasTexture.destroy();
    }

    const bitmap = await createImageBitmap(atlas.canvas);
    this.atlasTexture = this.device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: bitmap }, { texture: this.atlasTexture },
      [bitmap.width, bitmap.height]
    );
    
    // Invalidate cached bind group since atlas texture changed
    this.cachedRenderBindGroup = null;
  }

  // Pre-allocated uniform data buffer (avoids GC pressure from allocating every frame)
  private uniformData = new ArrayBuffer(64);
  private uniformView = new DataView(this.uniformData);
  
  // Cached bind group for the render pass (recreated only on grid resize)
  private cachedRenderBindGroup: GPUBindGroup | null = null;
  private cachedAtlasView: GPUTextureView | null = null;

  public render(): void {
    if (!this.device || !this.context || !this.source || !this.atlasTexture) return;
    
    const w = this.isPxlMode ? this.pxlDimensions.width : this.source.width;
    const h = this.isPxlMode ? this.pxlDimensions.height : this.source.height;
    const ready = this.isPxlMode ? true : this.source.isReady;
    
    if (!ready || w === 0) return;

    try {
      const gridW = Math.ceil(w / this.settings.density);
      const gridH = Math.ceil(h / this.settings.density);

      if (this.gridSize.w !== gridW || this.gridSize.h !== gridH) {
        this.gridSize = { w: gridW, h: gridH };
        this.instanceCount = gridW * gridH;
        
        if (this.cellDataBuffer) this.cellDataBuffer.destroy();
        this.cellDataBuffer = this.device.createBuffer({
          size: this.instanceCount * 32,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        
        if (this.stagingBuffer) this.stagingBuffer.destroy();
        this.stagingBuffer = this.device.createBuffer({
          size: this.instanceCount * 32,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        
        // Invalidate cached bind group
        this.cachedRenderBindGroup = null;
      }
      
      // Build render bind group once per grid resize (not every frame)
      if (!this.cachedRenderBindGroup) {
        this.cachedAtlasView = this.atlasTexture.createView();
        this.cachedRenderBindGroup = this.device.createBindGroup({
          layout: this.glyphPipeline!.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniformsBuffer! } },
            { binding: 1, resource: { buffer: this.cellDataBuffer! } },
            { binding: 2, resource: this.atlasSampler! },
            { binding: 3, resource: this.cachedAtlasView },
          ],
        });
      }

      // Write uniforms ONCE per frame (was being written twice before!)
      const v = this.uniformView;
      v.setFloat32(0, w, true);
      v.setFloat32(4, h, true);
      v.setFloat32(8, gridW, true);
      v.setFloat32(12, gridH, true);
      v.setFloat32(16, this.settings.density, true);
      v.setFloat32(20, performance.now() / 1000, true);
      v.setFloat32(24, this.atlas!.cols, true);
      v.setFloat32(28, this.atlas!.rows, true);
      v.setUint32(32, this.settings.colorMode, true);
      v.setUint32(36, this.settings.renderMode, true);
      v.setUint32(40, this.settings.quality, true);
      v.setFloat32(44, this.settings.brightness, true);
      v.setFloat32(48, this.settings.contrast, true);
      v.setFloat32(52, this.settings.saturation, true);
      v.setFloat32(56, 0, true);
      v.setFloat32(60, 0, true);
      this.device.queue.writeBuffer(this.uniformsBuffer!, 0, this.uniformData);

      let externalTexture: GPUExternalTexture | null = null;
      if (!this.isPxlMode) {
        try {
          externalTexture = this.device.importExternalTexture({ source: this.source.element });
        } catch (e) {
          return; // Video frame not ready, skip
        }
      }

      const commandEncoder = this.device.createCommandEncoder();

      // Compute pass (analyze video frame into cell data)
      if (!this.isPxlMode && externalTexture) {
        const analyzeBindGroup = this.device.createBindGroup({
          layout: this.analyzePipeline!.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: this.sampler! },
            { binding: 1, resource: externalTexture },
            { binding: 2, resource: { buffer: this.cellDataBuffer! } },
            { binding: 3, resource: { buffer: this.uniformsBuffer! } },
          ],
        });
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.analyzePipeline!);
        computePass.setBindGroup(0, analyzeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(gridW / 16), Math.ceil(gridH / 16));
        computePass.end();
      }

      // Render pass (draw glyphs)
      const textureView = this.context.getCurrentTexture().createView();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      renderPass.setPipeline(this.glyphPipeline!);
      renderPass.setBindGroup(0, this.cachedRenderBindGroup!);
      renderPass.draw(6, this.instanceCount);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);

    } catch (err) {
      console.error('[WebGPURenderer] Render error:', err);
    }
  }
  
  public setFrameData(data: Float32Array): void {
    if (!this.device || !this.cellDataBuffer) return;
    this.device.queue.writeBuffer(this.cellDataBuffer, 0, data);
  }

  public async extractCurrentFrame(): Promise<Float32Array> {
    if (!this.device || !this.cellDataBuffer || !this.stagingBuffer) {
      throw new Error("Renderer not initialized");
    }
    
    // Perform a forced render pass cycle to populate cellDataBuffer
    this.render();
    
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      this.cellDataBuffer, 0, 
      this.stagingBuffer, 0, 
      this.instanceCount * 32
    );
    this.device.queue.submit([commandEncoder.finish()]);
    
    // Wait for the copy to finish
    await this.device.queue.onSubmittedWorkDone();
    
    // Map the staging buffer
    await this.stagingBuffer.mapAsync(GPUMapMode.READ);
    
    // Create a copy of the array so we can unmap the buffer
    const copy = new Float32Array(this.stagingBuffer.getMappedRange()).slice();
    this.stagingBuffer.unmap();
    
    return copy;
  }

  public destroy(): void {
    if (this.uniformsBuffer) this.uniformsBuffer.destroy();
    if (this.cellDataBuffer) this.cellDataBuffer.destroy();
    if (this.atlasTexture) this.atlasTexture.destroy();
    this.device = null;
    this.context = null;
  }
}
