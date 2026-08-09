/**
 * Tier 1: Feature Coverage Test Suite
 * Requirements Covered: R1, R2, R3, R4
 * Minimum test cases per feature: 5
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { AutoCalibrator } from '../src/engine/AutoCalibrator.ts';
import { PxlFormat } from '../src/engine/PxlFormat.ts';

export async function runTier1Tests() {
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
  // Feature 1: AutoCalibrator Brightness (R1)
  // ==========================================
  
  record('test_r1_fc01_high_luminance_white_video', 'R1: AutoCalibrator', () => {
    // White video with high mean luminance (0.95)
    const settings = AutoCalibrator.calculateSettings(0.95, 0.10, 0.05, 0.40);
    // Formula: 1.0 + (0.95 - 0.45) * 0.5 = 1.25
    assert.strictEqual(settings.brightness, 1.25, `Expected brightness 1.25 for white video, got ${settings.brightness}`);
    assert.ok(settings.brightness >= 1.0, 'Bright video must maintain or enhance brightness >= 1.0');
  });

  record('test_r1_fc02_mid_high_luminance_bright_outdoor', 'R1: AutoCalibrator', () => {
    // Bright outdoor scene (avgLum = 0.70)
    const settings = AutoCalibrator.calculateSettings(0.70, 0.20, 0.30, 0.40);
    // Formula: 1.0 + (0.70 - 0.45) * 0.5 = 1.125 -> rounded to 1.13
    assert.strictEqual(settings.brightness, 1.13, `Expected brightness 1.13 for bright outdoor video, got ${settings.brightness}`);
    assert.ok(settings.brightness >= 1.0, 'Bright outdoor video must maintain brightness >= 1.0');
  });

  record('test_r1_fc03_threshold_luminance', 'R1: AutoCalibrator', () => {
    // Threshold luminance (avgLum = 0.45)
    const settings = AutoCalibrator.calculateSettings(0.45, 0.22, 0.40, 0.35);
    // Formula: 1.0 + (0.45 - 0.45) * 0.5 = 1.00
    assert.strictEqual(settings.brightness, 1.00, `Expected brightness 1.00 at target threshold, got ${settings.brightness}`);
  });

  record('test_r1_fc04_low_luminance_dark_scene', 'R1: AutoCalibrator', () => {
    // Dark scene (avgLum = 0.15)
    const settings = AutoCalibrator.calculateSettings(0.15, 0.15, 0.20, 0.20);
    // Formula: 0.45 / 0.15 = 3.0 -> clamped to 2.50 max
    assert.strictEqual(settings.brightness, 2.50, `Expected brightness boosted to max clamp 2.50 for dark video, got ${settings.brightness}`);
  });

  record('test_r1_fc05_moderate_dark_video', 'R1: AutoCalibrator', () => {
    // Moderate dark video (avgLum = 0.30)
    const settings = AutoCalibrator.calculateSettings(0.30, 0.20, 0.30, 0.25);
    // Formula: 0.45 / 0.30 = 1.50
    assert.strictEqual(settings.brightness, 1.50, `Expected brightness 1.50 for moderate dark video, got ${settings.brightness}`);
  });

  // ==========================================
  // Feature 2: Seamless WebGPU Text Shader (R2)
  // ==========================================

  const renderWgslPath = path.resolve('src/engine/shaders/render.wgsl');
  const renderWgslContent = fs.readFileSync(renderWgslPath, 'utf8');

  record('test_r2_fc01_wgsl_shader_compilation_structure', 'R2: Text Shader', () => {
    assert.ok(renderWgslContent.includes('struct Uniforms'), 'WGSL shader must define Uniforms struct');
    assert.ok(renderWgslContent.includes('struct CellState'), 'WGSL shader must define CellState struct');
    assert.ok(renderWgslContent.includes('@vertex'), 'WGSL shader must define @vertex entrypoint');
    assert.ok(renderWgslContent.includes('@fragment'), 'WGSL shader must define @fragment entrypoint');
  });

  record('test_r2_fc02_no_background_color_quad_alpha_blending', 'R2: Text Shader', () => {
    assert.ok(
      renderWgslContent.includes('finalColor = finalColor * alpha'),
      'Fragment shader must multiply final color by alpha so only character ink carries color'
    );
    assert.ok(
      renderWgslContent.includes('return vec4<f32>(finalColor, alpha)'),
      'Fragment shader must return color premultiplied with pure alpha'
    );
  });

  record('test_r2_fc03_color_mode_palette_branches', 'R2: Text Shader', () => {
    assert.ok(renderWgslContent.includes('uniforms.colorMode == 0u'), 'Shader must support True Color (mode 0)');
    assert.ok(renderWgslContent.includes('uniforms.colorMode == 1u'), 'Shader must support Matrix mode (mode 1)');
    assert.ok(renderWgslContent.includes('uniforms.colorMode == 2u'), 'Shader must support Amber CRT mode (mode 2)');
    assert.ok(renderWgslContent.includes('uniforms.colorMode == 3u'), 'Shader must support Monochrome mode (mode 3)');
  });

  record('test_r2_fc04_color_correction_pipeline', 'R2: Text Shader', () => {
    assert.ok(renderWgslContent.includes('fn applyColorCorrection'), 'Shader must define applyColorCorrection function');
    assert.ok(renderWgslContent.includes('uniforms.brightness'), 'Shader color correction must apply brightness');
    assert.ok(renderWgslContent.includes('uniforms.contrast'), 'Shader color correction must apply contrast');
    assert.ok(renderWgslContent.includes('uniforms.saturation'), 'Shader color correction must apply saturation');
  });

  record('test_r2_fc05_srgb_gamma_conversion', 'R2: Text Shader', () => {
    assert.ok(
      renderWgslContent.includes('pow(finalColor, vec3<f32>(1.0 / 2.2))'),
      'Shader must apply sRGB gamma correction (pow 1.0/2.2) to final color output'
    );
  });

  // ==========================================
  // Feature 3: Legacy .gef Format Purge (R3)
  // ==========================================

  record('test_r3_fc01_src_directory_zero_gef_matches', 'R3: GEF Purge', () => {
    const matches: string[] = [];
    function scan(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (/gef/i.test(content) || /gef/i.test(entry.name)) {
            matches.push(fullPath);
          }
        }
      }
    }
    scan(path.resolve('src'));
    assert.strictEqual(matches.length, 0, `Found legacy 'gef' references in src: ${matches.join(', ')}`);
  });

  record('test_r3_fc02_pxl_format_version_validation', 'R3: GEF Purge', () => {
    const pxlFilePath = path.resolve('src/engine/PxlFormat.ts');
    const content = fs.readFileSync(pxlFilePath, 'utf8');
    assert.ok(content.includes('formatVersion !== 1'), 'PxlFormat must validate formatVersion == 1');
    assert.ok(!/gef/i.test(content), 'PxlFormat.ts must contain zero legacy .gef references');
  });

  await recordAsync('test_r3_fc03_pxl_zip_structure', 'R3: GEF Purge', async () => {
    const dummyCellData = new Float32Array(8); // 1 cell
    dummyCellData[0] = 1.0; // r
    dummyCellData[1] = 0.5; // g
    dummyCellData[2] = 0.0; // b
    dummyCellData[3] = 1.0; // a
    dummyCellData[4] = 42;  // charIdx
    
    const packedFrame = PxlFormat.packFrame(dummyCellData);
    assert.strictEqual(packedFrame.length, 5, 'Packed cell must be 5 bytes per cell');

    const manifest = {
      formatVersion: 1,
      engineVersion: '1.0.0',
      fps: 30,
      resolution: { width: 10, height: 10 },
      frameCount: 1,
      settings: { brightness: 1, contrast: 1, saturation: 1, density: 10, colorMode: 0, renderMode: 0, quality: 1 },
      createdAt: new Date().toISOString()
    };

    const pxlBlob = await PxlFormat.createPxl(manifest, [packedFrame], null, null);
    assert.ok(pxlBlob.size > 0, 'Generated PXL Blob must not be empty');

    const buffer = new Uint8Array(await pxlBlob.arrayBuffer());
    const parsed = await PxlFormat.parsePxl(buffer as any);
    assert.strictEqual(parsed.manifest.formatVersion, 1, 'Parsed PXL format version must be 1');
    assert.strictEqual(parsed.frames.length, 1, 'Parsed PXL must contain 1 frame');
  });

  record('test_r3_fc04_ui_component_no_gef_references', 'R3: GEF Purge', () => {
    const uiDir = path.resolve('src/ui');
    const files = fs.readdirSync(uiDir);
    for (const file of files) {
      const content = fs.readFileSync(path.join(uiDir, file), 'utf8');
      assert.ok(!/gef/i.test(content), `UI component ${file} must not contain references to .gef`);
    }
  });

  record('test_r3_fc05_embed_ts_no_gef_references', 'R3: GEF Purge', () => {
    const embedTsPath = path.resolve('src/embed.ts');
    const content = fs.readFileSync(embedTsPath, 'utf8');
    assert.ok(!/gef/i.test(content), 'embed.ts must contain zero legacy .gef references');
  });

  // ==========================================
  // Feature 4: Embed Code Generator & URL Loader (R4)
  // ==========================================

  record('test_r4_fc01_embed_modal_code_snippet', 'R4: Embed Code Generator', () => {
    const modalPath = path.resolve('src/ui/EmbedModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');
    assert.ok(content.includes('embedCode'), 'EmbedModal must define embedCode variable');
    assert.ok(content.includes('.pxl'), 'Embed snippet must reference .pxl file');
  });

  record('test_r4_fc02_app_url_search_param_parsing', 'R4: Embed URL Loader', () => {
    const appPath = path.resolve('src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.ok(content.includes('URLSearchParams'), 'App.tsx must use URLSearchParams');
    assert.ok(content.includes('searchParams.get(\'src\')'), 'App.tsx must parse ?src= URL parameter');
  });

  record('test_r4_fc03_filename_derivation_from_src_url', 'R4: Embed URL Loader', () => {
    const appPath = path.resolve('src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.ok(content.includes('urlPath.split(\'/\').pop()'), 'App.tsx must extract filename from URL');
    assert.ok(content.includes('.endsWith(\'.pxl\')'), 'App.tsx must ensure filename ends with .pxl');
  });

  record('test_r4_fc04_custom_element_shadow_dom_registration', 'R4: Embed Script', () => {
    const embedPath = path.resolve('src/embed.ts');
    const content = fs.readFileSync(embedPath, 'utf8');
    assert.ok(content.includes('class GlyphPlayerElement extends HTMLElement'), 'embed.ts must define GlyphPlayerElement class');
    assert.ok(content.includes('customElements.define(\'glyph-player\', GlyphPlayerElement)'), 'embed.ts must register glyph-player custom element');
    assert.ok(content.includes('this.attachShadow'), 'GlyphPlayerElement must attach Shadow DOM');
  });

  record('test_r4_fc05_embed_fallback_preview', 'R4: Embed Script', () => {
    const embedPath = path.resolve('src/embed.ts');
    const content = fs.readFileSync(embedPath, 'utf8');
    assert.ok(content.includes('initFallback'), 'embed.ts must have fallback initialization for non-WebGPU browsers');
    assert.ok(content.includes('Playback requires WebGPU'), 'Fallback preview must display WebGPU requirement message');
  });

  return results;
}
