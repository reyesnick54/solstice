/**
 * HELIOS H31 — machine-readable resilience qualification report.
 */

import type { HeliosResilienceInvariantResult } from './invariants.ts';
import type { ResilienceFailureDomain, ResilienceOutcome, ResilienceScenarioId, ResilienceSeverity } from './taxonomy.ts';
import { HELIOS_H31_RESILIENCE_SCHEMA } from './taxonomy.ts';

export type ResilienceScenarioReportRow = {
  readonly testId: ResilienceScenarioId;
  readonly domain: ResilienceFailureDomain;
  readonly failureInjected: string;
  readonly expectedBehavior: string;
  readonly observedBehavior: string;
  readonly outcome: ResilienceOutcome;
  readonly severity: ResilienceSeverity;
  readonly passed: boolean;
  readonly invariantResults: readonly HeliosResilienceInvariantResult[];
  readonly recoveryTimeMs: number | null;
  readonly dataLoss: boolean;
  readonly duplicateEffects: boolean;
  readonly remainingLimitation: string | null;
  readonly error: string | null;
};

export type ResilienceQualificationReport = {
  readonly schema: typeof HELIOS_H31_RESILIENCE_SCHEMA;
  readonly generatedAt: string;
  readonly sourceCommit: string | null;
  readonly tier: 'FAST_CI' | 'CHAOS_QUALIFICATION' | 'FULL';
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly criticalFailures: number;
    readonly invariantBreaches: number;
    readonly degradedButSafe: number;
  };
  readonly recoveryMetrics: {
    readonly maxRecoveryTimeMs: number | null;
    readonly avgRecoveryTimeMs: number | null;
    readonly duplicateSuppressionRate: number | null;
    readonly scenariosWithDataLoss: number;
  };
  readonly scenarios: readonly ResilienceScenarioReportRow[];
  readonly failedScenarios: readonly ResilienceScenarioReportRow[];
  readonly criticalInvariantBreaches: readonly HeliosResilienceInvariantResult[];
};

export function buildResilienceQualificationReport(input: {
  readonly generatedAt: string;
  readonly sourceCommit?: string | null;
  readonly tier: ResilienceQualificationReport['tier'];
  readonly scenarios: readonly ResilienceScenarioReportRow[];
  readonly criticalInvariantBreaches?: readonly HeliosResilienceInvariantResult[];
}): ResilienceQualificationReport {
  const passed = input.scenarios.filter((row) => row.passed).length;
  const failed = input.scenarios.length - passed;
  const criticalFailures = input.scenarios.filter(
    (row) => !row.passed && row.severity === 'CRITICAL',
  ).length;
  const invariantBreaches = input.scenarios.filter((row) => row.outcome === 'INVARIANT_BREACH').length;
  const degradedButSafe = input.scenarios.filter((row) => row.outcome === 'DEGRADED_BUT_SAFE').length;
  const failedScenarios = Object.freeze(input.scenarios.filter((row) => !row.passed));
  const recoveryTimes = input.scenarios
    .map((row) => row.recoveryTimeMs)
    .filter((value): value is number => value !== null);
  const maxRecoveryTimeMs = recoveryTimes.length > 0 ? Math.max(...recoveryTimes) : null;
  const avgRecoveryTimeMs =
    recoveryTimes.length > 0
      ? recoveryTimes.reduce((sum, value) => sum + value, 0) / recoveryTimes.length
      : null;
  const duplicateRows = input.scenarios.filter((row) => row.duplicateEffects);
  const duplicateSuppressionRate =
    input.scenarios.length > 0
      ? 1 - duplicateRows.length / input.scenarios.length
      : null;

  return Object.freeze({
    schema: HELIOS_H31_RESILIENCE_SCHEMA,
    generatedAt: input.generatedAt,
    sourceCommit: input.sourceCommit ?? null,
    tier: input.tier,
    summary: Object.freeze({
      total: input.scenarios.length,
      passed,
      failed,
      criticalFailures,
      invariantBreaches,
      degradedButSafe,
    }),
    recoveryMetrics: Object.freeze({
      maxRecoveryTimeMs,
      avgRecoveryTimeMs,
      duplicateSuppressionRate,
      scenariosWithDataLoss: input.scenarios.filter((row) => row.dataLoss).length,
    }),
    failedScenarios,
    criticalInvariantBreaches: Object.freeze(input.criticalInvariantBreaches ?? []),
    scenarios: Object.freeze([...input.scenarios]),
  });
}

export function serializeResilienceReport(report: ResilienceQualificationReport): string {
  return JSON.stringify(report, null, 2);
}
