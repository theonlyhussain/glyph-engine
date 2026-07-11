import type { Renderer, RenderSettings } from './Renderer';
import { VideoSource } from './VideoSource';
import { GlyphAtlas } from './GlyphAtlas';

export class WebGL2Renderer implements Renderer {
  private gl: WebGL2RenderingContext | null = null;
  private source: VideoSource | null = null;

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    this.gl = canvas.getContext('webgl2');
    if (!this.gl) throw new Error('WebGL2 not supported');
  }

  public updateSettings(_settings: Partial<RenderSettings>): void {
    // Minimal fallback: ignored
  }

  public setSource(source: VideoSource): void {
    this.source = source;
  }

  public setAtlas(_atlas: GlyphAtlas): void {
    // Minimal fallback: ignored
  }

  public render(): void {
    if (!this.gl || !this.source) return;
    if (!this.source.isReady || !this.source.isPlaying) return;

    // A complete WebGL2 glyph renderer is complex.
    // For now, as a fallback, we just clear to a dark color to indicate WebGL is active but basic.
    // Ideally, this would render the video to a texture.
    const gl = this.gl;
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  public destroy(): void {
    this.gl = null;
  }
}
