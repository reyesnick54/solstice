/**
 * ACCESS-22 Dual-Economy Access Stress Laboratory types.
 *
 * Money is integer minor units. Simulation results are not forecasts.
 */

import type {
  ACCESS_22_LABEL,
  ACCESS_22_SCHEMA_VERSION,
  ACCESS_22_TOOL_VERSION,
  Access22InvariantId,
  Access22ScaleLevel,
  Access22ScenarioId,
  Access22StabilityClassification,
} from './ids.ts';

export type { Access22ScenarioId, Access22StabilityClassification } from './ids.ts';

export type TokenPricePath = Readonly<{
  readonly srPriceBps: bigint;
  readonly mrPriceBps: bigint;
  readonly srPriceChangeBps: bigint;
  readonly mrPriceChangeBps: bigint;
}>;

export type CapacityState = Readonly<{
  readonly allocatableUnits: bigint;
  readonly nativeCapacityShareBps: bigint;
  readonly externalProviderLiabilityUnits: bigint;
  readonly fundedReserveUnits: bigint;
  readonly capacityGrowthBps: bigint;
  readonly productiveAbundanceIndexBps: bigint;
  readonly categoryUnits: Readonly<Record<string, bigint>>;
}>;

export type OracleState = Readonly<{
  readonly degraded: boolean;
  readonly collusionRisk: boolean;
  readonly controllerConcentrationBps: bigint;
  readonly staleEvidence: boolean;
}>;

export type ReserveState = Readonly<{
  readonly coverageBps: bigint;
  readonly depleted: boolean;
  readonly refundWaveBps: bigint;
}>;

export type ProviderState = Readonly<{
  readonly providerCount: number;
  readonly topProviderShareBps: bigint;
  readonly collapsed: boolean;
  readonly topProviderOutage: boolean;
  readonly phantomCapacityAttempted: boolean;
}>;

export type ExchangeState = Readonly<{
  readonly halted: boolean;
  readonly illiquid: boolean;
  readonly liquidityUnits: bigint;
  readonly spreadBps: bigint;
}>;

export type ParticipantTokenDistribution = Readonly<{
  readonly subjectId: string;
  readonly sunreyMinor: bigint;
  readonly moonreyMinor: bigint;
  readonly dualHolder: boolean;
  readonly dataContributionUnits: bigint;
  readonly productiveContributionUnits: bigint;
  readonly sybilClusterId: string | null;
}>;

export type Access22Scenario = Readonly<{
  readonly schemaVersion: typeof ACCESS_22_SCHEMA_VERSION;
  readonly scenarioId: Access22ScenarioId;
  readonly title: string;
  readonly seed: number;
  readonly policyVersions: Readonly<typeof import('./ids.ts').ACCESS_22_POLICY_VERSIONS>;
  readonly participantCount: number;
  readonly providerCount: number;
  readonly macroScenarioId: string;
  readonly macroEpochs: number;
  readonly capacityState: CapacityState;
  readonly tokenPricePath: TokenPricePath;
  readonly reserveState: ReserveState;
  readonly oracleState: OracleState;
  readonly providerState: ProviderState;
  readonly exchangeState: ExchangeState;
  readonly expectedInvariants: readonly Access22InvariantId[];
  readonly expectedClassifications: readonly Access22StabilityClassification[];
  readonly notes: string;
}>;

export type AccessAllocationRow = Readonly<{
  readonly subjectId: string;
  readonly allocatedUnits: bigint;
  readonly allocationWeightBps: bigint;
  readonly sunreyMinor: bigint;
  readonly moonreyMinor: bigint;
  readonly dualHolder: boolean;
}>;

export type Access22CoreMetrics = Readonly<{
  readonly accessFillRateBps: bigint;
  readonly allocationConcentrationHhi: bigint;
  readonly capacityUtilizationBps: bigint;
  readonly unmetDemandUnits: bigint;
  readonly solvencyRatioByDenominationBps: Readonly<Record<string, bigint>>;
  readonly externalProviderLiabilityUnits: bigint;
  readonly nativeCapacityShareBps: bigint;
  readonly providerConcentrationHhi: bigint;
  readonly oracleConcentrationBps: bigint;
  readonly srHolderConcentrationHhi: bigint;
  readonly mrHolderConcentrationHhi: bigint;
  readonly dualHolderParticipationBps: bigint;
  readonly redemptionCompletionBps: bigint;
  readonly refundRateBps: bigint;
  readonly settlementFailureCount: number;
  readonly allocationVolatilityBps: bigint;
  readonly epochAccessVolatilityBps: bigint;
  readonly tokenVelocityBps: bigint;
  readonly exchangeLiquidityUnits: bigint;
  readonly reserveCoverageBps: bigint;
  readonly capacityGrowthBps: bigint;
  readonly productiveAbundanceIndexBps: bigint;
}>;

