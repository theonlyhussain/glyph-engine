import type { RenderPlugin } from './RenderPlugin';

export class BlockPlugin implements RenderPlugin {
  name = 'Block';
  private chars = [' ', '░', '▒', '▓', '█'];

  public getAtlasSize(): { columns: number; rows: number } {
    return { columns: this.chars.length, rows: 1 };
  }

  public generateAtlas(ctx: CanvasRenderingContext2D, glyphSize: number): void {
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `${Math.floor(glyphSize * 0.9)}px monospace`;

    const { columns, rows } = this.getAtlasSize();
    let charIndex = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        if (charIndex >= this.chars.length) break;
        
        const char = this.chars[charIndex];
        const cx = x * glyphSize + glyphSize / 2;
        const cy = y * glyphSize + glyphSize / 2;
        
        ctx.fillText(char, cx, cy);
        charIndex++;
      }
    }
  }

  public getComputeShaderSnippet(): string {
    return `
fn getGlyphIndex(brightness: f32, magnitude: f32, gx: f32, gy: f32, cols: f32, rows: f32) -> f32 {
    let totalChars = cols * rows;
    return floor(brightness * (totalChars - 1.0));
}
    `;
  }
}
