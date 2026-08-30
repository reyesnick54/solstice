/**
 * ACCESS-22 full dual-economy access qualification.
 */

import {
  ACCESS_22_INVARIANT_IDS,
  ACCESS_22_LABEL,
  ACCESS_22_SCHEMA_VERSION,
  ACCESS_22_TOOL_VERSION,
  ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED,
  ACCESS_DUAL_ECONOMY_NOT_QUALIFIED,
  ACCESS_22_CI_SCALE_LEVELS,
  type Access22ScaleLevel,
} from './ids.ts';
import { ACCESS_22_CATALOG, access22CatalogComplete } from './catalog.ts';
import { runAgentStressSuite, agentStressPassed } from './agent-stress.ts';
import { runBenchmarkSuite, benchmarkTestsPassed } from './benchmark.ts';
import { runAccess22Campaign } from './campaign.ts';
import { executeAccess22Scenario } from './engine.ts';
import { runMonteCarloStream } from './monte-carlo.ts';
import { runPostScarcityTest } from './post-scarcity.ts';
import type { Access22InvariantResult, Access22QualificationReport } from './types.ts';

export const REMAINING_ECONOMIC_RESEARCH: readonly string[] = Object.freeze([
  'Empirical calibration of diminishing-returns curvature for access weighting under real holder distributions.',
  'Cross-corridor elasticity between productive capacity shocks and access fill rates.',
  'Long-horizon stability of dual-holder bonus under shifting SR/MR participation mixes.',
  'Sensitivity of provider concentration diagnostics to certified-provider admission rates.',
  'Interaction effects between exchange liquidity stress and access redemption completion at scale.',
]);

export const REMAINING_REGULATORY_REQUIREMENTS: readonly string[] = Object.freeze([
  'Counsel review of access allocation policy under consumer-protection frameworks per corridor.',
  'Confirmation that engineering stability classifications are not presented as investment advice.',
  'Data-protection review of stress-lab evidence payloads at 100k+ participant sampling.',
  'Non-discrimination review of policy priority bands under extreme concentration scenarios.',
  'Clarification that ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED is not PRODUCTION_ACTIVE.',
]);

export const REMAINING_PROVIDER_DEPENDENCIES: readonly string[] = Object.freeze([
  'Certified capacity providers per experience class (Chunk 128 gate).',
  'Per-location inventory feeds with freshness SLAs.',
  'Settlement rails bound to canonical ledger and custody under Execution Authority.',
  'Provider outage telemetry for top-provider and systemic-failure scenarios.',
  'Sandbox adapters for multi-leg travel composition (ACCESS-21 provider sandbox).',
]);

export function qualifyDualEconomyAccess(options?: {
  readonly seed?: number;
  readonly scaleLevels?: readonly Access22ScaleLevel[];
  readonly monteCarloRuns?: number;
}): Access22QualificationReport {
  const seed = options?.seed ?? 22_022;
  const scaleLevels = options?.scaleLevels ?? ACCESS_22_CI_SCALE_LEVELS;
  const monteCarloRuns = options?.monteCarloRuns ?? 50;

  const campaign = runAccess22Campaign({ seed });
  const benchmarkRuns = runBenchmarkSuite();
  const agentStress = runAgentStressSuite();
  const postScarcity = runPostScarcityTest();
  const monteCarlo = runMonteCarloStream(monteCarloRuns, seed);

  const violations: Access22InvariantResult[] = [];
  for (const result of campaign.results) {
    for (const row of result.invariants) {
      if (!row.held) {
        violations.push(row);
      }
    }
  }

  const scenariosPassed = campaign.results.filter((row) => row.allInvariantsHeld).length;
  const scenariosFailed = campaign.results.length - scenariosPassed;
  const allInvariantsHeld = violations.length === 0;
  const mechanismTestsPassed = campaign.results.every((row) => Object.values(row.mechanismTests).every(Boolean));
  const benchmarkTestsPassedFlag = benchmarkTestsPassed(benchmarkRuns);
  const agentStressPassedFlag = agentStressPassed(agentStress);
  const postScarcityPassed = postScarcity.passed;
  const monteCarloClean = monteCarlo.violations === 0;

  const qualified =
    access22CatalogComplete() &&
    allInvariantsHeld &&
    mechanismTestsPassed &&
    benchmarkTestsPassedFlag &&
    agentStressPassedFlag &&
    postScarcityPassed &&
    monteCarloClean &&
    scenariosFailed === 0;

  return Object.freeze({
    schemaVersion: ACCESS_22_SCHEMA_VERSION,
    toolVersion: ACCESS_22_TOOL_VERSION,
    simulationLabel: ACCESS_22_LABEL,
    seed,
    scaleLevelsTested: scaleLevels,
    scenarioCount: ACCESS_22_CATALOG.length,
    scenariosRun: campaign.results.length,
    scenariosPassed,
    scenariosFailed,
    invariantCount: ACCESS_22_INVARIANT_IDS.length,
    invariantViolations: Object.freeze(violations),
    allInvariantsHeld,
    mechanismTestsPassed,
    benchmarkTestsPassed: benchmarkTestsPassedFlag,
    agentStressPassed: agentStressPassedFlag,
    postScarcityPassed,
    monteCarloRuns: monteCarlo.runs,
    monteCarloViolations: monteCarlo.violations,
    qualificationState: qualified ? ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED : ACCESS_DUAL_ECONOMY_NOT_QUALIFIED,
    productionPosture: Object.freeze({
      PRODUCTION_READY: false as const,
      LIVE_CONNECTIVITY_ENABLED: false as const,
      PRODUCTION_ACTIVE: false as const,
      changedByThisRun: false as const,
    }),
    results: campaign.results,
    benchmarkRuns,
    agentStress,
    remainingEconomicResearch: REMAINING_ECONOMIC_RESEARCH,
    remainingRegulatoryRequirements: REMAINING_REGULATORY_REQUIREMENTS,
    remainingProviderDependencies: REMAINING_PROVIDER_DEPENDENCIES,
  });
}

export function renderAccess22Qualification(report: Access22QualificationReport): string {
  const lines = [
    `ACCESS-22 dual-economy access qualification  label=${report.simulationLabel}  tool=${report.toolVersion}`,
    `state=${report.qualificationState}`,
    `scenarios=${report.scenariosRun} passed=${report.scenariosPassed} failed=${report.scenariosFailed}`,
    `invariants=${report.invariantCount} violations=${report.invariantViolations.length}`,
    `mechanismTests=${report.mechanismTestsPassed} benchmark=${report.benchmarkTestsPassed} agent=${report.agentStressPassed} postScarcity=${report.postScarcityPassed}`,
    `monteCarlo runs=${report.monteCarloRuns} violations=${report.monteCarloViolations}`,
    'production posture unchanged: PRODUCTION_READY=false LIVE_CONNECTIVITY_ENABLED=false PRODUCTION_ACTIVE=false',
    '',
  ];
  for (const result of report.results.slice(0, 10)) {
    lines.push(
      `${result.scenarioId} scale=${result.scaleLevel} invariants=${result.allInvariantsHeld} allocatable=${result.epochs[0]?.allocatableUnits ?? 0n}`,
    );
  }
  if (report.results.length > 10) {
    lines.push(`... ${report.results.length - 10} more scenario results`);
  }
  return lines.join('\n');
}