export type Access22InvariantResult = Readonly<{
  readonly invariantId: Access22InvariantId;
  readonly held: boolean;
  readonly evidence: string;
}>;

export type Access22EpochResult = Readonly<{
  readonly epoch: number;
  readonly allocatableUnits: bigint;
  readonly totalAllocatedUnits: bigint;
  readonly allocations: readonly AccessAllocationRow[];
  readonly metrics: Access22CoreMetrics;
  readonly classifications: readonly Access22StabilityClassification[];
  readonly invariants: readonly Access22InvariantResult[];
}>;

export type Access22ScenarioResult = Readonly<{
  readonly schemaVersion: typeof ACCESS_22_SCHEMA_VERSION;
  readonly toolVersion: typeof ACCESS_22_TOOL_VERSION;
  readonly simulationLabel: typeof ACCESS_22_LABEL;
  readonly scenarioId: Access22ScenarioId;
  readonly seed: number;
  readonly scaleLevel: Access22ScaleLevel;
  readonly effectiveParticipantCount: number;
  readonly sampledParticipantCount: number;
  readonly epochs: readonly Access22EpochResult[];
  readonly aggregateMetrics: Access22CoreMetrics;
  readonly classifications: readonly Access22StabilityClassification[];
  readonly invariants: readonly Access22InvariantResult[];
  readonly allInvariantsHeld: boolean;
  readonly mechanismTests: Readonly<Record<string, boolean>>;
  readonly resultDigestSha256: string;
}>;

export type Access22BenchmarkRun = Readonly<{
  readonly participantId: string;
  readonly sunreyMinor: bigint;
  readonly moonreyMinor: bigint;
  readonly scenarioId: Access22ScenarioId;
  readonly baselineAllocationUnits: bigint;
  readonly stressedAllocationUnits: bigint;
  readonly priceChanged: boolean;
  readonly allocationUnchangedByPrice: boolean;
  readonly capacityOrParticipationChangedAllocation: boolean;
}>;

export type Access22AgentStressResult = Readonly<{
  readonly scenario: string;
  readonly recommendationsIssued: number;
  readonly selfExecutions: number;
  readonly proposalsOnly: boolean;
  readonly passed: boolean;
}>;

export type Access22QualificationReport = Readonly<{
  readonly schemaVersion: typeof ACCESS_22_SCHEMA_VERSION;
  readonly toolVersion: typeof ACCESS_22_TOOL_VERSION;
  readonly simulationLabel: typeof ACCESS_22_LABEL;
  readonly seed: number;
  readonly scaleLevelsTested: readonly Access22ScaleLevel[];
  readonly scenarioCount: number;
  readonly scenariosRun: number;
  readonly scenariosPassed: number;
  readonly scenariosFailed: number;
  readonly invariantCount: number;
  readonly invariantViolations: readonly Access22InvariantResult[];
  readonly allInvariantsHeld: boolean;
  readonly mechanismTestsPassed: boolean;
  readonly benchmarkTestsPassed: boolean;
  readonly agentStressPassed: boolean;
  readonly postScarcityPassed: boolean;
  readonly monteCarloRuns: number;
  readonly monteCarloViolations: number;
  readonly qualificationState: string;
  readonly productionPosture: Readonly<{
    readonly PRODUCTION_READY: false;
    readonly LIVE_CONNECTIVITY_ENABLED: false;
    readonly PRODUCTION_ACTIVE: false;
    readonly changedByThisRun: false;
  }>;
  readonly results: readonly Access22ScenarioResult[];
  readonly benchmarkRuns: readonly Access22BenchmarkRun[];
  readonly agentStress: readonly Access22AgentStressResult[];
  readonly remainingEconomicResearch: readonly string[];
  readonly remainingRegulatoryRequirements: readonly string[];
  readonly remainingProviderDependencies: readonly string[];
}>;
