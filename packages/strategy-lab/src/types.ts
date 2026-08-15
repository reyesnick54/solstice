import type { UtcInstant } from '../../domain/src/time.ts';
import type { ModelId, ModelVersion } from '../../model-registry/src/ids.ts';
import type { RiskBudgetId, RiskModelId, RiskModelVersion } from '../../risk/src/ids.ts';
import type {
  BacktestRunId,
  ExperimentId,
  MarketDatasetId,
  MarketDatasetVersion,
  ParameterSetId,
  StrategyCompilerVersion,
  StrategyId,
  StrategySpecificationId,
  StrategyVersion,
} from './ids.ts';

export const STRATEGY_LIFECYCLE_STATES = [
  'DRAFT',
  'COMPILED',
  'BACKTESTING',
  'BACKTESTED',
  'VALIDATION_FAILED',
  'REVIEW_REQUIRED',
  'SHADOW_APPROVED',
  'SHADOW_RUNNING',
  'SHADOW_COMPLETED',
  'PAPER_APPROVED',
  'PAPER_RUNNING',
  'PAPER_HALTED',
  'RETIRED',
] as const;

export type StrategyLifecycleState = (typeof STRATEGY_LIFECYCLE_STATES)[number];

export const FORBIDDEN_STRATEGY_STATES = ['LIVE_APPROVED', 'LIVE_RUNNING', 'LIVE'] as const;
export type ForbiddenStrategyState = (typeof FORBIDDEN_STRATEGY_STATES)[number];

export const LIVE_STRATEGY_EXECUTION = false as const;

export const EVALUATION_PARTITIONS = ['TRAIN', 'VALIDATION', 'OUT_OF_SAMPLE_TEST'] as const;
export type EvaluationPartition = (typeof EVALUATION_PARTITIONS)[number];

export const COST_MODES = ['EXPLICIT_COSTS', 'ZERO_COST_SIMULATION'] as const;
export type CostMode = (typeof COST_MODES)[number];

export const KILL_SWITCH_REASONS = [
  'MANUAL_STOP',
  'RISK_BLOCK',
  'DRAWDOWN_GUARD',
  'STALE_MARKET_DATA',
  'MODEL_RETIRED',
  'POLICY_CHANGE',
  'ACCOUNT_RESTRICTION',
  'INVARIANT_FAILURE',
] as const;

export type KillSwitchReason = (typeof KILL_SWITCH_REASONS)[number];

export const OVERFITTING_WARNING_KINDS = [
  'TOO_MANY_PARAMETERS',
  'TOO_FEW_OBSERVATIONS',
  'LARGE_TRAIN_TEST_GAP',
  'WINNER_FROM_MANY_TRIALS',
  'RESULT_DOMINATED_BY_ONE_PERIOD',
  'EXCESSIVE_TURNOVER',
  'UNSTABLE_PARAMETERS',
] as const;

export type OverfittingWarningKind = (typeof OVERFITTING_WARNING_KINDS)[number];

export const STRATEGY_RESOURCE_LIMITS = Object.freeze({
  maximumRules: 32,
  maximumInstruments: 16,
  maximumObservations: 2_500,
  maximumParameterCombinations: 48,
  maximumRuntimeMs: 8_000,
  maximumConfiguredWorkloadUnits: 50_000,
});

export type StrategyResourceLimits = typeof STRATEGY_RESOURCE_LIMITS;

export type TransactionCostAssumptions = {
  readonly mode: CostMode;
  readonly commissionMinorPerShare: bigint;
  readonly spreadMinor: bigint;
  readonly slippageMinor: bigint;
  readonly otherCostMinor: bigint;
  readonly namedExplicitly: true;
};

export type ModelDependency = {
  readonly modelId: ModelId;
  readonly version: ModelVersion;
};

export type RiskDependency = {
  readonly riskBudgetId: RiskBudgetId;
  readonly riskModelId: RiskModelId;
  readonly riskModelVersion: RiskModelVersion;
};

export type ChronologicalWindow = {
  readonly start: UtcInstant;
  readonly end: UtcInstant;
  readonly partition: EvaluationPartition;
};

export type OverfittingWarning = {
  readonly kind: OverfittingWarningKind;
  readonly message: string;
  readonly provesOverfitting: false;
  readonly disprovesOverfitting: false;
};

export type StrategyFailure = {
  readonly code:
    | 'INVALID_OPERATOR'
    | 'ARBITRARY_CODE_FORBIDDEN'
    | 'RESOURCE_LIMIT'
    | 'UNVERSIONED_STRATEGY'
    | 'UNVERSIONED_DATASET'
    | 'FUTURE_DATA_FORBIDDEN'
    | 'NEGATIVE_CASH'
    | 'LEVERAGE_FORBIDDEN'
    | 'SHORT_FORBIDDEN'
    | 'HIDDEN_COST_FORBIDDEN'
    | 'INVALID_TRANSITION'
    | 'HUMAN_OPERATOR_REQUIRED'
    | 'SELF_PROMOTION_FORBIDDEN'
    | 'MESH_CANNOT_VALIDATE'
    | 'MODEL_NOT_APPROVED'
    | 'PROMOTION_GATE_FAILED'
    | 'KILL_SWITCH_ACTIVE'
    | 'LIVE_FORBIDDEN'
    | 'PAPER_BROKER_DIRECT_FORBIDDEN'
    | 'LEDGER_DIRECT_FORBIDDEN'
    | 'AUTHORITY_ISSUANCE_FORBIDDEN'
    | 'RDT_UNRESOLVED'
    | 'EXPERIMENT_DELETE_FORBIDDEN'
    | 'PEVE_REALIZED_FORBIDDEN';
  readonly message: string;
};

export type StrategyRecord = {
  readonly strategyId: StrategyId;
  readonly version: StrategyVersion;
  readonly specificationId: StrategySpecificationId;
  readonly compilerVersion: StrategyCompilerVersion | null;
  readonly compiledHash: string | null;
  readonly lifecycle: StrategyLifecycleState;
  readonly subjectId: string;
  readonly createdAt: UtcInstant;
  readonly meshProposalId: string | null;
  readonly liveApproved: false;
  readonly simulationOnly: true;
};

export type DataSnoopingRecord = {
  readonly strategyId: StrategyId;
  readonly version: StrategyVersion;
  readonly datasetId: MarketDatasetId;
  readonly datasetVersion: MarketDatasetVersion;
  readonly partition: EvaluationPartition;
  readonly window: ChronologicalWindow;
  readonly experimentId: ExperimentId | null;
  readonly parameterSetId: ParameterSetId | null;
  readonly backtestRunId: BacktestRunId | null;
  readonly recordedAt: UtcInstant;
};
