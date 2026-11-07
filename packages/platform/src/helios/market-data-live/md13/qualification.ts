/**
 * MD13 qualification marker — HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED
 */

import { runMd13LiveDataResilienceHarness } from './harness.ts';
import { MD13_SLO_DIMENSIONS } from './taxonomy.ts';
import type { Md13QualificationReport } from './types.ts';

export const HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED =
  'HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED' as const;
export const HELIOS_MD13_LIVE_DATA_RESILIENCE_BLOCKED =
  'HELIOS_MD13_LIVE_DATA_RESILIENCE_BLOCKED' as const;

export type Md13LiveDataResilienceQualification = {
  readonly marker:
    | typeof HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED
    | typeof HELIOS_MD13_LIVE_DATA_RESILIENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly report: Md13QualificationReport;
};

export function evaluateMd13LiveDataResilienceQualification(
  report: Md13QualificationReport = runMd13LiveDataResilienceHarness(),
): Md13LiveDataResilienceQualification {
  const blockers: string[] = [];

  if (!report.feedScopedSlo) {
    blockers.push('slo_not_feed_scoped');
  }
  if (report.sloDimensionsDeclared.length !== MD13_SLO_DIMENSIONS.length) {
    blockers.push('slo_dimensions_incomplete');
  }
  if (!report.allScenariosPassed) {
    for (const row of report.scenarios) {
      if (!row.passed) blockers.push(`chaos:${row.scenarioId}`);
    }
  }

  const qualified = blockers.length === 0;
  const marker = qualified
    ? HELIOS_MD13_LIVE_DATA_RESILIENCE_QUALIFIED
    : HELIOS_MD13_LIVE_DATA_RESILIENCE_BLOCKED;

  return Object.freeze({
    marker,
    qualified,
    blockers: Object.freeze(blockers),
    report,
  });
}
