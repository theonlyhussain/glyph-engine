export class GlyphAtlas {
  public canvas: HTMLCanvasElement;
  public cols: number;
  public rows: number;
  public characters: string;
  public glyphSize: number;

  constructor(
    characters: string = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    glyphSize: number = 32
  ) {
    this.characters = characters;
    this.glyphSize = glyphSize;
    this.cols = 10;
    this.rows = Math.ceil(this.characters.length / this.cols);
    this.canvas = this.generate();
  }

  private generate(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.cols * this.glyphSize;
    canvas.height = this.rows * this.glyphSize;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `${Math.floor(this.glyphSize * 0.8)}px monospace`;
    
    let i = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (i >= this.characters.length) break;
        ctx.fillText(
          this.characters[i], 
          col * this.glyphSize + this.glyphSize / 2, 
          row * this.glyphSize + this.glyphSize / 2
        );
        i++;
      }
    }
    return canvas;
  }
}
