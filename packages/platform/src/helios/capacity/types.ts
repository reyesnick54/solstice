/**
 * HELIOS H33 — capacity, latency, and portfolio interaction qualification types.
 * ENGINEERING_MEASUREMENT only — not production SLAs.
 */

import type { QualificationEnvironment } from '../../../../../performance/lib/env-metadata.ts';

export const HELIOS_H33_CAPACITY_LATENCY_PORTFOLIO = 'HELIOS_H33_CAPACITY_LATENCY_PORTFOLIO' as const;

export const HELIOS_RESILIENCE_ECONOMIC_QUALIFIED = 'HELIOS_RESILIENCE_ECONOMIC_QUALIFIED' as const;
export const HELIOS_RESILIENCE_ECONOMIC_BLOCKED = 'HELIOS_RESILIENCE_ECONOMIC_BLOCKED' as const;

export type HeliosLoadProfileId = 'SMALL' | 'MEDIUM' | 'LARGE_SANDBOX' | 'BURST';

export type HeliosLoadProfile = {
  readonly id: HeliosLoadProfileId;
  readonly description: string;
  readonly concurrentCustomers: number;
  readonly activeWorkOrdersPerCustomer: number;
  readonly simultaneousProposals: number;
  readonly observationsPerSec: number;
  readonly instrumentCount: number;
  readonly providerCount: number;
  readonly concurrentResearchTasks: number;
  readonly concurrentS3mCalls: number;
  readonly concurrentGrokCalls: number;
  readonly activeStrategyCapsules: number;
  readonly ordersPerSec: number;
  readonly burstMultiplier: number;
  readonly durationMs: number;
};

export type HeliosPipelineStage =
  | 'SOURCE'
  | 'ARRIVAL'
  | 'NORMALIZATION'
  | 'EVENT_DETECTION'
  | 'EVIDENCE_VERIFIED'
  | 'CANDIDATE'
  | 'SPECIALIST_RESEARCH'
  | 'STRATEGY_EVALUATION'
  | 'DECISION_VALIDITY'
  | 'RISK_COMPLIANCE'
  | 'PROPOSAL_READY'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'FILLED'
  | 'SETTLED'
  | 'RECONCILED';

export type LatencyDistribution = {
  readonly count: number;
  readonly p50Ms: number;
  readonly p90Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly meanMs: number;
};

export type HeliosPipelineLatencySample = {
  readonly traceId: string;
  readonly customerId: string;
  readonly workOrderId: string;
  readonly stageTimestampsMs: Readonly<Partial<Record<HeliosPipelineStage, number>>>;
  readonly modelTimeMs: number;
  readonly deterministicControlTimeMs: number;
  readonly provider?: string;
  readonly environment: 'simulation';
};

export type DiscoveryLatencySummary = {
  readonly sourceToVerifiedCandidateMs: LatencyDistribution;
  readonly sampleCount: number;
};

export type DecisionLatencySummary = {
  readonly candidateToProposalMs: LatencyDistribution;
  readonly riskComplianceMs: LatencyDistribution;
  readonly modelTimeMs: LatencyDistribution;
  readonly deterministicControlTimeMs: LatencyDistribution;
  readonly sampleCount: number;
};

export type ExecutionLatencySummary = {
  readonly submissionToAckMs: LatencyDistribution;
  readonly ackToFillMs: LatencyDistribution;
  readonly fillToReconciledMs: LatencyDistribution;
  readonly sampleCount: number;
};

export type PipelineLatencySummary = {
  readonly endToEndMs: LatencyDistribution;
  readonly byStage: Readonly<Partial<Record<HeliosPipelineStage, LatencyDistribution>>>;
  readonly discovery: DiscoveryLatencySummary;
  readonly decision: DecisionLatencySummary;
  readonly execution: ExecutionLatencySummary;
};

