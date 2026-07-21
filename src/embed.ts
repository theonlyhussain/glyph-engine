import { GlyphEngine } from './engine/GlyphEngine';
import { GefFormat } from './engine/GefFormat';

class GlyphPlayerElement extends HTMLElement {
  private engine: GlyphEngine | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLDivElement;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Base styles
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        position: relative;
        background: #000;
        overflow: hidden;
      }
      .container {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      canvas, img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .fallback-badge {
        position: absolute;
        bottom: 16px;
        right: 16px;
        background: rgba(15, 23, 42, 0.8);
        color: #f8fafc;
        padding: 6px 12px;
        border-radius: 6px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,0.1);
        pointer-events: none;
      }
      .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #fff;
        font-family: monospace;
      }
    `;
    this.shadowRoot!.appendChild(style);

    this.container = document.createElement('div');
    this.container.className = 'container';
    this.shadowRoot!.appendChild(this.container);
  }

  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;

    this.container.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Failed to fetch GEF file');
      const blob = await response.blob();
      const file = new File([blob], 'project.gef', { type: blob.type });

      // Check WebGPU support
      if (navigator.gpu) {
        await this.initEngine(file);
      } else {
        await this.initFallback(file);
      }
    } catch (err) {
      console.error('GlyphPlayer Error:', err);
      this.container.innerHTML = '<div class="loading" style="color: #f87171;">Failed to load</div>';
    }
  }

  disconnectedCallback() {
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private async initEngine(file: File) {
    this.container.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);

    // Keep canvas resolution synced with its display size
    this.resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (this.canvas) {
          this.canvas.width = entry.contentRect.width * window.devicePixelRatio;
          this.canvas.height = entry.contentRect.height * window.devicePixelRatio;
        }
      }
    });
    this.resizeObserver.observe(this.container);

    // Init Engine
    this.engine = new GlyphEngine(this.canvas);
    await this.engine.init();
    await this.engine.loadGef(file);
  }

  private async initFallback(file: File) {
    this.container.innerHTML = '';
    
    // Parse GEF specifically to extract just the thumbnail
    const parsed = await GefFormat.parseGef(file);
    if (parsed.thumbnail) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(parsed.thumbnail);
      this.container.appendChild(img);
      
      const badge = document.createElement('div');
      badge.className = 'fallback-badge';
      badge.textContent = 'Playback requires WebGPU';
      this.container.appendChild(badge);
    } else {
      this.container.innerHTML = '<div class="loading">WebGPU not supported. No fallback preview available.</div>';
    }
  }
}

if (!customElements.get('glyph-player')) {
  customElements.define('glyph-player', GlyphPlayerElement);
}
