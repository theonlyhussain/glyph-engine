import type { Renderer, RenderSettings } from './Renderer';
import { WebGPURenderer } from './WebGPURenderer';
import { WebGL2Renderer } from './WebGL2Renderer';
import { VideoSource } from './VideoSource';
import { GlyphAtlas } from './GlyphAtlas';

export class GlyphEngine {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private source: VideoSource;
  private atlas: GlyphAtlas;
  private rafId: number = 0;
  private _isRendering = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.source = new VideoSource();
    this.atlas = new GlyphAtlas();
    
    // Attempt WebGPU, fallback to WebGL2
    if (navigator.gpu) {
      this.renderer = new WebGPURenderer();
    } else {
      this.renderer = new WebGL2Renderer();
    }
  }

  public async init(): Promise<void> {
    await this.renderer.init(this.canvas);
    await this.renderer.setAtlas(this.atlas);
    this.renderer.setSource(this.source);
  }

  public async loadVideo(file: File): Promise<void> {
    await this.source.load(file);
    if (!this._isRendering) {
      this.play();
    }
  }

  public play(): void {
    this.source.play();
    if (!this._isRendering) {
      this._isRendering = true;
      this.renderLoop();
    }
  }

  public pause(): void {
    this.source.pause();
    this._isRendering = false;
    cancelAnimationFrame(this.rafId);
  }
  
  public get isPlaying(): boolean {
    return this.source.isPlaying;
  }
  
  public get videoElement(): HTMLVideoElement {
    return this.source.element;
  }

  public updateSettings(settings: Partial<RenderSettings>): void {
    this.renderer.updateSettings(settings);
  }

  public async setAtlas(atlas: GlyphAtlas): Promise<void> {
    this.atlas = atlas;
    await this.renderer.setAtlas(atlas);
  }

  private renderLoop = () => {
    if (!this._isRendering) return;
    this.renderer.render();
    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  public destroy(): void {
    this.pause();
    this.source.destroy();
    this.renderer.destroy();
  }
}
