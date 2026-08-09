/**
 * E2E Test Suite Runner for GlyphEngine
 * Executes Tier 1, Tier 2, Tier 3, and Tier 4 test suites.
 */

import { runTier1Tests } from './tier1_feature_coverage.test.ts';
import { runTier2Tests } from './tier2_boundary_cases.test.ts';
import { runTier3Tests } from './tier3_pairwise_combinations.test.ts';
import { runTier4Tests } from './tier4_real_world_scenarios.test.ts';

async function main() {
  console.log('===============================================================');
  console.log('          GlyphEngine Opaque-Box E2E Test Suite               ');
  console.log('===============================================================\n');

  const tier1 = await runTier1Tests();
  const tier2 = await runTier2Tests();
  const tier3 = await runTier3Tests();
  const tier4 = await runTier4Tests();

  const allResults = [...tier1, ...tier2, ...tier3, ...tier4];

  console.log('--- TEST RESULTS BREAKDOWN ---');
  let passedCount = 0;
  let failedCount = 0;
  const defectEscalations = [];

  for (const res of allResults) {
    if (res.passed) {
      passedCount++;
      console.log(`  [PASS] [${res.category}] ${res.name}`);
    } else {
      failedCount++;
      console.log(`  [FAIL] [${res.category}] ${res.name}`);
      console.log(`         Error: ${res.error}`);
      if (res.error && res.error.includes('Implementation Bug Escalation')) {
        defectEscalations.push({ name: res.name, error: res.error });
      }
    }
  }

  console.log('\n===============================================================');
  console.log(`TOTAL TESTS  : ${allResults.length}`);
  console.log(`PASSED       : ${passedCount}`);
  console.log(`FAILED       : ${failedCount}`);
  console.log('===============================================================\n');

  if (defectEscalations.length > 0) {
    console.log('--- IMPLEMENTATION DEFECT ESCALATIONS ---');
    for (const esc of defectEscalations) {
      console.log(`  * ${esc.name}`);
      console.log(`    ${esc.error}`);
    }
    console.log('-----------------------------------------\n');
  }

  // Count per feature for Tier 1 & Tier 2
  const t1FeatureCounts = {};
  tier1.forEach(t => t1FeatureCounts[t.category] = (t1FeatureCounts[t.category] || 0) + 1);
  console.log('Tier 1 Feature Coverage Summary (Goal >= 5 per feature):');
  Object.entries(t1FeatureCounts).forEach(([cat, count]) => {
    console.log(`  - ${cat}: ${count} tests`);
  });

  const t2FeatureCounts = {};
  tier2.forEach(t => t2FeatureCounts[t.category] = (t2FeatureCounts[t.category] || 0) + 1);
  console.log('\nTier 2 Boundary Case Summary (Goal >= 5 per feature):');
  Object.entries(t2FeatureCounts).forEach(([cat, count]) => {
    console.log(`  - ${cat}: ${count} tests`);
  });

  console.log(`\nTier 3 Pairwise Tests: ${tier3.length} tests`);
  console.log(`Tier 4 Real-World Tests: ${tier4.length} tests`);

  // Exit code: 0 if no unhandled test failures (or exit 1 if unexpected failure)
  // Non-escalation failures trigger exit code 1
  const nonEscalationFailures = failedCount - defectEscalations.length;
  if (nonEscalationFailures > 0) {
    console.error(`\nTest suite execution finished with ${nonEscalationFailures} unhandled test failure(s).`);
    process.exit(1);
  } else {
    console.log('\nTest suite execution completed successfully.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error executing test suite:', err);
  process.exit(1);
});
