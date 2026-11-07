import type { UtcInstant } from '@solstice/domain';
import type {
  EXEC07_RULE_FLAGS,
  ExecutionAlgorithmKind,
  ExecutionBenchmarkKind,
  Exec07EvidenceKind,
  HELIOS_EXEC07_TCA_SCHEMA,
} from './taxonomy.ts';

export type ExecutionBenchmark = {
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly kind: ExecutionBenchmarkKind;
  readonly priceMinor: bigint | null;
  readonly asOf: UtcInstant | null;
  readonly dataComplete: boolean;
  readonly explanation: string;
};

export type ExecutionOperationalMetrics = {
  readonly fillRateBps: number;
  readonly partialFillRateBps: number;
  readonly cancelRateBps: number;
  readonly rejectRateBps: number;
  readonly submissionToAckLatencyMs: number | null;
  readonly ackToFillLatencyMs: number | null;
  readonly adverseSelectionBps: number | null;
};

export type TransactionCostAnalysis = {
  readonly analysisId: string;
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: bigint;
  readonly quantityFilledUnits: bigint;
  readonly notionalMinor: bigint;
  readonly explicitFeesMinor: bigint | null;
  readonly spreadCostMinor: bigint | null;
  readonly spreadCostBps: number | null;
  readonly marketImpactMinor: bigint | null;
  readonly marketImpactBps: number | null;
  readonly timingCostMinor: bigint | null;
  readonly timingCostBps: number | null;
  readonly slippageMinor: bigint | null;
  readonly slippageBps: number | null;
  readonly priceImprovementMinor: bigint | null;
  readonly priceImprovementBps: number | null;
  readonly implementationShortfallMinor: bigint | null;
  readonly implementationShortfallBps: number | null;
  readonly benchmarks: readonly ExecutionBenchmark[];
  readonly operational: ExecutionOperationalMetrics;
  readonly benchmarkConstructionComplete: boolean;
  readonly dataComplete: boolean;
  readonly computedAt: UtcInstant;
};

export type ExecutionQualityReport = {
  readonly reportId: string;
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly orderId: string;
  readonly executionPlanId: string | null;
  readonly venueId: string;
  readonly providerId: string;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly instrumentId: string;
  readonly transactionCost: TransactionCostAnalysis;
  readonly averageFillPriceMinor: bigint | null;
  readonly validated: boolean;
  readonly validationBlockers: readonly string[];
  readonly computedAt: UtcInstant;
};

export type VenueExecutionProfile = {
  readonly profileId: string;
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly venueId: string;
  readonly sampleCount: number;
  readonly avgSpreadCostBps: number | null;
  readonly avgSlippageBps: number | null;
  readonly avgImplementationShortfallBps: number | null;
  readonly avgFillRateBps: number;
  readonly avgPartialFillRateBps: number;
  readonly avgRejectRateBps: number;
  readonly avgAdverseSelectionBps: number | null;
  readonly benchmarkConstructionCompleteRateBps: number;
  readonly computedAt: UtcInstant;
};

export type AlgorithmExecutionProfile = {
  readonly profileId: string;
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly venueId: string | null;
  readonly sampleCount: number;
  readonly avgSpreadCostBps: number | null;
  readonly avgTimingCostBps: number | null;
  readonly avgPriceImprovementBps: number | null;
  readonly avgImplementationShortfallBps: number | null;
  readonly avgFillRateBps: number;
  readonly computedAt: UtcInstant;
};

export type StrategyExecutionAlphaDecomposition = {
  readonly decompositionId: string;
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly strategyCapsuleId: string;
  readonly orderId: string;
  readonly currency: string;
  readonly totalObservedPnlMinor: bigint;
  readonly strategyAlphaMinor: bigint | null;
  readonly executionAlphaOrCostMinor: bigint | null;
  readonly strategyAlphaBps: number | null;
  readonly executionAlphaOrCostBps: number | null;
  readonly benchmarkKindUsed: ExecutionBenchmarkKind;
  readonly benchmarkConstructionComplete: boolean;
  readonly suppressesStrategyCredit: boolean;
  readonly rules: typeof EXEC07_RULE_FLAGS;
  readonly computedAt: UtcInstant;
};

export type Exec07RouterLearningHint = {
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly evidenceKind: Extract<Exec07EvidenceKind, 'HELIOS_EXEC07_ROUTER_LEARNING_HINT'>;
  readonly venueId: string;
  readonly providerId: string;
  readonly instrumentId: string;
  readonly implementationShortfallBps: number | null;
  readonly fillRateBps: number;
  readonly validated: boolean;
  readonly usableByExec05Router: true;
  readonly computedAt: UtcInstant;
};

export type Exec07ExecutionPolicyNicheEvidence = {
  readonly schema: typeof HELIOS_EXEC07_TCA_SCHEMA;
  readonly evidenceKind: Extract<Exec07EvidenceKind, 'HELIOS_EXEC07_EXECUTION_POLICY_NICHE'>;
  readonly nicheKey: string;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly venueId: string;
  readonly sampleCount: number;
  readonly qualityScoreBps: number;
  readonly validated: boolean;
  readonly usableByEvol13ExecutionPolicyOnly: true;
  readonly separatesInvestmentSignalEvolution: true;
  readonly computedAt: UtcInstant;
};
