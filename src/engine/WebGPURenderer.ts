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
  private atlasTexture: GPUTexture | null = null;

  private source: VideoSource | null = null;
  private atlas: GlyphAtlas | null = null;
  private settings: RenderSettings = { 
    density: 8, 
    colorMode: 0, 
    renderMode: 0,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    quality: 1
  };
  
  private gridSize = { w: 0, h: 0 };
  private instanceCount = 0;

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
  }

  public render(): void {
    if (!this.device || !this.context || !this.source || !this.atlasTexture) return;
    if (!this.source.isReady || !this.source.isPlaying || this.source.width === 0) return;

    try {
      const gridW = Math.ceil(this.source.width / this.settings.density);
      const gridH = Math.ceil(this.source.height / this.settings.density);

      if (this.gridSize.w !== gridW || this.gridSize.h !== gridH) {
        this.gridSize = { w: gridW, h: gridH };
        this.instanceCount = gridW * gridH;
        
        if (this.cellDataBuffer) this.cellDataBuffer.destroy();
        this.cellDataBuffer = this.device.createBuffer({
          size: this.instanceCount * 32, // 2 x vec4<f32> = 32 bytes
          usage: GPUBufferUsage.STORAGE,
        });
      }

      // 64 bytes (16 x 4)
      this.device.queue.writeBuffer(this.uniformsBuffer!, 0, new Float32Array([
        this.source.width, this.source.height,
        gridW, gridH,
        this.settings.density,
        performance.now() / 1000,
        this.atlas!.cols, this.atlas!.rows,
        
        // Use Float32Array but the shader reads them as u32/f32 correctly based on layout
        // JavaScript bitwise trick to cast float bits to uint bits is not needed 
        // if we just pass small integers that fit exactly in f32 without losing precision,
        // WebGPU will read the f32 bits. WAIT: `u32` in WGSL expects integer bits.
        // We must pass an ArrayBuffer and use a DataView to write properly, or use mixed arrays.
      ]));
      
      const uniformData = new ArrayBuffer(64);
      const view = new DataView(uniformData);
      
      view.setFloat32(0, this.source.width, true);
      view.setFloat32(4, this.source.height, true);
      view.setFloat32(8, gridW, true);
      view.setFloat32(12, gridH, true);
      
      view.setFloat32(16, this.settings.density, true);
      view.setFloat32(20, performance.now() / 1000, true);
      view.setFloat32(24, this.atlas!.cols, true);
      view.setFloat32(28, this.atlas!.rows, true);
      
      view.setUint32(32, this.settings.colorMode, true);
      view.setUint32(36, this.settings.renderMode, true);
      view.setUint32(40, this.settings.quality, true);
      view.setFloat32(44, this.settings.brightness, true);
      
      view.setFloat32(48, this.settings.contrast, true);
      view.setFloat32(52, this.settings.saturation, true);
      view.setFloat32(56, 0, true); // padding
      view.setFloat32(60, 0, true); // padding

      this.device.queue.writeBuffer(this.uniformsBuffer!, 0, uniformData);

      let externalTexture: GPUExternalTexture;
      try {
        externalTexture = this.device.importExternalTexture({ source: this.source.element });
      } catch (e) {
        // Video frame not fully ready, skip frame
        return;
      }

      const commandEncoder = this.device.createCommandEncoder();

      // Compute pass
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

      // Render pass
      const glyphBindGroup = this.device.createBindGroup({
        layout: this.glyphPipeline!.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniformsBuffer! } },
          { binding: 1, resource: { buffer: this.cellDataBuffer! } },
          { binding: 2, resource: this.atlasSampler! },
          { binding: 3, resource: this.atlasTexture.createView() },
        ],
      });
      const textureView = this.context.getCurrentTexture().createView();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear', storeOp: 'store',
        }],
      });
      renderPass.setPipeline(this.glyphPipeline!);
      renderPass.setBindGroup(0, glyphBindGroup);
      renderPass.draw(6, this.instanceCount);
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);

    } catch (err) {
      console.error('[WebGPURenderer] Render error:', err);
    }
  }

  public destroy(): void {
    if (this.uniformsBuffer) this.uniformsBuffer.destroy();
    if (this.cellDataBuffer) this.cellDataBuffer.destroy();
    if (this.atlasTexture) this.atlasTexture.destroy();
    this.device = null;
    this.context = null;
  }
}
