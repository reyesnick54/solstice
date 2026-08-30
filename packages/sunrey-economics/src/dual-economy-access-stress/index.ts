/**
 * ACCESS-22 Dual-Economy Access Stress Laboratory public surface.
 *
 * Owned by packages/sunrey-economics. Not a second simulation system,
 * ledger, Exchange, custody system, or monetary authority.
 */

export {
  ACCESS_22_BENCHMARK_PARTICIPANT_ID,
  ACCESS_22_CI_SCALE_LEVELS,
  ACCESS_22_HEAVY_SCALE_LEVELS,
  ACCESS_22_INVARIANT_IDS,
  ACCESS_22_LABEL,
  ACCESS_22_POLICY_VERSIONS,
  ACCESS_22_SCENARIO_IDS,
  ACCESS_22_SCHEMA_VERSION,
  ACCESS_22_SCALE_LEVELS,
  ACCESS_22_STABILITY_CLASSIFICATIONS,
  ACCESS_22_TOOL_VERSION,
  ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED,
  ACCESS_DUAL_ECONOMY_NOT_QUALIFIED,
  type Access22InvariantId,
  type Access22ScaleLevel,
  type Access22ScenarioId,
  type Access22StabilityClassification,
} from './ids.ts';

export type {
  Access22AgentStressResult,
  Access22BenchmarkRun,
  Access22CoreMetrics,
  Access22EpochResult,
  Access22InvariantResult,
  Access22QualificationReport,
  Access22Scenario,
  Access22ScenarioResult,
  AccessAllocationRow,
  ParticipantTokenDistribution,
} from './types.ts';

export { ACCESS_22_CATALOG, access22CatalogComplete, access22ScenarioById, access22ScenarioIds } from './catalog.ts';
export { computeDualEconomyAccessAllocation, allocationInvariantToPrice } from './allocation.ts';
export { executeAccess22Scenario, runAccess22Scenario } from './engine.ts';
export { checkAccess22Invariants, allInvariantsHeld, ACCESS_22_INVARIANT_STATEMENTS } from './invariants.ts';
export { classifyStability, computeCoreMetrics } from './metrics.ts';
export { runBenchmarkSuite, benchmarkTestsPassed } from './benchmark.ts';
export { runAgentStressSuite, agentStressPassed } from './agent-stress.ts';
export { runPostScarcityTest } from './post-scarcity.ts';
export { runMonteCarloStream } from './monte-carlo.ts';
export { ACCESS_22_SMOKE_SCENARIO_IDS, runAccess22Campaign, type Access22CampaignResult } from './campaign.ts';
export {
  qualifyDualEconomyAccess,
  renderAccess22Qualification,
  REMAINING_ECONOMIC_RESEARCH,
  REMAINING_REGULATORY_REQUIREMENTS,
  REMAINING_PROVIDER_DEPENDENCIES,
} from './qualification.ts';
export { runAccess22Command } from './cli.ts';
