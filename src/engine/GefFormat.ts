import JSZip from 'jszip';
import type { RenderSettings } from './Renderer';

export interface GefManifest {
  formatVersion: number;
  engineVersion: string;
  fps: number;
  resolution: { width: number; height: number };
  frameCount: number;
  settings: RenderSettings;
  createdAt: string;
}

export interface GefParsed {
  manifest: GefManifest;
  frames: Uint8Array[];
  thumbnail: Blob | null;
  audio: Blob | null;
}

export class GefFormat {
  /**
   * Packs a 32-byte per-cell Float32Array (from WebGPU) into a 5-byte per-cell Uint8Array.
   * Input layout: [r, g, b, a, charIdx, lum, variance, padding] (8 floats = 32 bytes)
   * Output layout: [charIdx_lo, charIdx_hi, r_u8, g_u8, b_u8] (5 bytes)
   */
  public static packFrame(cellData: Float32Array): Uint8Array {
    const numCells = cellData.length / 8;
    const packed = new Uint8Array(numCells * 5);
    
    for (let i = 0; i < numCells; i++) {
      const srcIdx = i * 8;
      const dstIdx = i * 5;
      
      const r = Math.min(255, Math.max(0, Math.round(cellData[srcIdx] * 255)));
      const g = Math.min(255, Math.max(0, Math.round(cellData[srcIdx + 1] * 255)));
      const b = Math.min(255, Math.max(0, Math.round(cellData[srcIdx + 2] * 255)));
      const charIdx = cellData[srcIdx + 4]; // floats perfectly represent integers up to 16M
      
      packed[dstIdx] = charIdx & 0xFF;
      packed[dstIdx + 1] = (charIdx >> 8) & 0xFF;
      packed[dstIdx + 2] = r;
      packed[dstIdx + 3] = g;
      packed[dstIdx + 4] = b;
    }
    
    return packed;
  }

  /**
   * Unpacks a 5-byte per-cell Uint8Array back into the 32-byte per-cell Float32Array required by WebGPU.
   */
  public static unpackFrame(packed: Uint8Array): Float32Array {
    const numCells = packed.length / 5;
    const cellData = new Float32Array(numCells * 8);
    
    for (let i = 0; i < numCells; i++) {
      const srcIdx = i * 5;
      const dstIdx = i * 8;
      
      const charIdx = packed[srcIdx] | (packed[srcIdx + 1] << 8);
      const r = packed[srcIdx + 2] / 255.0;
      const g = packed[srcIdx + 3] / 255.0;
      const b = packed[srcIdx + 4] / 255.0;
      
      // Calculate luminance for blending/fallback
      const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
      
      cellData[dstIdx] = r;
      cellData[dstIdx + 1] = g;
      cellData[dstIdx + 2] = b;
      cellData[dstIdx + 3] = 1.0; // alpha
      cellData[dstIdx + 4] = charIdx;
      cellData[dstIdx + 5] = lum;
      cellData[dstIdx + 6] = 0.0; // variance (unused in render)
      cellData[dstIdx + 7] = 0.0; // padding
    }
    
    return cellData;
  }

  public static async createGef(manifest: GefManifest, frames: Uint8Array[], thumbnail: Blob | null, audio: Blob | null): Promise<Blob> {
    const zip = new JSZip();
    
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    
    const combinedFrames = new Uint8Array(frames.reduce((acc, f) => acc + f.length, 0));
    let offset = 0;
    for (const f of frames) {
      combinedFrames.set(f, offset);
      offset += f.length;
    }
    
    zip.file("frames.bin", combinedFrames);
    
    if (thumbnail) {
      zip.file("thumbnail.png", thumbnail);
    }

    if (audio) {
      zip.file("audio.wav", audio);
    }
    
    return await zip.generateAsync({ 
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
  }

  public static async parseGef(blob: Blob): Promise<GefParsed> {
    const zip = await JSZip.loadAsync(blob);
    
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('Invalid .gef: missing manifest.json');
    
    const manifestStr = await manifestFile.async('string');
    const manifest = JSON.parse(manifestStr) as GefManifest;
    
    if (manifest.formatVersion !== 1) {
      throw new Error(`Unsupported .gef format version: ${manifest.formatVersion}`);
    }
    
    const framesFile = zip.file('frames.bin');
    if (!framesFile) throw new Error('Invalid .gef: missing frames.bin');
    
    const combinedFrames = await framesFile.async('uint8array');
    const frames: Uint8Array[] = [];
    
    // Determine frame size from resolution and density
    const gridW = Math.ceil(manifest.resolution.width / manifest.settings.density);
    const gridH = Math.ceil(manifest.resolution.height / manifest.settings.density);
    const frameSize = gridW * gridH * 5;
    
    for (let i = 0; i < manifest.frameCount; i++) {
      const offset = i * frameSize;
      frames.push(combinedFrames.slice(offset, offset + frameSize));
    }
    
    let thumbnail: Blob | null = null;
    const thumbFile = zip.file("thumbnail.png");
    if (thumbFile) {
      thumbnail = await thumbFile.async("blob");
    }

    let audio: Blob | null = null;
    const audioFile = zip.file("audio.wav");
    if (audioFile) {
      audio = await audioFile.async("blob");
    }
    
    return { manifest, frames, thumbnail, audio };
  }
}
