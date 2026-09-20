import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Ratio } from '../../../risk/src/arithmetic.ts';
import type { PerformanceMetrics } from '../metrics.ts';
import type { EvaluationPartition, TransactionCostAssumptions } from '../types.ts';

/** H17 evaluation modes — H18 manages promotion between qualification stages. */
export const EVALUATION_MODES = [
  'REPLAY',
  'HISTORICAL_BACKTEST',
  'WALK_FORWARD',
  'SHADOW_FORWARD',
  'PAPER_FORWARD',
] as const;

export type EvaluationMode = (typeof EVALUATION_MODES)[number];

export const EVALUATION_RUN_KINDS = ['EXPERIMENT', 'OFFICIAL_QUALIFICATION'] as const;
export type EvaluationRunKind = (typeof EVALUATION_RUN_KINDS)[number];

export const QUALIFICATION_OUTCOMES = [
  'PASSED',
  'FAILED',
  'INCONCLUSIVE',
  'ABORTED',
] as const;

export type QualificationOutcome = (typeof QUALIFICATION_OUTCOMES)[number];

export const BENCHMARK_KINDS = [
  'CASH_NO_ACTION',
  'BUY_AND_HOLD',
  'SIMPLE_DETERMINISTIC',
  'HELIOS_H14_REFERENCE',
  'HELIOS_M09_INDEX_MEAN_REVERSION',
] as const;

export type BenchmarkKind = (typeof BENCHMARK_KINDS)[number];

export const FILL_MODEL_VERSION = 'helios-eval-fill-v1' as const;
export const LATENCY_MODEL_VERSION = 'helios-eval-latency-v1' as const;
export const EVALUATION_ENGINE_VERSION = 'helios-h17-eval-v1' as const;

export type LatencyModelSpec = {
  readonly version: typeof LATENCY_MODEL_VERSION;
  readonly observationToDecisionMs: number;
  readonly decisionToProposalMs: number;
  readonly proposalToExecutionEligibilityMs: number;
  readonly zeroLatencyAssumed: false;
};

export type FeedEntitlementClass = 'PUBLIC' | 'LICENSED' | 'RESTRICTED' | 'SYNTHETIC_FIXTURE';

export type EvaluationEconomics = {
  readonly grossPnlMinor: bigint;
  readonly tradingCostMinor: bigint;
  readonly operatingResearchCostMinor: bigint;
  readonly netEconomicsMinor: bigint;
  readonly feesMinor: bigint;
  readonly spreadCostMinor: bigint;
  readonly slippageCostMinor: bigint;
};

export type BenchmarkComparison = {
  readonly kind: BenchmarkKind;
  readonly instrumentId: string | null;
  readonly metrics: PerformanceMetrics;
  readonly economics: EvaluationEconomics;
  readonly relativeReturn: Ratio | null;
};

export type RegimeSlice = {
  readonly label: string;
  readonly start: UtcInstant;
  readonly end: UtcInstant;
  readonly metrics: PerformanceMetrics;
  readonly observationCount: number;
};

export type ExtendedEvaluationMetrics = PerformanceMetrics &
  EvaluationEconomics & {
    readonly grossReturn: Ratio;
    readonly netReturn: Ratio;
    readonly averageHoldingDays: number | null;
    readonly concentrationTopInstrumentBps: bigint | null;
    readonly idleCashRatio: Ratio;
    readonly worstPeriodReturn: Ratio | null;
    readonly winLossRate: Ratio | null;
  };

export type EvaluationLimitation = {
  readonly code: string;
  readonly message: string;
};

export type EvaluationFailure = {
  readonly code:
    | 'FUTURE_INFORMATION_LEAK'
    | 'INFORMATION_NOT_KNOWABLE'
    | 'CAPSULE_FINGERPRINT_MISMATCH'
    | 'MANIFEST_HASH_MISMATCH'
    | 'ZERO_LATENCY_FORBIDDEN'
    | 'MARKET_CLOSED'
    | 'MISSING_DATA_EXPLICIT'
    | 'TRAIN_TEST_CONTAMINATION'
    | 'CUSTOMER_ISOLATION_VIOLATION'
    | 'EVALUATION_DELETE_FORBIDDEN';
  readonly message: string;
};

export type ChronologicalEvaluationConfig = {
  readonly mode: EvaluationMode;
  readonly runKind: EvaluationRunKind;
  readonly partition: EvaluationPartition;
  readonly period: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly startingCapitalMinor: bigint;
  readonly latency: LatencyModelSpec;
  readonly costs: TransactionCostAssumptions;
  readonly operatingResearchCostMinor: bigint;
  readonly seed: string | null;
  readonly customerId: string | null;
  readonly walkForward?: {
    readonly trainDays: number;
    readonly testDays: number;
  };
};
