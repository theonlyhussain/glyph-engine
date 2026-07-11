import type { RenderPlugin } from '../plugins/RenderPlugin';

export class GlyphAtlas {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public plugin: RenderPlugin;
  public glyphSize: number = 32;

  constructor(plugin: RenderPlugin) {
    this.plugin = plugin;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create 2D context for GlyphAtlas");
    this.ctx = ctx;
    this.generate();
  }

  public generate() {
    const { columns, rows } = this.plugin.getAtlasSize();
    this.canvas.width = columns * this.glyphSize;
    this.canvas.height = rows * this.glyphSize;
    
    // Background must be transparent or black, depending on blending
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.plugin.generateAtlas(this.ctx, this.glyphSize);
  }

  public updatePlugin(plugin: RenderPlugin) {
    this.plugin = plugin;
    this.generate();
  }
}
