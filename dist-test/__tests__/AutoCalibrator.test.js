import { AutoCalibrator } from '../AutoCalibrator';
/**
 * Unit tests for AutoCalibrator
 */
export function runAutoCalibratorTests() {
    console.log('Running AutoCalibrator Unit Tests...');
    let failures = 0;
    function assert(condition, message) {
        if (!condition) {
            console.error(`❌ FAIL: ${message}`);
            failures++;
        }
        else {
            console.log(`✅ PASS: ${message}`);
        }
    }
    // Test 1: Bright video with avgLum = 0.85 must maintain brightness >= 1.0 (not darkened)
    const result085 = AutoCalibrator.calculateSettings(0.85, 0.22, 0.40, 0.4);
    assert(result085.brightness >= 1.0, `Bright video (avgLum = 0.85) outputs brightness >= 1.0 (got ${result085.brightness})`);
    assert(result085.brightness === 1.2, `Bright video (avgLum = 0.85) expected brightness 1.20 (got ${result085.brightness})`);
    // Test 2: Bright video with avgLum = 0.95 must maintain brightness >= 1.0
    const result095 = AutoCalibrator.calculateSettings(0.95, 0.22, 0.40, 0.4);
    assert(result095.brightness >= 1.0, `Bright video (avgLum = 0.95) outputs brightness >= 1.0 (got ${result095.brightness})`);
    assert(result095.brightness === 1.25, `Bright video (avgLum = 0.95) expected brightness 1.25 (got ${result095.brightness})`);
    // Test 3: Pure white video with avgLum = 1.0 must maintain brightness >= 1.0
    const result100 = AutoCalibrator.calculateSettings(1.0, 0.22, 0.40, 0.4);
    assert(result100.brightness >= 1.0, `Pure white video (avgLum = 1.0) outputs brightness >= 1.0 (got ${result100.brightness})`);
    // Test 4: Threshold avgLum = 0.45 must output brightness = 1.0
    const result045 = AutoCalibrator.calculateSettings(0.45, 0.22, 0.40, 0.4);
    assert(result045.brightness === 1.0, `Threshold video (avgLum = 0.45) expected brightness 1.0 (got ${result045.brightness})`);
    // Test 5: Dark video with avgLum = 0.20 must boost brightness > 1.0
    const result020 = AutoCalibrator.calculateSettings(0.20, 0.22, 0.40, 0.4);
    assert(result020.brightness === 2.25, `Dark video (avgLum = 0.20) expected brightness 2.25 (got ${result020.brightness})`);
    if (failures > 0) {
        throw new Error(`AutoCalibrator tests failed with ${failures} failure(s).`);
    }
    console.log('All AutoCalibrator unit tests passed successfully!\n');
}
// Run immediately if executed directly via Node/tsx
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].includes('AutoCalibrator.test')) {
    runAutoCalibratorTests();
}
