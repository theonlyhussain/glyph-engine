import type { Renderer, RenderSettings } from './Renderer';
import { WebGPURenderer } from './WebGPURenderer';
import { WebGL2Renderer } from './WebGL2Renderer';
import { VideoSource } from './VideoSource';
import { GlyphAtlas } from './GlyphAtlas';
import { PxlFormat } from './PxlFormat';
import type { PxlManifest } from './PxlFormat';
import { WavEncoder } from './WavEncoder';
import { AutoCalibrator } from './AutoCalibrator';
import type { CalibrationResult } from './AutoCalibrator';

export class GlyphEngine {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private source: VideoSource;
  private atlas: GlyphAtlas;
  private rafId: number = 0;
  private _isRendering = false;
  
  // PXL Playback State
  private pxlFrames: Uint8Array[] = [];
  private pxlManifest: PxlManifest | null = null;
  private pxlCurrentFrame = 0;
  private pxlStartTime = 0;
  private pxlAudioElement: HTMLAudioElement | null = null;
  
  public exportProgress: number = 0;
  public lastCalibration: CalibrationResult | null = null;

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
    (this.renderer as any).isPxlMode = false;
    this.pxlFrames = [];
    this.pxlManifest = null;
    this.cleanupPxlAudio();
    await this.source.load(file);
    
    // Auto-calibrate: analyze the video and apply optimal settings
    try {
      const cal = await AutoCalibrator.calibrate(this.source.element);
      this.lastCalibration = cal;
      this.updateSettings(cal);
    } catch (err) {
      console.warn('Auto-calibration failed, using defaults:', err);
    }
    
    if (!this._isRendering) {
      this.play();
    }
  }

  private cleanupPxlAudio(): void {
    if (this.pxlAudioElement) {
      this.pxlAudioElement.pause();
      this.pxlAudioElement.removeAttribute('src');
      this.pxlAudioElement = null;
    }
  }

  public play(): void {
    if (this.pxlManifest) {
      this.pxlStartTime = performance.now() - (this.pxlCurrentFrame / this.pxlManifest.fps) * 1000;
      if (this.pxlAudioElement) {
        this.pxlAudioElement.currentTime = this.pxlCurrentFrame / this.pxlManifest.fps;
        this.pxlAudioElement.play().catch(e => console.warn('PXL Audio play failed:', e));
      }
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
    if (!this.pxlManifest) {
      this.source.pause();
    } else if (this.pxlAudioElement) {
      this.pxlAudioElement.pause();
    }
    this._isRendering = false;
    cancelAnimationFrame(this.rafId);
  }
  
  public get isPlaying(): boolean {
    if (this.pxlManifest) return this._isRendering;
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
  public get duration(): number {
    if (this.pxlManifest) return this.pxlManifest.frameCount / this.pxlManifest.fps;
    return this.source.duration;
  }
  public get currentTime(): number {
    if (this.pxlManifest) return this.pxlCurrentFrame / this.pxlManifest.fps;
    return this.source.currentTime;
  }
  public set currentTime(time: number) {
    if (this.pxlManifest) {
      this.pxlCurrentFrame = Math.floor(time * this.pxlManifest.fps) % this.pxlManifest.frameCount;
      this.pxlStartTime = performance.now() - (this.pxlCurrentFrame / this.pxlManifest.fps) * 1000;
      if (this.pxlAudioElement) this.pxlAudioElement.currentTime = time;
    } else {
      this.source.currentTime = time;
    }
  }
  public get volume(): number { return this.source.volume; }
  public set volume(v: number) { this.source.volume = v; }
  public get muted(): boolean {
    if (this.pxlAudioElement) return this.pxlAudioElement.muted;
    return this.source.muted;
  }
  public set muted(m: boolean) {
    this.source.muted = m;
    if (this.pxlAudioElement) this.pxlAudioElement.muted = m;
  }
  public get playbackRate(): number { return this.source.playbackRate; }
  public set playbackRate(r: number) { this.source.playbackRate = r; }

  public updateSettings(settings: Partial<RenderSettings>): void {
    if ((this.renderer as any).isPxlMode) {
      // Prevent changing settings that alter the buffer size or baked geometry during PXL playback
      delete settings.density;
      delete settings.renderMode;
    }
    this.renderer.updateSettings(settings);
    // If we are paused, force a single render frame so changes are visible instantly
    if (!this._isRendering) {
      this.renderer.render();
    }
  }

  public async setAtlas(atlas: GlyphAtlas): Promise<void> {
    this.atlas = atlas;
    await this.renderer.setAtlas(atlas);
  }

  public async exportPxl(): Promise<Blob> {
    if (!(this.renderer instanceof WebGPURenderer)) throw new Error('Export only supported in WebGPU');
    if (!this.source.isReady) throw new Error('No video loaded');

    const wasPlaying = this.isPlaying;
    this.pause(); // Stops main renderLoop
    
    const originalTime = this.source.currentTime;
    
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
    
    this.exportProgress = 0;
    
    for (let i = 0; i < totalFrames; i++) {
      await seekVideo(i / fps);
      const rawData = await this.renderer.extractCurrentFrame();
      frames.push(PxlFormat.packFrame(rawData));
      this.exportProgress = (i / totalFrames) * 100;
    }
    
    let audioBlob: Blob | null = null;
    if (this.source.originalFile) {
      try {
        const audioCtx = new AudioContext();
        const buffer = await this.source.originalFile.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(buffer);
        audioBlob = WavEncoder.encode(audioBuffer);
        audioCtx.close();
      } catch (err) {
        console.warn('Failed to extract audio for PXL:', err);
      }
    }
    
    const manifest: PxlManifest = {
      formatVersion: 1,
      engineVersion: "0.1.0",
      fps,
      resolution: { width: this.source.width, height: this.source.height },
      frameCount: totalFrames,
      settings: this.renderer.getSettings(),
      createdAt: new Date().toISOString()
    };
    
    const blob = await PxlFormat.createPxl(manifest, frames, null, audioBlob);
    
    // Restore state
    await seekVideo(originalTime);
    if (wasPlaying) {
      this.play();
    }
    
    return blob;
  }

  public async loadPxl(file: File): Promise<void> {
    this.pause();
    (this.renderer as any).isPxlMode = true;
    this.cleanupPxlAudio();
    
    const parsed = await PxlFormat.parsePxl(file);
    this.pxlManifest = parsed.manifest;
    this.pxlFrames = parsed.frames;
    this.pxlCurrentFrame = 0;
    
    if (parsed.audio) {
      this.pxlAudioElement = document.createElement('audio');
      this.pxlAudioElement.src = URL.createObjectURL(parsed.audio);
      this.pxlAudioElement.load();
    }
    
    // Apply settings
    this.updateSettings(this.pxlManifest.settings);
    
    // Pass the correct dimensions to the renderer
    (this.renderer as any).pxlDimensions = this.pxlManifest.resolution;
    
    this.play();
  }

  private renderLoop = () => {
    if (!this._isRendering) return;
    
    if (this.pxlManifest) {
      const now = performance.now();
      const elapsed = (now - this.pxlStartTime) / 1000;
      this.pxlCurrentFrame = Math.floor(elapsed * this.pxlManifest.fps) % this.pxlManifest.frameCount;
      
      const packedFrame = this.pxlFrames[this.pxlCurrentFrame];
      if (packedFrame && this.renderer instanceof WebGPURenderer) {
        const unpacked = PxlFormat.unpackFrame(packedFrame);
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
    this.cleanupPxlAudio();
    this.source.destroy();
    this.renderer.destroy();
  }
}
