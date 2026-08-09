import { Renderer } from './Renderer';
import type { FrameData } from '../types';
import analyzeWGSL from '../shaders/analyze.wgsl?raw';
import renderWGSL from '../shaders/render.wgsl?raw';

export class WebGPURenderer extends Renderer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;
  
  private analyzePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;
  
  private uniformsBuffer!: GPUBuffer;
  private cellDataBuffer!: GPUBuffer;
  private atlasTexture!: GPUTexture;
  private atlasSampler!: GPUSampler;
  private videoSampler!: GPUSampler;
  
  private renderBindGroup!: GPUBindGroup;
  
  private gridSize = { width: 0, height: 0 };
  private instanceCount = 0;
  private debugView: number = 6;
  public setDebugView(v: number) { this.debugView = v; }

  public async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported on this browser.");
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No appropriate GPUAdapter found.");
    
    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this.setupPipelines();
    this.setupStaticResources();
    this.isInitialized = true;
  }

  private setupPipelines() {
    let finalAnalyzeWGSL = analyzeWGSL;
    if (this.atlas && this.atlas.plugin && this.atlas.plugin.getComputeShaderSnippet) {
      finalAnalyzeWGSL += '\n' + this.atlas.plugin.getComputeShaderSnippet();
    } else {
      finalAnalyzeWGSL += `\nfn getGlyphIndex(brightness: f32, magnitude: f32, gx: f32, gy: f32, cols: f32, rows: f32) -> f32 { return 0.0; }`;
    }

    const analyzeModule = this.device.createShaderModule({
      label: 'Analyze Compute Shader',
      code: finalAnalyzeWGSL
    });

    this.analyzePipeline = this.device.createComputePipeline({
      label: 'Analyze Pipeline',
      layout: 'auto',
      compute: {
        module: analyzeModule,
        entryPoint: 'main',
      },
    });

    if (!this.renderPipeline) {
      const renderModule = this.device.createShaderModule({
        label: 'Render Shaders',
        code: renderWGSL
      });

      this.renderPipeline = this.device.createRenderPipeline({
        label: 'Instanced Glyph Render Pipeline',
        layout: 'auto',
        vertex: {
          module: renderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: renderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
    }
  }

  private setupStaticResources() {
    this.videoSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
    
    this.atlasSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
    });
    
    // Uniform buffer - 16 floats = 64 bytes
    this.uniformsBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  protected onAtlasChanged(): void {
    if (!this.atlas) return;
    
    const { columns, rows } = this.atlas.plugin.getAtlasSize();
    
    // Create texture from atlas canvas
    const imgBitmap = this.atlas.canvas; // We can copy directly from canvas element in WebGPU
    
    this.atlasTexture = this.device.createTexture({
      size: [imgBitmap.width, imgBitmap.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    this.device.queue.copyExternalImageToTexture(
      { source: imgBitmap },
      { texture: this.atlasTexture },
      [imgBitmap.width, imgBitmap.height]
    );

    // Update atlasGrid in uniforms (offset 24 bytes = 6 floats)
    const uniformsData = new Float32Array([columns, rows]);
    this.device.queue.writeBuffer(this.uniformsBuffer, 24, uniformsData);
    
    // Recompile compute shader with new plugin snippet
    this.setupPipelines();
    
    this.updateRenderBindGroup();
  }

  protected onQualityChanged(): void {
    // Will be handled during next frame render (re-allocating buffers if size changed)
  }

  private updateRenderBindGroup() {
    if (!this.atlasTexture || !this.cellDataBuffer) return;
    
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformsBuffer } },
        { binding: 1, resource: { buffer: this.cellDataBuffer } },
        { binding: 2, resource: this.atlasSampler },
        { binding: 3, resource: this.atlasTexture.createView() },
      ]
    });
  }

  public renderFrame(frame: FrameData): void {
    if (!this.isInitialized || !this.atlas) return;
    
    const cellSize = this.getCellSize();
    const newGridWidth = Math.ceil(frame.width / cellSize);
    const newGridHeight = Math.ceil(frame.height / cellSize);
    
    // Resize buffers if grid changed
    if (this.gridSize.width !== newGridWidth || this.gridSize.height !== newGridHeight) {
      this.gridSize = { width: newGridWidth, height: newGridHeight };
      this.instanceCount = newGridWidth * newGridHeight;
      
      // vec4<f32> for color, vec4<f32> for state = 32 bytes
      this.cellDataBuffer = this.device.createBuffer({
        size: this.instanceCount * 32,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      
      this.updateRenderBindGroup();
    }
    
    // Update uniforms
    const uniformsData = new Float32Array([
      frame.width, frame.height,
      this.gridSize.width, this.gridSize.height,
      cellSize,
      performance.now() / 1000.0 // time
    ]);
    this.device.queue.writeBuffer(this.uniformsBuffer, 0, uniformsData);
    this.device.queue.writeBuffer(this.uniformsBuffer, 32, new Float32Array([this.debugView]));
    
    // Create external texture for video frame
    const externalTexture = this.device.importExternalTexture({
      source: frame.videoFrame as HTMLVideoElement, // VideoFrame is supported too
    });
    
    // Create analyze bind group
    const analyzeBindGroup = this.device.createBindGroup({
      layout: this.analyzePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.videoSampler },
        { binding: 1, resource: externalTexture },
        { binding: 2, resource: { buffer: this.cellDataBuffer } },
        { binding: 3, resource: { buffer: this.uniformsBuffer } }
      ]
    });
    
    const commandEncoder = this.device.createCommandEncoder();
    
    // 1. Analyze Pass (Compute)
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.analyzePipeline);
    computePass.setBindGroup(0, analyzeBindGroup);
    // Workgroup size is 16x16
    const workgroupCountX = Math.ceil(this.gridSize.width / 16);
    const workgroupCountY = Math.ceil(this.gridSize.height / 16);
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    computePass.end();
    
    // 2. Render Pass (Graphics)
    if (this.renderBindGroup) {
      const textureView = this.context.getCurrentTexture().createView();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      
      renderPass.setPipeline(this.renderPipeline);
      renderPass.setBindGroup(0, this.renderBindGroup);
      renderPass.draw(6, this.instanceCount, 0, 0); // 6 vertices for quad, N instances
      renderPass.end();
    }
    
    this.device.queue.submit([commandEncoder.finish()]);
  }

  public getResolution(): { width: number; height: number } {
    return this.gridSize;
  }

  public getInstanceCount(): number {
    return this.instanceCount;
  }

  public async readCellData(): Promise<Float32Array> {
    if (!this.cellDataBuffer) return new Float32Array();
    const size = Math.min(32 * 10, this.cellDataBuffer.size);
    const stagingBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(this.cellDataBuffer, 0, stagingBuffer, 0, size);
    this.device.queue.submit([commandEncoder.finish()]);
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const copyArray = new Float32Array(stagingBuffer.getMappedRange().slice(0));
    stagingBuffer.unmap();
    return copyArray;
  }

  public dispose(): void {
    // Destroy buffers and textures
  }
}
