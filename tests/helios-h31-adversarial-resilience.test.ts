/**
 * HELIOS H31 — fast CI adversarial / failure / resilience qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_H31_ADVERSARIAL_RESILIENCE,
  HELIOS_RESILIENCE_QUALIFIED,
  evaluateHeliosResilienceQualification,
  runResilienceScenarios,
  serializeResilienceReport,
} from '../packages/platform/src/helios/resilience/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS H31 — adversarial failure and resilience qualification (fast CI)', () => {
  it('architecture guard: resilience module stays within canonical helios owner', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) => row.file.includes('helios/resilience'));
    assert.equal(findings.length, 0);
  });

  it('runs FAST_CI resilience scenarios and emits machine-readable report', async () => {
    const scenarios = await runResilienceScenarios('FAST_CI');
    assert.ok(scenarios.length >= 40, `expected substantial fast suite, got ${scenarios.length}`);

    const qualification = evaluateHeliosResilienceQualification({
      generatedAt: new Date().toISOString(),
      tier: 'FAST_CI',
      scenarios,
    });

    const reportJson = serializeResilienceReport(qualification.report);
    assert.ok(reportJson.includes('"testId"'));
    assert.ok(reportJson.includes('"invariantResults"'));
    assert.ok(reportJson.includes('"recoveryMetrics"'));

    for (const row of scenarios) {
      assert.ok(row.testId.startsWith('H31-'), row.testId);
      assert.ok(row.expectedBehavior.length > 0);
      assert.ok(row.observedBehavior.length > 0);
      assert.ok(row.invariantResults.length > 0);
    }

    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_RESILIENCE_QUALIFIED);
    assert.equal(qualification.report.summary.criticalFailures, 0);
  });

  it('chunk marker HELIOS_H31_ADVERSARIAL_RESILIENCE is defined', () => {
    assert.equal(HELIOS_H31_ADVERSARIAL_RESILIENCE, 'HELIOS_H31_ADVERSARIAL_RESILIENCE');
  });
});
