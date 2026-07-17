import type { Renderer, RenderSettings } from './Renderer';
import { WebGPURenderer } from './WebGPURenderer';
import { WebGL2Renderer } from './WebGL2Renderer';
import { VideoSource } from './VideoSource';
import { GlyphAtlas } from './GlyphAtlas';
import { GefFormat } from './GefFormat';
import type { GefManifest } from './GefFormat';

export class GlyphEngine {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private source: VideoSource;
  private atlas: GlyphAtlas;
  private rafId: number = 0;
  private _isRendering = false;
  
  // GEF Playback State
  private gefFrames: Uint8Array[] = [];
  private gefManifest: GefManifest | null = null;
  private gefCurrentFrame = 0;
  private gefStartTime = 0;

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
  
  public getRenderer(): Renderer {
    return this.renderer;
  }

  public async loadVideo(file: File): Promise<void> {
    (this.renderer as any).isGefMode = false;
    this.gefFrames = [];
    this.gefManifest = null;
    await this.source.load(file);
    if (!this._isRendering) {
      this.play();
    }
  }

  public play(): void {
    if (this.gefManifest) {
      this.gefStartTime = performance.now() - (this.gefCurrentFrame / this.gefManifest.fps) * 1000;
      this._isRendering = true;
      this.renderLoop();
    } else {
      this.source.play();
      if (!this._isRendering) {
        this._isRendering = true;
        this.renderLoop();
      }
    }
  }

  public pause(): void {
    if (!this.gefManifest) this.source.pause();
    this._isRendering = false;
    cancelAnimationFrame(this.rafId);
  }
  
  public get isPlaying(): boolean {
    if (this.gefManifest) return this._isRendering;
    return this.source.isPlaying;
  }
  
  public get videoElement(): HTMLVideoElement {
    return this.source.element;
  }

  public get instanceCount(): number {
    // If renderer exposes it, return it.
    // The renderer uses instanceCount = gridW * gridH. We need to expose it from WebGPURenderer
    // For now, I will just calculate it based on current density if renderer doesn't expose it.
    // Actually, I'll add the getter to Renderer interface and WebGPURenderer.
    return (this.renderer as any).instanceCount || 0;
  }

  // Playback & Audio APIs
  public get duration(): number { return this.source.duration; }
  public get currentTime(): number { return this.source.currentTime; }
  public set currentTime(time: number) { this.source.currentTime = time; }
  public get volume(): number { return this.source.volume; }
  public set volume(v: number) { this.source.volume = v; }
  public get muted(): boolean { return this.source.muted; }
  public set muted(m: boolean) { this.source.muted = m; }
  public get playbackRate(): number { return this.source.playbackRate; }
  public set playbackRate(r: number) { this.source.playbackRate = r; }

  public updateSettings(settings: Partial<RenderSettings>): void {
    this.renderer.updateSettings(settings);
  }

  public async setAtlas(atlas: GlyphAtlas): Promise<void> {
    this.atlas = atlas;
    await this.renderer.setAtlas(atlas);
  }

  public async exportGef(): Promise<Blob> {
    if (!(this.renderer instanceof WebGPURenderer)) throw new Error('Export only supported in WebGPU');
    if (!this.source.isReady) throw new Error('No video loaded');

    this.pause();
    
    const seekVideo = (time: number): Promise<void> => {
      return new Promise((resolve) => {
        if (Math.abs(this.source.element.currentTime - time) < 0.001) {
          resolve();
          return;
        }
        const onSeeked = () => {
          this.source.element.removeEventListener('seeked', onSeeked);
          resolve();
        };
        this.source.element.addEventListener('seeked', onSeeked);
        this.source.currentTime = time;
      });
    };
    
    const fps = 30; // Standard assumption
    const totalFrames = Math.floor(this.source.duration * fps);
    const frames: Uint8Array[] = [];
    
    for (let i = 0; i < totalFrames; i++) {
      await seekVideo(i / fps);
      const rawData = await this.renderer.extractCurrentFrame();
      frames.push(GefFormat.packFrame(rawData));
    }
    
    const manifest: GefManifest = {
      formatVersion: 1,
      engineVersion: "0.1.0",
      fps,
      resolution: { width: this.source.width, height: this.source.height },
      frameCount: totalFrames,
      settings: this.renderer.getSettings(),
      createdAt: new Date().toISOString()
    };
    
    const blob = await GefFormat.createGef(manifest, frames, null);
    
    // Resume playback after export
    this.play();
    
    return blob;
  }

  public async loadGef(file: File): Promise<void> {
    this.pause();
    (this.renderer as any).isGefMode = true;
    
    const parsed = await GefFormat.parseGef(file);
    this.gefManifest = parsed.manifest;
    this.gefFrames = parsed.frames;
    this.gefCurrentFrame = 0;
    
    // Apply settings
    this.updateSettings(this.gefManifest.settings);
    
    // Fake the source dimensions for the renderer to size its grid correctly
    (this.source as any)._width = this.gefManifest.resolution.width;
    (this.source as any)._height = this.gefManifest.resolution.height;
    (this.source as any)._isReady = true;
    (this.source as any)._isPlaying = true;
    
    this.play();
  }

  private renderLoop = () => {
    if (!this._isRendering) return;
    
    if (this.gefManifest) {
      const now = performance.now();
      const elapsed = (now - this.gefStartTime) / 1000;
      this.gefCurrentFrame = Math.floor(elapsed * this.gefManifest.fps) % this.gefManifest.frameCount;
      
      const packedFrame = this.gefFrames[this.gefCurrentFrame];
      if (packedFrame && this.renderer instanceof WebGPURenderer) {
        const unpacked = GefFormat.unpackFrame(packedFrame);
        this.renderer.setFrameData(unpacked);
        this.renderer.render();
      }
    } else {
      this.renderer.render();
    }
    
    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  public destroy(): void {
    this.pause();
    this.source.destroy();
    this.renderer.destroy();
  }
}
