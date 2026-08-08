import type { Renderer, RenderSettings } from './Renderer';
import { WebGPURenderer } from './WebGPURenderer';
import { WebGL2Renderer } from './WebGL2Renderer';
import { VideoSource } from './VideoSource';
import { GlyphAtlas } from './GlyphAtlas';
import { GefFormat } from './GefFormat';
import type { GefManifest } from './GefFormat';
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
  
  // GEF Playback State
  private gefFrames: Uint8Array[] = [];
  private gefManifest: GefManifest | null = null;
  private gefCurrentFrame = 0;
  private gefStartTime = 0;
  private gefAudioElement: HTMLAudioElement | null = null;
  
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
    (this.renderer as any).isGefMode = false;
    this.gefFrames = [];
    this.gefManifest = null;
    this.cleanupGefAudio();
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

  private cleanupGefAudio(): void {
    if (this.gefAudioElement) {
      this.gefAudioElement.pause();
      this.gefAudioElement.removeAttribute('src');
      this.gefAudioElement = null;
    }
  }

  public play(): void {
    if (this.gefManifest) {
      this.gefStartTime = performance.now() - (this.gefCurrentFrame / this.gefManifest.fps) * 1000;
      if (this.gefAudioElement) {
        this.gefAudioElement.currentTime = this.gefCurrentFrame / this.gefManifest.fps;
        this.gefAudioElement.play().catch(e => console.warn('GEF Audio play failed:', e));
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
    if (!this.gefManifest) {
      this.source.pause();
    } else if (this.gefAudioElement) {
      this.gefAudioElement.pause();
    }
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
  public get duration(): number {
    if (this.gefManifest) return this.gefManifest.frameCount / this.gefManifest.fps;
    return this.source.duration;
  }
  public get currentTime(): number {
    if (this.gefManifest) return this.gefCurrentFrame / this.gefManifest.fps;
    return this.source.currentTime;
  }
  public set currentTime(time: number) {
    if (this.gefManifest) {
      this.gefCurrentFrame = Math.floor(time * this.gefManifest.fps) % this.gefManifest.frameCount;
      this.gefStartTime = performance.now() - (this.gefCurrentFrame / this.gefManifest.fps) * 1000;
      if (this.gefAudioElement) this.gefAudioElement.currentTime = time;
    } else {
      this.source.currentTime = time;
    }
  }
  public get volume(): number { return this.source.volume; }
  public set volume(v: number) { this.source.volume = v; }
  public get muted(): boolean {
    if (this.gefAudioElement) return this.gefAudioElement.muted;
    return this.source.muted;
  }
  public set muted(m: boolean) {
    this.source.muted = m;
    if (this.gefAudioElement) this.gefAudioElement.muted = m;
  }
  public get playbackRate(): number { return this.source.playbackRate; }
  public set playbackRate(r: number) { this.source.playbackRate = r; }

  public updateSettings(settings: Partial<RenderSettings>): void {
    if ((this.renderer as any).isGefMode) {
      // Prevent changing settings that alter the buffer size or baked geometry during GEF playback
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

  public async exportGef(): Promise<Blob> {
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
      frames.push(GefFormat.packFrame(rawData));
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
        console.warn('Failed to extract audio for GEF:', err);
      }
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
    
    const blob = await GefFormat.createGef(manifest, frames, null, audioBlob);
    
    // Restore state
    await seekVideo(originalTime);
    if (wasPlaying) {
      this.play();
    }
    
    return blob;
  }

  public async loadGef(file: File): Promise<void> {
    this.pause();
    (this.renderer as any).isGefMode = true;
    this.cleanupGefAudio();
    
    const parsed = await GefFormat.parseGef(file);
    this.gefManifest = parsed.manifest;
    this.gefFrames = parsed.frames;
    this.gefCurrentFrame = 0;
    
    if (parsed.audio) {
      this.gefAudioElement = document.createElement('audio');
      this.gefAudioElement.src = URL.createObjectURL(parsed.audio);
      this.gefAudioElement.load();
    }
    
    // Apply settings
    this.updateSettings(this.gefManifest.settings);
    
    // Pass the correct dimensions to the renderer
    (this.renderer as any).gefDimensions = this.gefManifest.resolution;
    
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
    this.cleanupGefAudio();
    this.source.destroy();
    this.renderer.destroy();
  }
}
