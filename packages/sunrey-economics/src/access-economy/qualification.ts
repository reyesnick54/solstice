/**
 * ACCESS-13 end-to-end Access Economy qualification.
 *
 * Produces the engineering qualification payload for the Access Fabric.
 * ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE is an engineering statement about
 * this repository. It is not PRODUCTION_READY, it is not
 * LIVE_CONNECTIVITY_ENABLED, and it is not PRODUCTION_ACTIVE. Those states
 * stay false and are not derived from a passing test run.
 */

import {
  ACCESS_ECONOMY_INVARIANT_IDS,
  ACCESS_ECONOMY_LABEL,
  ACCESS_ECONOMY_SCHEMA_VERSION,
  ACCESS_ECONOMY_TOOL_VERSION,
  ACCESS_FABRIC_QUALIFICATION_STATE,
} from './ids.ts';
import { ACCESS_ECONOMY_CATALOG, accessCatalogComplete } from './catalog.ts';
import { executeAccessScenario } from './engine.ts';
import type {
  AccessEconomyQualificationReport,
  AccessEconomyScenarioResult,
  AccessInvariantResult,
} from './types.ts';

export const REMAINING_SIMULATED_DEPENDENCIES: readonly string[] = Object.freeze([
  'Productive capacity comes from the Chunk 75 dual-economy simulator, not from a metered provider feed.',
  'Execution Authority references are fixtures that stand in for authorities the Compliance Kernel issues elsewhere.',
  'Provider availability, outage, and settlement failure are injected scenario conditions, not observed provider telemetry.',
  'Exchange quote availability is a scenario switch, not a live canonical Exchange session.',
  'Custody and ledger settlement are attributed to their canonical owners without executing a real journal.',
]);

export const REMAINING_REAL_WORLD_PROVIDER_REQUIREMENTS: readonly string[] = Object.freeze([
  'Certified capacity providers per experience class, admitted through the Chunk 128 provider certification gate.',
  'Per-location and per-date inventory feeds with freshness guarantees for every published capacity bucket.',
  'Contractual overbooking and cancellation terms per provider, expressed as policy rather than code defaults.',
  'Identity and residency verification providers able to answer jurisdiction questions the policy plane asks.',
  'Settlement rails bound to the canonical ledger and custody owners under signed Execution Authority.',
]);

export const REMAINING_LEGAL_GATES: readonly string[] = Object.freeze([
  'Counsel review of access entitlement provenance per corridor; unknown corridors stay RESEARCH_REQUIRED and disabled.',
  'Consumer-protection review of refusal reason codes and of what a person is told when access is refused.',
  'Data-protection review of the evidence payload schema, including the sensitive-key deny list.',
  'Non-discrimination review of the policy priority bands used for deterministic queue ordering.',
  'Confirmation that access entitlements are not a payment instrument, deposit, security, or e-money in each corridor.',
]);

export function qualifyAccessEconomy(options?: { readonly seed?: number }): AccessEconomyQualificationReport {
  const results: AccessEconomyScenarioResult[] = ACCESS_ECONOMY_CATALOG.map((scenario) =>
    executeAccessScenario(
      options?.seed === undefined ? scenario : Object.freeze({ ...scenario, seed: options.seed }),
    ),
  );

  const violations: AccessInvariantResult[] = [];
  for (const result of results) {
    for (const row of result.invariants) {
      if (!row.held) {
        violations.push(row);
      }
    }
  }

  const oversoldUnits = results.reduce((sum, row) => sum + row.oversoldUnits, 0n);
  const evidenceChainsVerified = results.every((row) => row.evidence.chainVerified);
  const allInvariantsHeld = violations.length === 0;
  const qualified = allInvariantsHeld && evidenceChainsVerified && oversoldUnits === 0n && accessCatalogComplete();

  return Object.freeze({
    schemaVersion: ACCESS_ECONOMY_SCHEMA_VERSION,
    toolVersion: ACCESS_ECONOMY_TOOL_VERSION,
    simulationLabel: ACCESS_ECONOMY_LABEL,
    seed: options?.seed ?? 0,
    scenarioCount: results.length,
    results: Object.freeze(results),
    invariants: ACCESS_ECONOMY_INVARIANT_IDS,
    invariantViolations: Object.freeze(violations),
    allInvariantsHeld,
    evidenceChainsVerified,
    oversoldUnits,
    refusalsAreFirstClass: true,
    qualificationState: qualified ? ACCESS_FABRIC_QUALIFICATION_STATE : 'ACCESS_FABRIC_NOT_QUALIFIED',
    productionPosture: {
      PRODUCTION_READY: false as const,
      LIVE_CONNECTIVITY_ENABLED: false as const,
      PRODUCTION_ACTIVE: false as const,
      changedByThisRun: false as const,
    },
    remainingSimulatedDependencies: REMAINING_SIMULATED_DEPENDENCIES,
    remainingRealWorldProviderRequirements: REMAINING_REAL_WORLD_PROVIDER_REQUIREMENTS,
    remainingLegalGates: REMAINING_LEGAL_GATES,
  });
}

/** Compact summary for CI logs and for the release qualification payload. */
export function renderAccessQualification(report: AccessEconomyQualificationReport): string {
  const lines = [
    `access-economy qualification  label=${report.simulationLabel}  tool=${report.toolVersion}`,
    `state=${report.qualificationState}`,
    `scenarios=${report.scenarioCount}  invariants=${report.invariants.length}  violations=${report.invariantViolations.length}`,
    `oversoldUnits=${report.oversoldUnits}  evidenceChainsVerified=${report.evidenceChainsVerified}`,
    'production posture unchanged: PRODUCTION_READY=false LIVE_CONNECTIVITY_ENABLED=false PRODUCTION_ACTIVE=false',
    '',
  ];
  for (const result of report.results) {
    const counts = Object.entries(result.outcomeCounts)
      .map(([outcome, count]) => `${outcome}=${count}`)
      .sort()
      .join(' ');
    lines.push(
      `${result.scenarioId}  scarcity=${result.scarcityMode}/${result.scarcityDimension}  published=${result.totalPublishedUnits}  granted=${result.totalGrantedUnits}`,
    );
    lines.push(`  ${counts}`);
  }
  return lines.join('\n');
}
