import type { QualityPreset } from '../types';
import { GlyphAtlas } from '../pipeline/GlyphAtlas';
import type { FrameData } from '../types';

export abstract class Renderer {
  protected canvas: HTMLCanvasElement;
  protected qualityPreset: QualityPreset;
  protected atlas: GlyphAtlas | null = null;
  protected isInitialized: boolean = false;

  constructor(canvas: HTMLCanvasElement, preset: QualityPreset) {
    this.canvas = canvas;
    this.qualityPreset = preset;
  }

  public setAtlas(atlas: GlyphAtlas) {
    this.atlas = atlas;
    if (this.isInitialized) {
      this.onAtlasChanged();
    }
  }

  public setQualityPreset(preset: QualityPreset) {
    this.qualityPreset = preset;
    if (this.isInitialized) {
      this.onQualityChanged();
    }
  }

  public abstract init(): Promise<void>;
  public abstract renderFrame(frame: FrameData): void;
  public abstract dispose(): void;
  public abstract getResolution(): { width: number; height: number };
  public abstract getInstanceCount(): number;
  
  protected abstract onAtlasChanged(): void;
  protected abstract onQualityChanged(): void;

  protected getResolutionScale(): number {
    switch (this.qualityPreset) {
      case 'Preview': return 0.25;
      case 'Balanced': return 0.5;
      case 'Cinema': return 0.75;
      case 'Ultra': return 1.0;
      case 'Extreme': return 1.5;
      case 'Insane': return 2.0;
      default: return 0.5;
    }
  }

  // Returns how many pixels wide/high a single glyph cell should be in the source image
  // Smaller cell size = more glyphs (higher density)
  protected getCellSize(): number {
    switch (this.qualityPreset) {
      case 'Preview': return 16;
      case 'Balanced': return 12;
      case 'Cinema': return 8;
      case 'Ultra': return 6;
      case 'Extreme': return 4;
      case 'Insane': return 3;
      default: return 12;
    }
  }
}
