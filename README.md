<div align="center">
  <h1>GlyphEngine</h1>
  <p><b>High-Performance WebGPU Typography Renderer</b></p>
  <p>
    <img src="https://img.shields.io/badge/WebGPU-Ready-blue?style=for-the-badge&logo=webgl" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript" />
    <img src="https://img.shields.io/badge/React-UI-blue?style=for-the-badge&logo=react" />
  </p>
</div>

<br />

GlyphEngine is a state-of-the-art, GPU-accelerated rendering engine that transforms HTML5 video into dynamic, high-density typographic art in real-time. Built from the ground up for the browser, it leverages WebGPU compute and render pipelines to achieve unparalleled performance without freezing the main thread.

## ✨ Features

- **Blazing Fast WebGPU Compute**: Frame luminance analysis is performed via highly parallelized compute shaders.
- **Instanced Glyph Rendering**: Renders tens of thousands of glyphs per frame at 60 FPS using instanced quads and atlas sampling.
- **Multiple Render Modes**: Includes standard Brightness ASCII, Perceptual Edge Detection, and Unicode Block rendering.
- **Color Themes**: Built-in support for Matrix, Amber, Terminal Green, and Monochrome modes via zero-cost uniform updates.
- **Persistent Pipeline**: Changing density, size, or color modes does *not* trigger expensive shader recompilations.
- **Clean Architecture**: The core engine (`src/engine/`) is completely decoupled from the React UI (`src/ui/`).
- **Robust Resource Management**: Strict handling of WebGPU textures and object URLs to prevent memory leaks during extended use.

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/yourusername/GlyphEngine.git
cd GlyphEngine
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
