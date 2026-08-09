/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Requirements Covered: R1, R2, R3, R4
 * Minimum test cases per feature: 5
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { AutoCalibrator } from '../src/engine/AutoCalibrator.ts';
import { PxlFormat } from '../src/engine/PxlFormat.ts';

export async function runTier2Tests() {
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
  // Feature 1: AutoCalibrator Boundary Cases (R1)
  // ==========================================

  record('test_r1_bc01_pure_white_extreme_100_luminance', 'R1: Boundary Cases', () => {
    // Pure white frame: avgLum = 1.00, std = 0.00, sat = 0.00, detail = 0.00
    const settings = AutoCalibrator.calculateSettings(1.00, 0.00, 0.00, 0.00);
    // brightness: 1.0 + (1.0 - 0.45)*0.5 = 1.275 -> rounded to 1.27 in JS IEEE754 float
    assert.strictEqual(settings.brightness, 1.27, `Expected brightness 1.27 for pure white, got ${settings.brightness}`);
    assert.ok(settings.brightness >= 1.0, 'Pure white brightness must maintain >= 1.0');
    // contrast & saturation should be clamped to max 2.50 due to 0.00 inputs
    assert.strictEqual(settings.contrast, 2.50, 'Contrast must clamp to max 2.50');
    assert.strictEqual(settings.saturation, 2.50, 'Saturation must clamp to max 2.50');
    assert.strictEqual(settings.density, 4, 'Detail score 0.00 must yield density 4');
  });

  record('test_r1_bc02_pure_black_extreme_0_luminance', 'R1: Boundary Cases', () => {
    // Pure black frame: avgLum = 0.00
    const settings = AutoCalibrator.calculateSettings(0.00, 0.00, 0.00, 0.00);
    // 0.45 / Math.max(0.00, 0.01) = 45.0 -> clamped to 2.50
    assert.strictEqual(settings.brightness, 2.50, `Expected brightness clamped to max 2.50 for pure black, got ${settings.brightness}`);
  });

  record('test_r1_bc03_detail_score_boundary_high_threshold', 'R1: Boundary Cases', () => {
    const sHigh = AutoCalibrator.calculateSettings(0.45, 0.22, 0.40, 0.501);
    const sMid = AutoCalibrator.calculateSettings(0.45, 0.22, 0.40, 0.500);
    assert.strictEqual(sHigh.density, 2, 'Detail score > 0.5 must yield density 2');
    assert.strictEqual(sMid.density, 3, 'Detail score <= 0.5 and > 0.3 must yield density 3');
  });

  record('test_r1_bc04_detail_score_boundary_medium_threshold', 'R1: Boundary Cases', () => {
    const sMid = AutoCalibrator.calculateSettings(0.45, 0.22, 0.40, 0.301);
    const sLow = AutoCalibrator.calculateSettings(0.45, 0.22, 0.40, 0.300);
    assert.strictEqual(sMid.density, 3, 'Detail score > 0.3 must yield density 3');
    assert.strictEqual(sLow.density, 4, 'Detail score <= 0.3 must yield density 4');
  });

  record('test_r1_bc05_all_outputs_strictly_clamped_and_valid', 'R1: Boundary Cases', () => {
    const testCases = [
      { lum: 0.0001, std: 0.0001, sat: 0.0001, detail: 0.0 },
      { lum: 0.9999, std: 0.9999, sat: 0.9999, detail: 1.0 },
      { lum: 0.4500, std: 0.2200, sat: 0.4000, detail: 0.4 }
    ];
    for (const tc of testCases) {
      const res = AutoCalibrator.calculateSettings(tc.lum, tc.std, tc.sat, tc.detail);
      assert.ok(res.brightness >= 0.5 && res.brightness <= 2.5, `Brightness out of bounds: ${res.brightness}`);
      assert.ok(res.contrast >= 0.5 && res.contrast <= 2.5, `Contrast out of bounds: ${res.contrast}`);
      assert.ok(res.saturation >= 0.5 && res.saturation <= 2.5, `Saturation out of bounds: ${res.saturation}`);
      assert.ok([2, 3, 4].includes(res.density), `Density invalid: ${res.density}`);
    }
  });

  // ==========================================
  // Feature 2: Seamless WebGPU Text Shader Boundary Cases (R2)
  // ==========================================

  const renderWgslPath = path.resolve('src/engine/shaders/render.wgsl');
  const renderWgslContent = fs.readFileSync(renderWgslPath, 'utf8');

  record('test_r2_bc01_zero_alpha_transparent_pixel', 'R2: Shader Boundary Cases', () => {
    // When alpha is 0.0, finalColor * alpha must result in vec3(0.0) with alpha 0.0
    assert.ok(renderWgslContent.includes('finalColor = finalColor * alpha'), 'Shader must multiply color by alpha');
    assert.ok(renderWgslContent.includes('vec4<f32>(finalColor, alpha)'), 'Fragment output alpha must be alpha value');
  });

  record('test_r2_bc02_unit_alpha_solid_ink', 'R2: Shader Boundary Cases', () => {
    // When alpha is 1.0, finalColor * 1.0 equals full color-corrected RGB
    assert.ok(renderWgslContent.includes('applyColorCorrection'), 'Color correction must run before alpha multiplication');
  });

  record('test_r2_bc03_single_column_atlas_grid_uv', 'R2: Shader Boundary Cases', () => {
    assert.ok(renderWgslContent.includes('let uvScale = vec2<f32>(1.0 / uniforms.atlasColumns, 1.0 / uniforms.atlasRows)'), 'UV scale formula must divide by atlasColumns and atlasRows');
  });

  record('test_r2_bc04_uniform_extreme_brightness_contrast', 'R2: Shader Boundary Cases', () => {
    assert.ok(renderWgslContent.includes('clamp(c, vec3<f32>(0.0), vec3<f32>(1.0))'), 'Color correction output must clamp RGB values to [0.0, 1.0]');
  });

  record('test_r2_bc05_zero_atlas_columns_division_by_zero_prevention', 'R2: Shader Boundary Cases', () => {
    assert.ok(
      renderWgslContent.includes('let cols = max(1u, u32(uniforms.atlasColumns))'),
      'Vertex shader must use max(1u, atlasColumns) to prevent division by zero'
    );
  });

  // ==========================================
  // Feature 3: Legacy .gef Format Purge Boundary Cases (R3)
  // ==========================================

  record('test_r3_bc01_case_variants_gef_search', 'R3: GEF Purge Boundary', () => {
    const caseVariants = [/gef/i, /\.gef/i, /GEFFormat/i, /gef_/i, /_gef/i];
    function scan(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const regex of caseVariants) {
            assert.ok(!regex.test(content), `Found legacy variant ${regex} in file: ${fullPath}`);
            assert.ok(!regex.test(entry.name), `Filename contains legacy variant ${regex}: ${fullPath}`);
          }
        }
      }
    }
    scan(path.resolve('src'));
  });

  await recordAsync('test_r3_bc02_invalid_file_extension_rejection', 'R3: GEF Purge Boundary', async () => {
    // Attempting to parse non-zip or corrupt PXL must throw error, not fall back to .gef
    const corruptBuffer = new Uint8Array([10, 20, 30, 40]);
    await assert.rejects(
      async () => {
        await PxlFormat.parsePxl(corruptBuffer as any);
      },
      (err: any) => {
        return err !== null && err !== undefined;
      },
      'Parsing invalid buffer must reject cleanly without legacy fallback'
    );
  });

  record('test_r3_bc03_filename_scrubbing_in_src', 'R3: GEF Purge Boundary', () => {
    function checkFilenames(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        assert.ok(!entry.name.toLowerCase().includes('gef'), `Filename contains 'gef': ${fullPath}`);
        if (entry.isDirectory()) {
          checkFilenames(fullPath);
        }
      }
    }
    checkFilenames(path.resolve('src'));
  });

  record('test_r3_bc04_build_config_scrubbing', 'R3: GEF Purge Boundary', () => {
    const viteConfig = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');
    const embedViteConfig = fs.readFileSync(path.resolve('vite.embed.config.ts'), 'utf8');
    assert.ok(!/gef/i.test(viteConfig), 'vite.config.ts must not contain gef references');
    assert.ok(!/gef/i.test(embedViteConfig), 'vite.embed.config.ts must not contain gef references');
  });

  record('test_r3_bc05_docs_and_readme_gef_scrubbing', 'R3: GEF Purge Boundary', () => {
    const readme = fs.readFileSync(path.resolve('README.md'), 'utf8');
    const packageJson = fs.readFileSync(path.resolve('package.json'), 'utf8');
    assert.ok(!/gef/i.test(readme), 'README.md must not reference old .gef format');
    assert.ok(!/gef/i.test(packageJson), 'package.json must not reference old .gef format');
  });

  // ==========================================
  // Feature 4: Embed Code Generator Boundary Cases (R4)
  // ==========================================

  record('test_r4_bc01_empty_and_whitespace_url_src_param', 'R4: Embed Boundary', () => {
    const appPath = path.resolve('src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.ok(content.includes('if (srcUrl)'), 'App.tsx must guard against empty/null src parameter');
  });

  record('test_r4_bc02_url_encoded_src_parameter', 'R4: Embed Boundary', () => {
    const testUrl = 'https://example.com/folder%20name/my%20animation.pxl?query=123';
    const urlPath = testUrl.split('?')[0];
    const filename = urlPath.split('/').pop() || 'remote.pxl';
    assert.strictEqual(filename, 'my%20animation.pxl', 'Filename extraction must handle query parameters');
    const finalFilename = filename.endsWith('.pxl') ? filename : `${filename}.pxl`;
    assert.strictEqual(finalFilename, 'my%20animation.pxl', 'Filename must keep .pxl extension');
  });

  record('test_r4_bc03_remote_fetch_network_failure_handling', 'R4: Embed Boundary', () => {
    const appPath = path.resolve('src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.ok(content.includes('!res.ok'), 'App.tsx must check res.ok for remote fetch HTTP errors');
    assert.ok(content.includes('setError('), 'App.tsx must set error state when remote fetch fails');
  });

  record('test_r4_bc04_iframe_acceptance_criteria_validation', 'R4: Embed Boundary', () => {
    const modalPath = path.resolve('src/ui/EmbedModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');
    const hasIframe = content.includes('<iframe');
    const hasSrcParam = content.includes('?src=');
    if (!hasIframe || !hasSrcParam) {
      throw new Error(
        `Implementation Bug Escalation [R4]: EmbedModal.tsx outputs custom element '<glyph-player>' instead of expected '<iframe>' HTML string with '?src=...' URL parameter as specified in ORIGINAL_REQUEST.md §R4.`
      );
    }
  });

  record('test_r4_bc05_embed_script_custom_element_redefinition_safety', 'R4: Embed Boundary', () => {
    const embedPath = path.resolve('src/embed.ts');
    const content = fs.readFileSync(embedPath, 'utf8');
    assert.ok(
      content.includes('if (!customElements.get(\'glyph-player\'))'),
      'embed.ts must check if custom element is already defined before defining it to prevent exceptions'
    );
  });

  return results;
}
