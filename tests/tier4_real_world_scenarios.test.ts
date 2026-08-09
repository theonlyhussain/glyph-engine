/**
 * Tier 4: Real-World Application Scenarios Test Suite
 * High-fidelity end-to-end user scenarios and workflow integration
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { AutoCalibrator } from '../src/engine/AutoCalibrator.ts';
import { PxlFormat } from '../src/engine/PxlFormat.ts';

export async function runTier4Tests() {
  const results: { name: string; category: string; passed: boolean; error?: string }[] = [];

  function record(name: string, category: string, fn: () => void | Promise<void>) {
    try {
      fn();
      results.push({ name, category, passed: true });
    } catch (err: any) {
      results.push({ name, category, passed: false, error: err.message });
    }
  }

  async function recordAsync(name: string, category: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, category, passed: true });
    } catch (err: any) {
      results.push({ name, category, passed: false, error: err.message });
    }
  }

  // ==========================================
  // Scenario 1: End-to-End Bright Video Export & Playback Workflow
  // ==========================================

  await recordAsync('test_realworld_end_to_end_bright_video_workflow', 'Tier 4: Real-World', async () => {
    // 1. User uploads bright snow landscape video (avgLum = 0.92)
    const stats = { meanLuminance: 0.92, stdLuminance: 0.12, meanSaturation: 0.10, detailScore: 0.55 };
    const cal = AutoCalibrator.calculateSettings(stats.meanLuminance, stats.stdLuminance, stats.meanSaturation, stats.detailScore);
    
    // AutoCalibrator must preserve high brightness for snow video
    assert.strictEqual(cal.brightness, 1.24, 'Snow video brightness should be 1.24');
    assert.strictEqual(cal.density, 2, 'High detail snow video density should be 2');

    // 2. Export engine packs frames into .pxl container
    const width = 1280;
    const height = 720;
    const gridW = Math.ceil(width / cal.density);
    const gridH = Math.ceil(height / cal.density);
    const frameCells = gridW * gridH;
    const rawCellData = new Float32Array(frameCells * 8);

    // Populate bright pixels
    for (let i = 0; i < frameCells; i++) {
      const idx = i * 8;
      rawCellData[idx] = 0.95;     // R
      rawCellData[idx + 1] = 0.95; // G
      rawCellData[idx + 2] = 0.95; // B
      rawCellData[idx + 3] = 1.0;  // A
      rawCellData[idx + 4] = 65;   // 'A' glyph
      rawCellData[idx + 5] = 0.95; // lum
    }

    const packedFrame = PxlFormat.packFrame(rawCellData);
    const manifest = {
      formatVersion: 1,
      engineVersion: '1.0.0',
      fps: 30,
      resolution: { width, height },
      frameCount: 1,
      settings: {
        brightness: cal.brightness,
        contrast: cal.contrast,
        saturation: cal.saturation,
        density: cal.density,
        colorMode: 0,
        renderMode: 0,
        quality: 2
      },
      createdAt: new Date().toISOString()
    };

    const pxlBlob = await PxlFormat.createPxl(manifest, [packedFrame], null, null);
    assert.ok(pxlBlob.size > 0, 'PXL Blob generated from export workflow must be valid');

    // 3. User embeds player and player parses .pxl container
    const buffer = new Uint8Array(await pxlBlob.arrayBuffer());
    const parsed = await PxlFormat.parsePxl(buffer as any);
    assert.strictEqual(parsed.manifest.settings.brightness, 1.24, 'Parsed brightness must match calibrated export');
    
    const unpacked = PxlFormat.unpackFrame(parsed.frames[0]);
    assert.strictEqual(unpacked.length, frameCells * 8, 'Unpacked float array length must match original frame cell count * 8');
    assert.strictEqual(unpacked[4], 65, 'Glyph index in unpacked frame must be preserved');
  });

  // ==========================================
  // Scenario 2: Embed Widget Lifecycle on External Website
  // ==========================================

  record('test_realworld_embed_widget_lifecycle_on_external_site', 'Tier 4: Real-World', () => {
    const embedTsPath = path.resolve('src/embed.ts');
    const content = fs.readFileSync(embedTsPath, 'utf8');

    // Inspect custom element structure required for 3rd party website embedding
    assert.ok(content.includes('constructor()'), 'Embed player element must have constructor');
    assert.ok(content.includes('connectedCallback()'), 'Embed player must implement connectedCallback lifecycle hook');
    assert.ok(content.includes('disconnectedCallback()'), 'Embed player must implement disconnectedCallback cleanup hook');
    assert.ok(content.includes('this.getAttribute(\'src\')'), 'Embed player must read src attribute');
    assert.ok(content.includes('fetch(src)'), 'Embed player must fetch remote .pxl asset');
    assert.ok(content.includes('initEngine'), 'Embed player must attempt WebGPU engine initialization');
    assert.ok(content.includes('initFallback'), 'Embed player must provide WebGPU fallback path');
  });

  // ==========================================
  // Scenario 3: Video Spectrum AutoCalibration Benchmark
  // ==========================================

  record('test_realworld_dark_to_bright_video_auto_calibration_suite', 'Tier 4: Real-World', () => {
    const videoSamples = [
      { name: 'Night Cityscape', avgLum: 0.05, avgStd: 0.08, avgSat: 0.60, avgDetail: 0.70, expectMinBright: 2.0 },
      { name: 'Dim Concert', avgLum: 0.20, avgStd: 0.15, avgSat: 0.50, avgDetail: 0.40, expectMinBright: 1.5 },
      { name: 'Midtone Interview', avgLum: 0.45, avgStd: 0.22, avgSat: 0.40, avgDetail: 0.20, expectMinBright: 1.0 },
      { name: 'Sunny Beach', avgLum: 0.75, avgStd: 0.18, avgSat: 0.35, avgDetail: 0.55, expectMinBright: 1.1 },
      { name: 'White Studio Backdrop', avgLum: 0.95, avgStd: 0.05, avgSat: 0.05, avgDetail: 0.15, expectMinBright: 1.2 }
    ];

    for (const sample of videoSamples) {
      const res = AutoCalibrator.calculateSettings(sample.avgLum, sample.avgStd, sample.avgSat, sample.avgDetail);
      assert.ok(
        res.brightness >= sample.expectMinBright,
        `Video '${sample.name}' (lum ${sample.avgLum}) produced brightness ${res.brightness}, expected >= ${sample.expectMinBright}`
      );
      assert.ok(res.brightness >= 0.5 && res.brightness <= 2.5, `Brightness out of bounds for ${sample.name}`);
      assert.ok(res.contrast >= 0.5 && res.contrast <= 2.5, `Contrast out of bounds for ${sample.name}`);
      assert.ok(res.saturation >= 0.5 && res.saturation <= 2.5, `Saturation out of bounds for ${sample.name}`);
    }
  });

  // ==========================================
  // Scenario 4: Multi-Asset PXL Archive Roundtrip Integrity
  // ==========================================

  await recordAsync('test_realworld_pxl_archive_roundtrip_integrity', 'Tier 4: Real-World', async () => {
    const dummyFrame1 = new Uint8Array([1, 0, 255, 128, 64]);
    const dummyFrame2 = new Uint8Array([2, 0, 200, 100, 50]);
    const thumbData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header bytes
    const audioData = new Uint8Array([82, 73, 70, 70]); // RIFF WAV header bytes

    const manifest = {
      formatVersion: 1,
      engineVersion: '1.2.0',
      fps: 24,
      resolution: { width: 320, height: 240 },
      frameCount: 2,
      settings: { brightness: 1.15, contrast: 1.05, saturation: 1.10, density: 4, colorMode: 0, renderMode: 0, quality: 1 },
      createdAt: new Date().toISOString()
    };

    const pxlBlob = await PxlFormat.createPxl(manifest, [dummyFrame1, dummyFrame2], thumbData as any, audioData as any);
    const buffer = new Uint8Array(await pxlBlob.arrayBuffer());
    const parsed = await PxlFormat.parsePxl(buffer as any);

    assert.strictEqual(parsed.manifest.engineVersion, '1.2.0', 'Engine version in parsed manifest must match');
    assert.strictEqual(parsed.manifest.frameCount, 2, 'Frame count must be 2');
    assert.strictEqual(parsed.frames.length, 2, 'Parsed frames array must contain 2 frame buffers');
    assert.ok(parsed.thumbnail !== null, 'Thumbnail Blob must be parsed from PXL zip');
    assert.ok(parsed.audio !== null, 'Audio Blob must be parsed from PXL zip');
  });

  return results;
}
