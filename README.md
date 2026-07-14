<div align="center">
  <h1>GlyphEngine</h1>
  <p><b>Just simple videos into pixle of words</b></p>
  <p>
    <img src="https://img.shields.io/badge/WebGPU-Ready-blue?style=for-the-badge&logo=webgl" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript" />
    <img src="https://img.shields.io/badge/React-UI-blue?style=for-the-badge&logo=react" />
  </p>
</div>

<div align="center">
  <img src="docs/screenshots/rc1-render.png" alt="GlyphEngine Render Example" width="800" />
</div>

<br />

GlyphEngine is a WebGPU-based rendering engine that converts uploaded video into real-time typography animations. Instead of standard pixels, it reconstructs the video using text characters (ASCII, Unicode blocks, etc.). It uses a two-pass architecture: a compute shader analyzes the video's luminance, and a render pass draws the output using instanced quads and a glyph texture atlas.

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/theonlyhussain/glyph-engine.git
cd glyph-engine
npm install
npm run dev
```

Open `http://localhost:5173` to view the application.

## 🧠 Architecture Overview

GlyphEngine is built on a two-pass WebGPU architecture:

1.  **Analyze Pass (Compute Shader)**: 
    *   Samples the current video frame via `importExternalTexture`.
    *   Calculates luminance for each grid cell.
    *   Writes the corresponding character index and luminance to a Storage Buffer (`cellDataBuffer`).
2.  **Render Pass (Vertex/Fragment Shader)**:
    *   Uses instanced rendering (`draw(6, instanceCount)`).
    *   The vertex shader reads the `cellDataBuffer` to determine which atlas coordinates to map to the quad.
    *   The fragment shader applies the final color grading, blending the glyph alpha with the chosen Color Mode.

## 🎮 Controls

*   **Drag & Drop**: Drop any MP4, WebM, MOV, or AVI video onto the window.
*   **Space**: Play/Pause.
*   **Ctrl + Shift + D**: Toggle Developer Mode HUD (FPS, VRAM estimates).

## 🛠️ Contributing

We welcome contributions! Please follow the strict UI/Engine separation philosophy:
- Do not import React into `src/engine/`.
- Ensure all WebGPU resources are properly disposed of.
- Verify `npm run build` succeeds before opening a PR.

## 📄 License

MIT License. See `LICENSE` for details.
