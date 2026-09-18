/**
 * HELIOS H31 — resilience qualification gate and markers.
 */

import { criticalInvariantBreaches } from './invariants.ts';
import { buildResilienceQualificationReport, type ResilienceQualificationReport, type ResilienceScenarioReportRow } from './report.ts';

export const HELIOS_H31_ADVERSARIAL_RESILIENCE = 'HELIOS_H31_ADVERSARIAL_RESILIENCE' as const;
export const HELIOS_RESILIENCE_QUALIFIED = 'HELIOS_RESILIENCE_QUALIFIED' as const;
export const HELIOS_RESILIENCE_BLOCKED = 'HELIOS_RESILIENCE_BLOCKED' as const;

export type HeliosResilienceQualificationResult = {
  readonly marker: typeof HELIOS_RESILIENCE_QUALIFIED | typeof HELIOS_RESILIENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly report: ResilienceQualificationReport;
};

export function evaluateHeliosResilienceQualification(input: {
  readonly generatedAt: string;
  readonly sourceCommit?: string | null;
  readonly tier: ResilienceQualificationReport['tier'];
  readonly scenarios: readonly ResilienceScenarioReportRow[];
}): HeliosResilienceQualificationResult {
  const report = buildResilienceQualificationReport(input);
  const blockers: string[] = [];

  for (const row of report.failedScenarios) {
    if (row.severity === 'CRITICAL') {
      blockers.push(`${row.testId}: ${row.observedBehavior}${row.error ? ` (${row.error})` : ''}`);
    }
  }

  const breachedInvariants = report.scenarios.flatMap((row) => row.invariantResults.filter((inv) => !inv.held));
  for (const breach of criticalInvariantBreaches(breachedInvariants)) {
    blockers.push(`invariant ${breach.invariantId}: ${breach.detail}`);
  }

  const criticalFailures = report.scenarios.filter((row) => !row.passed && row.severity === 'CRITICAL');
  const qualified = criticalFailures.length === 0 && criticalInvariantBreaches(breachedInvariants).length === 0;

  if (qualified) {
    return Object.freeze({
      marker: HELIOS_RESILIENCE_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
      report,
    });
  }

  return Object.freeze({
    marker: HELIOS_RESILIENCE_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
    report,
  });
}