export type CapacityInvariantResult = {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type PortfolioInteractionResult = {
  readonly scenario: string;
  readonly passed: boolean;
  readonly totalClaimedMinor: string;
  readonly availableMinor: string;
  readonly reservedMinor: string;
  readonly blockers: readonly string[];
};

export type CustomerIsolationResult = {
  readonly passed: boolean;
  readonly customersTested: number;
  readonly crossCustomerLeaks: readonly string[];
  readonly balanceCorruption: readonly string[];
  readonly proposalLeakage: readonly string[];
};

export type BackpressureResult = {
  readonly queueName: string;
  readonly maxDepthObserved: number;
  readonly rejectedSafely: number;
  readonly degradedResponses: number;
  readonly droppedFinancialTasks: number;
  readonly duplicateRequests: number;
  readonly bypassedControls: number;
  readonly passed: boolean;
};

export type ChaosUnderLoadResult = {
  readonly scenario: string;
  readonly passed: boolean;
  readonly recoveryMs: number | null;
  readonly backlogAfterRecovery: number;
  readonly detail: string;
};

export type ResourceUtilizationSnapshot = {
  readonly peakConcurrentResearch: number;
  readonly peakQueueDepth: number;
  readonly peakProviderRequestsPerSec: number;
  readonly peakDbWritesPerSec: number;
  readonly cpuSaturationObserved: boolean;
  readonly memoryPressureObserved: boolean;
};

export type EconomicCapacityFinding = {
  readonly accountSizeMinor: string;
  readonly minimumFeeDominance: boolean;
  readonly minimumOrderBlocksDeployment: boolean;
  readonly inferenceCostMaterial: boolean;
  readonly liquidityLimitObserved: boolean;
  readonly idleCashIncreaseMinor: string;
  readonly strategyCapacityCeilingMinor: string | null;
};

export type SafeOperatingEnvelope = {
  readonly maxConcurrentResearchTasks: number;
  readonly maxProviderRequestsPerSec: number;
  readonly maxActiveWorkOrders: number;
  readonly maxEventsPerSec: number;
  readonly maxExecutionConcurrency: number;
  readonly maxConcurrentCustomers: number;
  readonly notes: readonly string[];
};

export type CapacityQualificationReport = {
  readonly schemaVersion: 1;
  readonly chunk: 'H33';
  readonly marker: typeof HELIOS_RESILIENCE_ECONOMIC_QUALIFIED | typeof HELIOS_RESILIENCE_ECONOMIC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly environment: QualificationEnvironment;
  readonly loadProfile: HeliosLoadProfileId;
  readonly configuration: {
    readonly simulationOnly: true;
    readonly liveTradingEnabled: false;
  };
  readonly volumes: {
    readonly customers: number;
    readonly observations: number;
    readonly researchTasks: number;
    readonly proposals: number;
    readonly orders: number;
    readonly fills: number;
  };
  readonly latency: PipelineLatencySummary;
  readonly queueDepth: Readonly<Record<string, number>>;
  readonly errorRates: Readonly<Record<string, number>>;
  readonly resourceUtilization: ResourceUtilizationSnapshot;
  readonly economicFindings: readonly EconomicCapacityFinding[];
  readonly invariants: readonly CapacityInvariantResult[];
  readonly portfolioInteractions: readonly PortfolioInteractionResult[];
  readonly customerIsolation: CustomerIsolationResult;
  readonly backpressure: readonly BackpressureResult[];
  readonly chaosUnderLoad: readonly ChaosUnderLoadResult[];
  readonly bottlenecks: readonly string[];
  readonly failurePoint: string | null;
  readonly safeOperatingEnvelope: SafeOperatingEnvelope;
  readonly limitations: readonly string[];
  readonly disclaimer: string;
};

export type CapacityQualificationResult = {
  readonly marker: typeof HELIOS_RESILIENCE_ECONOMIC_QUALIFIED | typeof HELIOS_RESILIENCE_ECONOMIC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly report: CapacityQualificationReport;
};
