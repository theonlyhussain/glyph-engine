/**
 * AutoCalibrator — Analyzes video frames to compute optimal rendering settings.
 * 
 * It samples the video at multiple timestamps, computes luminance histogram,
 * average saturation, contrast spread, and detail frequency, then derives
 * the ideal brightness, contrast, saturation, and density values so the
 * ASCII output matches the original video as closely as possible.
 */
export interface CalibrationResult {
  brightness: number;
  contrast: number;
  saturation: number;
  density: number;
}

export class AutoCalibrator {
  /**
   * Analyze the video element by sampling multiple frames and returning
   * the optimal settings for the most accurate ASCII reproduction.
   */
  public static async calibrate(video: HTMLVideoElement): Promise<CalibrationResult> {
    // Clone the video so calibration seeking doesn't stutter the main playback
    const clone = document.createElement('video');
    clone.muted = true;
    clone.playsInline = true;
    clone.preload = 'auto';
    clone.src = video.src;
    
    await new Promise<void>((resolve) => {
      clone.addEventListener('loadeddata', () => resolve(), { once: true });
      clone.load();
    });
    
    const sampleCount = 5;
    const duration = clone.duration;
    
    const startT = duration * 0.05;
    const endT = duration * 0.95;
    const step = (endT - startT) / (sampleCount - 1);
    
    const allStats: FrameStats[] = [];
    
    for (let i = 0; i < sampleCount; i++) {
      const time = startT + i * step;
      const stats = await this.sampleFrame(clone, time);
      allStats.push(stats);
    }
    
    // Clean up clone
    clone.removeAttribute('src');
    clone.load();
    
    // Average the stats across all sampled frames
    const avgLum = allStats.reduce((s, f) => s + f.meanLuminance, 0) / sampleCount;
    const avgStd = allStats.reduce((s, f) => s + f.stdLuminance, 0) / sampleCount;
    const avgSat = allStats.reduce((s, f) => s + f.meanSaturation, 0) / sampleCount;
    const avgDetail = allStats.reduce((s, f) => s + f.detailScore, 0) / sampleCount;
    
    return this.calculateSettings(avgLum, avgStd, avgSat, avgDetail);
  }

  /**
   * Derive optimal calibration settings from aggregated frame statistics.
   */
  public static calculateSettings(
    avgLum: number,
    avgStd: number,
    avgSat: number,
    avgDetail: number
  ): CalibrationResult {
    // BRIGHTNESS: Target a mean luminance of ~0.45 (slightly below midpoint for richness)
    // Dark videos (avgLum < 0.45) are boosted up to targetLum.
    // Bright videos (avgLum >= 0.45) maintain or enhance bright aesthetic (brightness >= 1.0).
    const targetLum = 0.45;
    let brightness: number;
    if (avgLum < targetLum) {
      brightness = targetLum / Math.max(avgLum, 0.01);
    } else {
      brightness = 1.0 + (avgLum - targetLum) * 0.5;
    }
    brightness = Math.max(0.5, Math.min(2.5, brightness));

    // CONTRAST: Target a luminance std deviation of ~0.22 (well-spread histogram)
    // If the video is flat (avgStd = 0.10), boost: 0.22 / 0.10 = 2.2
    // If the video is already punchy (avgStd = 0.30), pull back: 0.22 / 0.30 = 0.73
    const targetStd = 0.22;
    let contrast = targetStd / Math.max(avgStd, 0.01);
    contrast = Math.max(0.5, Math.min(2.5, contrast));

    // SATURATION: Target ~0.40 average saturation
    // ASCII art benefits from slightly boosted saturation since the characters
    // eat into the color fidelity
    const targetSat = 0.40;
    let saturation = targetSat / Math.max(avgSat, 0.01);
    saturation = Math.max(0.5, Math.min(2.5, saturation));

    // DENSITY: Based on detail score (edge frequency)
    // High detail (lots of edges/textures) → smaller cells (lower density number)
    // Low detail (smooth gradients, faces) → can use slightly larger cells
    // Detail score ranges roughly 0.0 - 1.0
    let density: number;
    if (avgDetail > 0.5) {
      density = 2; // Very detailed — pack tight
    } else if (avgDetail > 0.3) {
      density = 3; // Medium detail
    } else {
      density = 4; // Smooth/simple — can afford bigger glyphs
    }

    return {
      brightness: Math.round(brightness * 100) / 100,
      contrast: Math.round(contrast * 100) / 100,
      saturation: Math.round(saturation * 100) / 100,
      density
    };
  }
  
  /**
   * Seek the video to a specific time, draw it to a canvas, and compute
   * luminance/saturation/detail statistics from the raw pixel data.
   */
  private static async sampleFrame(video: HTMLVideoElement, time: number): Promise<FrameStats> {
    // Seek and wait
    await new Promise<void>((resolve) => {
      if (Math.abs(video.currentTime - time) < 0.05) {
        resolve();
        return;
      }
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
    
    // Draw to a small canvas for fast analysis (no need for full resolution)
    const sampleW = Math.min(video.videoWidth, 320);
    const sampleH = Math.min(video.videoHeight, Math.round(320 * (video.videoHeight / video.videoWidth)));
    
    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, sampleW, sampleH);
    
    const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
    const pixels = imageData.data; // RGBA flat array
    const totalPixels = sampleW * sampleH;
    
    let lumSum = 0;
    let satSum = 0;
    const lumValues: number[] = new Array(totalPixels);
    
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = pixels[idx] / 255;
      const g = pixels[idx + 1] / 255;
      const b = pixels[idx + 2] / 255;
      
      // Perceived luminance (Rec. 709)
      const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
      lumValues[i] = lum;
      lumSum += lum;
      
      // Saturation: using the simple max-min / max formula
      const cMax = Math.max(r, g, b);
      const cMin = Math.min(r, g, b);
      const sat = cMax > 0.001 ? (cMax - cMin) / cMax : 0;
      satSum += sat;
    }
    
    const meanLum = lumSum / totalPixels;
    const meanSat = satSum / totalPixels;
    
    // Standard deviation of luminance (measures contrast spread)
    let varianceSum = 0;
    for (let i = 0; i < totalPixels; i++) {
      const diff = lumValues[i] - meanLum;
      varianceSum += diff * diff;
    }
    const stdLum = Math.sqrt(varianceSum / totalPixels);
    
    // Detail score: compute a simple Sobel-like edge magnitude
    // Sample every 2nd pixel for speed
    let edgeSum = 0;
    let edgeCount = 0;
    for (let y = 1; y < sampleH - 1; y += 2) {
      for (let x = 1; x < sampleW - 1; x += 2) {
        const l = lumValues[y * sampleW + (x - 1)];
        const r = lumValues[y * sampleW + (x + 1)];
        const t = lumValues[(y - 1) * sampleW + x];
        const b = lumValues[(y + 1) * sampleW + x];
        
        const gx = Math.abs(r - l);
        const gy = Math.abs(b - t);
        edgeSum += Math.sqrt(gx * gx + gy * gy);
        edgeCount++;
      }
    }
    // Normalize to 0..1 range (max possible edge magnitude is ~1.41)
    const detailScore = Math.min(1.0, (edgeSum / edgeCount) / 0.3);
    
    return { meanLuminance: meanLum, stdLuminance: stdLum, meanSaturation: meanSat, detailScore };
  }
}

interface FrameStats {
  meanLuminance: number;
  stdLuminance: number;
  meanSaturation: number;
  detailScore: number;
}
