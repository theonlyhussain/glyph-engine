import { VideoSource } from './VideoSource';
import { GlyphAtlas } from './GlyphAtlas';

export interface RenderSettings {
  density: number; // e.g. 4, 8, 16 (cellSize)
  colorMode: number; // 0: Original, 1: White, 2: Matrix, 3: Amber, 4: Terminal, 5: Monochrome
  renderMode: number; // 0: ASCII, 1: Edge, 2: Unicode Block
}

export interface Renderer {
  init(canvas: HTMLCanvasElement): Promise<void>;
  updateSettings(settings: Partial<RenderSettings>): void;
  setSource(source: VideoSource): void;
  setAtlas(atlas: GlyphAtlas): void;
  render(): void;
  destroy(): void;
}
