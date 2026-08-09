import { AutoCalibrator } from '../src/engine/AutoCalibrator.ts';

console.log('=== Challenger M1-1 Comprehensive Stress Test Suite ===\n');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ STRESS FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ STRESS PASS: ${message}`);
  }
}

// 1. Specified Edge Values in DISPATCH: 0.0, 0.01, 0.449, 0.45, 0.451, 0.85, 0.95, 1.0
const testCases = [
  { avgLum: 0.0, expectMinBright: 0.5, expectMaxBright: 2.5 },
  { avgLum: 0.01, expectMinBright: 0.5, expectMaxBright: 2.5 },
  { avgLum: 0.449, expectMinBright: 0.5, expectMaxBright: 2.5 },
  { avgLum: 0.45, expectMinBright: 1.0, expectMaxBright: 2.5 },
  { avgLum: 0.451, expectMinBright: 1.0, expectMaxBright: 2.5 },
  { avgLum: 0.85, expectMinBright: 1.0, expectMaxBright: 2.5 },
  { avgLum: 0.95, expectMinBright: 1.0, expectMaxBright: 2.5 },
  { avgLum: 1.0, expectMinBright: 1.0, expectMaxBright: 2.5 },
];

console.log('--- Phase 1: Explicit Edge Cases ---');
for (const tc of testCases) {
  const res = AutoCalibrator.calculateSettings(tc.avgLum, 0.22, 0.40, 0.4);
  console.log(`avgLum = ${tc.avgLum} -> result:`, res);
  assert(
    res.brightness >= tc.expectMinBright && res.brightness <= tc.expectMaxBright,
    `avgLum=${tc.avgLum} brightness ${res.brightness} within [${tc.expectMinBright}, ${tc.expectMaxBright}]`
  );
  if (tc.avgLum >= 0.45) {
    assert(res.brightness >= 1.0, `avgLum=${tc.avgLum} >= 0.45 guarantees brightness >= 1.0 (got ${res.brightness})`);
  }
}

console.log('\n--- Phase 2: High Resolution Range Sweep (0.45 to 1.00) ---');
let sweepFailures = 0;
for (let lum = 0.45; lum <= 1.00001; lum += 0.0001) {
  const lumFixed = parseFloat(lum.toFixed(5));
  const res = AutoCalibrator.calculateSettings(lumFixed, 0.22, 0.40, 0.4);
  if (res.brightness < 1.0) {
    console.error(`❌ Sweep Failure at avgLum=${lumFixed}: brightness=${res.brightness} (< 1.0)`);
    sweepFailures++;
  }
}
assert(sweepFailures === 0, `Sweep 0.45..1.00 (5,500 samples): 0 failures out of 5500 checks`);

console.log('\n--- Phase 3: Other Parameters Robustness (std, sat, detail) ---');
const stdValues = [0.0, 0.01, 0.1, 0.22, 0.3, 0.5, 1.0];
const satValues = [0.0, 0.01, 0.2, 0.4, 0.8, 1.0];
const detailValues = [0.0, 0.299, 0.3, 0.301, 0.499, 0.5, 0.501, 1.0];

let paramFailures = 0;
for (const std of stdValues) {
  for (const sat of satValues) {
    for (const detail of detailValues) {
      const res = AutoCalibrator.calculateSettings(0.85, std, sat, detail);
      if (res.brightness < 1.0 || isNaN(res.contrast) || isNaN(res.saturation) || isNaN(res.density)) {
        console.error(`❌ Param Failure at std=${std}, sat=${sat}, detail=${detail}:`, res);
        paramFailures++;
      }
    }
  }
}
assert(paramFailures === 0, `Param matrix sweep (336 combinations): 0 failures`);

console.log('\n==========================================');
if (failures > 0) {
  console.error(`RESULT: STRESS TESTS FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('RESULT: ALL STRESS TESTS PASSED PERFECTLY!');
}
