export type QualityPreset = 'Preview' | 'Balanced' | 'Cinema' | 'Ultra' | 'Extreme' | 'Insane';

export interface GlyphEngineOptions {
  canvas: HTMLCanvasElement;
  qualityPreset?: QualityPreset;
}

export interface FrameData {
  videoFrame: VideoFrame | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;
  width: number;
  height: number;
  timestamp: number;
}

export interface EngineStats {
  fps: number;
  frameTime: number;
  cpuTime: number;
  gpuTime: number;
  videoFps: number;
  renderFps: number;
  renderResolution: { width: number; height: number };
  sourceResolution: { width: number; height: number };
  glyphCount: number;
  visibleGlyphs: number;
  updatedGlyphs: number;
  droppedFrames: number;
  vramUsageMB: number;
  memoryUsageMB: number;
  pipelineLatency: number;
  shaderTime: number;
  cacheHits: number;
}
