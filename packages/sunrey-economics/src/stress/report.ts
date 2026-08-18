/**
 * Machine-readable and human-readable EconomicStressReport.
 */

import { execSync } from 'node:child_process';

import { ECONOMIC_INVARIANT_IDS, ECONOMIC_STRESS_LABEL, ECONOMIC_STRESS_SCHEMA_VERSION, ECONOMIC_STRESS_TOOL_VERSION } from './ids.ts';
import type { EconomicStressReport, EconomicStressResult } from './types.ts';

export function sourceCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'WORKTREE';
  }
}

export function buildStressReport(input: {
  readonly campaignId: string;
  readonly seed: number;
  readonly results: readonly EconomicStressResult[];
  readonly labElapsedMs: number;
}): EconomicStressReport {
  const openFindings = input.results.flatMap((row) => row.findings.filter((finding) => finding.verificationState === 'OPEN' && finding.severity !== 'INFO'));
  const policyVersions = input.results[0]?.policyVersions ?? {};
  const recovered = input.results.filter((row) => row.recovery.recoveredAutomatically).length;
  const operator = input.results.filter((row) => row.recovery.requiredOperatorAction).length;
  return Object.freeze({
    schemaVersion: ECONOMIC_STRESS_SCHEMA_VERSION,
    toolVersion: ECONOMIC_STRESS_TOOL_VERSION,
    classification: ECONOMIC_STRESS_LABEL,
    commit: sourceCommit(),
    policyVersions,
    campaignId: input.campaignId,
    scenarioCount: input.results.length,
    seed: input.seed,
    invariants: ECONOMIC_INVARIANT_IDS,
    results: input.results,
    violations: input.results.filter((row) => !row.preservedInvariants).length,
    failClosedResults: input.results.filter((row) => row.failClosed).length,
    recovery: Object.freeze({
      preservedInvariants: input.results.every((row) => row.preservedInvariants),
      degradedAvailability: input.results.some((row) => row.degradedAvailability),
      recoveredAutomatically: recovered > 0,
      requiredOperatorAction: operator > 0,
      leftUnresolvedFinding: openFindings.length > 0,
    }),
    concentrationWarnings: Object.freeze(input.results.flatMap((row) => row.concentrationWarnings)),
    performanceContext: Object.freeze({
      labElapsedMs: input.labElapsedMs,
      notLiveBlockchainPerformance: true as const,
      protocolChecksWeakened: false as const,
    }),
    openFindings: Object.freeze(openFindings),
    productionAuthorization: false,
  });
}

export function renderStressReport(report: EconomicStressReport): string {
  const lines = [
    `EconomicStressReport ${report.campaignId}`,
    `classification=${report.classification} commit=${report.commit}`,
    `scenarios=${report.scenarioCount} violations=${report.violations} fail-closed=${report.failClosedResults}`,
    `open findings=${report.openFindings.length} productionAuthorization=${report.productionAuthorization}`,
    `lab elapsed ${report.performanceContext.labElapsedMs}ms (not live blockchain performance)`,
  ];
  for (const result of report.results) {
    lines.push(
      `${result.scenarioId} preserved=${result.preservedInvariants} failClosed=${result.failClosed} pending=${result.pendingOperations} seed=${result.seed} fixture=${result.inputFixtureHash.slice(0, 12)}`,
    );
  }
  return lines.join('\n');
}
