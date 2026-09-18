/**
 * HELIOS H31 — expensive chaos qualification (not part of default npm test).
 * Run via: npm run helios:h31:qualify
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateHeliosResilienceQualification,
  runAllResilienceScenarios,
  serializeResilienceReport,
} from '../packages/platform/src/helios/resilience/index.ts';

const CHAOS_ENABLED = process.env.HELIOS_CHAOS_QUALIFY === '1';

describe('HELIOS H31 — chaos qualification', { skip: !CHAOS_ENABLED }, () => {
  it('runs full FAST_CI + CHAOS qualification and writes report summary', async () => {
    const scenarios = await runAllResilienceScenarios();
    const qualification = evaluateHeliosResilienceQualification({
      generatedAt: new Date().toISOString(),
      tier: 'FULL',
      scenarios,
    });

    const report = serializeResilienceReport(qualification.report);
    console.log(report);

    assert.ok(qualification.report.summary.total >= 50);
    assert.ok(qualification.report.recoveryMetrics.duplicateSuppressionRate !== null);

    if (!qualification.qualified) {
      console.error('HELIOS resilience blocked:', qualification.blockers.join('; '));
    }

    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
  });
});
