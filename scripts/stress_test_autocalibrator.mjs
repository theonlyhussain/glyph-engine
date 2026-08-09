import { AutoCalibrator } from '../src/engine/AutoCalibrator.ts';

console.log('=== Running Challenger M1 Stress Test Suite for AutoCalibrator ===\n');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

const edgeValues = [
  { avgLum: 0.0, expectedBrightness: 2.5, minBrightness: null },
  { avgLum: 0.01, expectedBrightness: 2.5, minBrightness: null },
  { avgLum: 0.449, expectedBrightness: 1.0, minBrightness: null },
  { avgLum: 0.45, expectedBrightness: 1.0, minBrightness: 1.0 },
  { avgLum: 0.451, expectedBrightness: 1.0, minBrightness: 1.0 },
  { avgLum: 0.85, expectedBrightness: 1.2, minBrightness: 1.0 },
  { avgLum: 0.95, expectedBrightness: 1.25, minBrightness: 1.0 },
  { avgLum: 1.00, expectedBrightness: 1.27, minBrightness: 1.0 }
];

for (const test of edgeValues) {
  const res = AutoCalibrator.calculateSettings(test.avgLum, 0.22, 0.40, 0.4);
  console.log(`avgLum = ${test.avgLum} -> result:`, res);
  
  if (test.minBrightness !== null) {
    assert(res.brightness >= test.minBrightness, `avgLum=${test.avgLum}: brightness >= ${test.minBrightness} (got ${res.brightness})`);
  }
  
  if (test.expectedBrightness !== null) {
    assert(res.brightness === test.expectedBrightness, `avgLum=${test.avgLum}: expected brightness ${test.expectedBrightness} (got ${res.brightness})`);
  }
  
  // Sanity checks on output bounds and non-NaN values
  assert(!isNaN(res.brightness), `avgLum=${test.avgLum}: brightness is not NaN`);
  assert(res.brightness >= 0.5 && res.brightness <= 2.5, `avgLum=${test.avgLum}: brightness within [0.5, 2.5] bounds`);
  assert(res.contrast >= 0.5 && res.contrast <= 2.5, `avgLum=${test.avgLum}: contrast within [0.5, 2.5] bounds`);
  assert(res.saturation >= 0.5 && res.saturation <= 2.5, `avgLum=${test.avgLum}: saturation within [0.5, 2.5] bounds`);
  assert(Number.isInteger(res.density), `avgLum=${test.avgLum}: density is integer`);
}

// Additional stress testing across continuous fine steps from 0.440 to 0.460
console.log('\n--- Step continuity check around threshold 0.45 ---');
let prevBrightness = null;
for (let lum = 0.440; lum <= 0.460; lum += 0.001) {
  const roundedLum = Math.round(lum * 1000) / 1000;
  const res = AutoCalibrator.calculateSettings(roundedLum, 0.22, 0.40, 0.4);
  if (roundedLum >= 0.45) {
    assert(res.brightness >= 1.0, `Continuous check lum=${roundedLum}: brightness >= 1.0 (got ${res.brightness})`);
  }
  if (prevBrightness !== null) {
    const diff = Math.abs(res.brightness - prevBrightness);
    assert(diff <= 0.05, `Continuity jump at lum=${roundedLum}: diff=${diff} <= 0.05`);
  }
  prevBrightness = res.brightness;
}

console.log('\n==================================================');
if (failures > 0) {
  console.error(`❌ STRESS TEST FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('🎉 ALL STRESS TESTS PASSED SUCCESSFULLY!');
}
