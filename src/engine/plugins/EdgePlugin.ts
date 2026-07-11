import type { RenderPlugin } from './RenderPlugin';

export class EdgePlugin implements RenderPlugin {
  public name = 'Perceptual Edge';
  
  // Standard brightness mapping (64 chars, 4 rows of 16)
  private brightnessChars = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  
  public getAtlasSize() {
    return { columns: 16, rows: 8 };
  }

  public generateAtlas(ctx: CanvasRenderingContext2D, glyphSize: number): void {
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.floor(glyphSize * 0.9)}px monospace`;

    const { columns } = this.getAtlasSize();
    
    // Draw brightness chars (rows 0-3)
    for (let i = 0; i < 64; i++) {
      const char = i < this.brightnessChars.length ? this.brightnessChars[i] : '#';
      const x = i % columns;
      const y = Math.floor(i / columns);
      this.drawChar(ctx, char, x, y, glyphSize);
    }
    
    // Draw Edge Chars (rows 4-7)
    // Row 4: Horizontal
    for (let i = 0; i < columns; i++) this.drawChar(ctx, i < 8 ? '-' : '_', i, 4, glyphSize);
    
    // Row 5: Vertical
    for (let i = 0; i < columns; i++) this.drawChar(ctx, '|', i, 5, glyphSize);
    
    // Row 6: Diagonal Forward /
    for (let i = 0; i < columns; i++) this.drawChar(ctx, '/', i, 6, glyphSize);
    
    // Row 7: Diagonal Back \
    for (let i = 0; i < columns; i++) this.drawChar(ctx, '\\', i, 7, glyphSize);
  }
  
  private drawChar(ctx: CanvasRenderingContext2D, char: string, gridX: number, gridY: number, size: number) {
    const cx = gridX * size + size / 2;
    const cy = gridY * size + size / 2;
    ctx.fillText(char, cx, cy);
  }

  public getComputeShaderSnippet(): string {
    return `
fn getGlyphIndex(brightness: f32, magnitude: f32, gx: f32, gy: f32, cols: f32, rows: f32) -> f32 {
    if (magnitude > 0.15 && rows >= 8.0) {
      let angle = atan2(gy, gx); 
      let a = abs(angle);
      let pi = 3.14159265;
      var edgeRow = 0.0;
      if (a < pi*0.125 || a > pi*0.875) { edgeRow = 5.0; }
      else if (a > pi*0.375 && a < pi*0.625) { edgeRow = 4.0; }
      else if ((angle > pi*0.125 && angle < pi*0.375) || (angle < -pi*0.625 && angle > -pi*0.875)) { edgeRow = 6.0; }
      else { edgeRow = 7.0; }
      let col = floor(brightness * (cols - 1.0));
      return edgeRow * cols + col;
    } else {
      let totalNormalChars = cols * min(4.0, rows);
      return floor(brightness * (totalNormalChars - 1.0));
    }
}
    `;
  }
}
