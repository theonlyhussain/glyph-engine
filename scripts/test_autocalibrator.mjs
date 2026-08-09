import { AutoCalibrator } from '../src/engine/AutoCalibrator.ts';

console.log('=== Running AutoCalibrator Verification Suite ===\n');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// 1. High mean luminance (bright video: avgLum = 0.85) -> brightness >= 1.0
const res085 = AutoCalibrator.calculateSettings(0.85, 0.22, 0.40, 0.4);
console.log('avgLum = 0.85 output settings:', res085);
assert(res085.brightness >= 1.0, `avgLum=0.85 maintains brightness >= 1.0 (got ${res085.brightness})`);
assert(res085.brightness === 1.20, `avgLum=0.85 expected brightness 1.20 (got ${res085.brightness})`);

// 2. High mean luminance (bright video: avgLum = 0.95) -> brightness >= 1.0
const res095 = AutoCalibrator.calculateSettings(0.95, 0.22, 0.40, 0.4);
console.log('avgLum = 0.95 output settings:', res095);
assert(res095.brightness >= 1.0, `avgLum=0.95 maintains brightness >= 1.0 (got ${res095.brightness})`);
assert(res095.brightness === 1.25, `avgLum=0.95 expected brightness 1.25 (got ${res095.brightness})`);

// 3. Pure white video: avgLum = 1.0 -> brightness >= 1.0
const res100 = AutoCalibrator.calculateSettings(1.00, 0.22, 0.40, 0.4);
console.log('avgLum = 1.00 output settings:', res100);
assert(res100.brightness >= 1.0, `avgLum=1.00 maintains brightness >= 1.0 (got ${res100.brightness})`);

// 4. Threshold video: avgLum = 0.45 -> brightness == 1.0
const res045 = AutoCalibrator.calculateSettings(0.45, 0.22, 0.40, 0.4);
console.log('avgLum = 0.45 output settings:', res045);
assert(res045.brightness === 1.00, `avgLum=0.45 threshold expected brightness 1.00 (got ${res045.brightness})`);

// 5. Dark video: avgLum = 0.20 -> brightness boosting > 1.0
const res020 = AutoCalibrator.calculateSettings(0.20, 0.22, 0.40, 0.4);
console.log('avgLum = 0.20 output settings:', res020);
assert(res020.brightness === 2.25, `avgLum=0.20 expected boosted brightness 2.25 (got ${res020.brightness})`);

console.log('');
if (failures > 0) {
  console.error(`Verification FAILED with ${failures} error(s).`);
  process.exit(1);
} else {
  console.log('🎉 All AutoCalibrator verification tests passed successfully!');
}
