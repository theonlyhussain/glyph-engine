/**
 * Tier 3: Pairwise Combinations Test Suite
 * Interaction testing across R1, R2, R3, R4
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { AutoCalibrator } from '../src/engine/AutoCalibrator.ts';
import { PxlFormat } from '../src/engine/PxlFormat.ts';

export async function runTier3Tests() {
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
  // Pairwise Test 1: AutoCalibrator + PXL Packing Roundtrip
  // ==========================================

  await recordAsync('test_pairwise_autocalibration_with_pxl_unpacking', 'Tier 3: Pairwise', async () => {
    // 1. Compute calibration settings for bright video (avgLum = 0.85)
    const calSettings = AutoCalibrator.calculateSettings(0.85, 0.20, 0.35, 0.60);
    assert.strictEqual(calSettings.brightness, 1.20, 'Bright video calibrated brightness should be 1.20');
    assert.strictEqual(calSettings.density, 2, 'High detail video density should be 2');

    // 2. Prepare WebGPU float cell data (32 bytes per cell = 8 floats)
    // [r, g, b, a, charIdx, lum, variance, padding]
    const numCells = 16;
    const floatData = new Float32Array(numCells * 8);
    for (let i = 0; i < numCells; i++) {
      const idx = i * 8;
      floatData[idx] = 0.9;     // r
      floatData[idx + 1] = 0.8; // g
      floatData[idx + 2] = 0.7; // b
      floatData[idx + 3] = 1.0; // a
      floatData[idx + 4] = i * 10; // charIdx
      floatData[idx + 5] = 0.82; // lum
    }

    // 3. Pack frame into 5-byte per cell Uint8Array
    const packed = PxlFormat.packFrame(floatData);
    assert.strictEqual(packed.length, numCells * 5, 'Packed array length must be numCells * 5');

    // 4. Create PXL blob with manifest incorporating calibrated settings
    const manifest = {
      formatVersion: 1,
      engineVersion: '1.0.0',
      fps: 30,
      resolution: { width: 8, height: 8 },
      frameCount: 1,
      settings: {
        brightness: calSettings.brightness,
        contrast: calSettings.contrast,
        saturation: calSettings.saturation,
        density: calSettings.density,
        colorMode: 0,
        renderMode: 0,
        quality: 1
      },
      createdAt: new Date().toISOString()
    };

    const blob = await PxlFormat.createPxl(manifest, [packed], null, null);
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const parsed = await PxlFormat.parsePxl(buffer as any);

    // 5. Unpack frame and verify fidelity
    const unpackedFloat = PxlFormat.unpackFrame(parsed.frames[0]);
    for (let i = 0; i < numCells; i++) {
      const idx = i * 8;
      assert.strictEqual(unpackedFloat[idx + 4], i * 10, `CharIdx at cell ${i} must match packed value`);
      assert.ok(Math.abs(unpackedFloat[idx] - 0.9) < 0.01, 'Red channel must match within quant error');
    }
  });

  // ==========================================
  // Pairwise Test 2: URL Loaded PXL + AutoCalibrated Settings
  // ==========================================

  await recordAsync('test_pairwise_url_loaded_pxl_with_autocalibrated_settings', 'Tier 3: Pairwise', async () => {
    // Calibrate bright outdoor frame (avgLum = 0.75)
    const cal = AutoCalibrator.calculateSettings(0.75, 0.18, 0.35, 0.45);
    
    // Create PXL manifest with calibrated settings
    const manifest = {
      formatVersion: 1,
      engineVersion: '1.0.0',
      fps: 60,
      resolution: { width: 1920, height: 1080 },
      frameCount: 1,
      settings: {
        brightness: cal.brightness,
        contrast: cal.contrast,
        saturation: cal.saturation,
        density: cal.density,
        colorMode: 1, // Matrix
        renderMode: 0,
        quality: 2
      },
      createdAt: new Date().toISOString()
    };

    const emptyFrame = new Uint8Array(Math.ceil(1920 / cal.density) * Math.ceil(1080 / cal.density) * 5);
    const pxlBlob = await PxlFormat.createPxl(manifest, [emptyFrame], null, null);
    const buffer = new Uint8Array(await pxlBlob.arrayBuffer());
    
    // Parse simulated URL load
    const parsed = await PxlFormat.parsePxl(buffer as any);
    assert.strictEqual(parsed.manifest.settings.brightness, cal.brightness, 'Loaded PXL brightness must match calibrated value');
    assert.strictEqual(parsed.manifest.settings.density, cal.density, 'Loaded PXL density must match calibrated value');
  });

  // ==========================================
  // Pairwise Test 3: WebGPU Renderer Uniform Layout + Shader Alignment
  // ==========================================

  record('test_pairwise_embed_player_with_webgpu_shader_uniforms', 'Tier 3: Pairwise', () => {
    const wgslPath = path.resolve('src/engine/shaders/render.wgsl');
    const wgsl = fs.readFileSync(wgslPath, 'utf8');

    // Uniform fields in render.wgsl
    const fields = [
      'sourceSize', 'gridSize', 'cellSize', 'time',
      'atlasColumns', 'atlasRows', 'colorMode', 'renderMode',
      'quality', 'brightness', 'contrast', 'saturation'
    ];

    for (const field of fields) {
      assert.ok(wgsl.includes(field), `Shader Uniforms struct must contain field '${field}'`);
    }
  });

  // ==========================================
  // Pairwise Test 4: GEF Purge across PXL & Embed Pipeline
  // ==========================================

  record('test_pairwise_legacy_purge_verification_across_pxl_pipeline', 'Tier 3: Pairwise', () => {
    const pipelineFiles = [
      'src/engine/PxlFormat.ts',
      'src/engine/AutoCalibrator.ts',
      'src/engine/GlyphEngine.ts',
      'src/engine/renderers/WebGPURenderer.ts',
      'src/embed.ts',
      'src/ui/EmbedModal.tsx'
    ];

    for (const relPath of pipelineFiles) {
      const fullPath = path.resolve(relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!/gef/i.test(content), `Pipeline file ${relPath} must have 0 legacy .gef references`);
      }
    }
  });

  // ==========================================
  // Pairwise Test 5: Bright Video Calibration -> Shader Color Correction Simulation
  // ==========================================

  record('test_pairwise_high_luminance_video_calibration_to_shader_render', 'Tier 3: Pairwise', () => {
    // 1. Calibrate bright video (avgLum = 0.90)
    const cal = AutoCalibrator.calculateSettings(0.90, 0.15, 0.20, 0.40);
    assert.ok(cal.brightness >= 1.0, `Calibrated brightness for bright video must be >= 1.0, got ${cal.brightness}`);

    // 2. Simulate WGSL applyColorCorrection logic
    // c = c * brightness; c = (c - 0.5)*contrast + 0.5; lum = dot(c, rec709); mix(lum, c, saturation); clamp(0, 1)
    let c = [0.8, 0.8, 0.8]; // Input bright pixel
    c = c.map(v => v * cal.brightness);
    c = c.map(v => (v - 0.5) * cal.contrast + 0.5);
    const lum = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    c = c.map(v => (1 - cal.saturation) * lum + cal.saturation * v);
    c = c.map(v => Math.max(0, Math.min(1, v)));

    // 3. Verify color values remain bright and do not collapse to black
    const finalLum = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    assert.ok(finalLum > 0.5, `Final output luminance (${finalLum.toFixed(2)}) must remain high, preserving bright aesthetic`);
  });

  return results;
}
