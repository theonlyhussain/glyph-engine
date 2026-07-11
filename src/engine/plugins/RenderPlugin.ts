export interface RenderPlugin {
  name: string;
  
  /**
   * Returns the grid dimensions of the atlas for this plugin
   */
  getAtlasSize(): { columns: number; rows: number };

  /**
   * Called to draw the glyphs into the provided canvas context.
   */
  generateAtlas(ctx: CanvasRenderingContext2D, glyphSize: number): void;

  /**
   * Returns WGSL code snippet that computes the target glyph index.
   * Function signature MUST be:
   * fn getGlyphIndex(brightness: f32, magnitude: f32, gx: f32, gy: f32, cols: f32, rows: f32) -> f32
   */
  getComputeShaderSnippet(): string;
}
