export {
  asBacktestRunId,
  asExperimentId,
  asMarketDatasetId,
  asMarketDatasetVersion,
  asPaperStrategyRunId,
  asParameterSetId,
  asShadowDecisionId,
  asShadowRunId,
  asStrategyCompilerVersion,
  asStrategyId,
  asStrategyPromotionReviewId,
  asStrategySpecificationId,
  asStrategyValidationId,
  asStrategyVersion,
  asWalkForwardRunId,
} from './ids.ts';
export type {
  BacktestRunId,
  ExperimentId,
  MarketDatasetId,
  MarketDatasetVersion,
  PaperStrategyRunId,
  ParameterSetId,
  ShadowDecisionId,
  ShadowRunId,
  StrategyCompilerVersion,
  StrategyId,
  StrategyPromotionReviewId,
  StrategySpecificationId,
  StrategyValidationId,
  StrategyVersion,
  WalkForwardRunId,
} from './ids.ts';
export {
  COST_MODES,
  EVALUATION_PARTITIONS,
  FORBIDDEN_STRATEGY_STATES,
  KILL_SWITCH_REASONS,
  LIVE_STRATEGY_EXECUTION,
  OVERFITTING_WARNING_KINDS,
  STRATEGY_LIFECYCLE_STATES,
  STRATEGY_RESOURCE_LIMITS,
} from './types.ts';
export type {
  CostMode,
  DataSnoopingRecord,
  EvaluationPartition,
  ForbiddenStrategyState,
  KillSwitchReason,
  OverfittingWarning,
  StrategyFailure,
  StrategyLifecycleState,
  StrategyRecord,
  TransactionCostAssumptions,
} from './types.ts';
export {
  APPROVED_OPERATORS,
  FORBIDDEN_STRATEGY_CODE,
  assertApprovedOperator,
  collectInstrumentIds,
  countRules,
  countStrategyParameters,
  validateStrategyAst,
} from './dsl.ts';
export type { ApprovedOperator, StrategyExpr } from './dsl.ts';
export { freezeSpecification } from './specification.ts';
export type { StrategySpecification } from './specification.ts';
export { STRATEGY_COMPILER_VERSION, compileStrategy } from './compiler.ts';
export type { SimulationPlan } from './compiler.ts';
export {
  LEGAL_STRATEGY_TRANSITIONS,
  allLifecycleStates,
  assertNoLiveTransition,
  isForbiddenLiveState,
  liveStatesPresentIn,
  transitionStrategy,
} from './lifecycle.ts';
export {
  freezeMarketDataset,
  latestCloseAt,
  membersAt,
  observationAt,
  pointInTime,
} from './dataset.ts';
export type { MarketDataset, MarketObservation, PointInTimeView } from './dataset.ts';
export { applyDividend, applySplit, simulateFill } from './simulator.ts';
export { calculateMetrics } from './metrics.ts';
export type { PerformanceMetrics } from './metrics.ts';
export { runBacktest } from './backtest.ts';
export type { BacktestRun, ParameterSet, StrategyAttribution } from './backtest.ts';
export { runWalkForward, walkForwardWindows } from './walk-forward.ts';
export type { WalkForwardRun } from './walk-forward.ts';
export { expandParameterGrid, refuseExperimentDeletion, runExperiment } from './experiment.ts';
export type { Experiment } from './experiment.ts';
export { overfittingWarnings } from './overfitting.ts';
export { buildValidationReport } from './validation.ts';
export type { StrategyValidationReport } from './validation.ts';
export { paperEligibility, recordHumanPromotion } from './promotion.ts';
export { shadowDecision, startShadowRun } from './shadow.ts';
export type { ShadowDecision, ShadowRun } from './shadow.ts';
export { paperOrderIntent, startPaperRun, submitPaperAction } from './paper.ts';
export type { PaperExecutionPort, PaperStrategyRun } from './paper.ts';
export { INACTIVE_KILL_SWITCH, activateKillSwitch, evaluateKillConditions } from './kill-switch.ts';
export {
  classifyPeveStrategyValue,
  draftFromMeshProposal,
  evaluateAggressiveObjective,
  growthGateFromLab,
  rdtLaunchReadiness,
  refuseMeshValidation,
  refusePeveRealizedBacktest,
} from './bridges.ts';
export type { GrowthStrategyGate, MeshCapitalProposal } from './bridges.ts';
export { StrategyLabStore, createEmptyStrategyLabSnapshot } from './store.ts';
export type { StrategyLabSnapshot } from './store.ts';
export { StrategyLab } from './service.ts';
export {
  DEFAULT_PARAMETER_SET,
  EXPLICIT_COSTS,
  SIM_ETF_1,
  SIM_ETF_2,
  ZERO_COST,
  equalWeightSpec,
  overfitSpec,
  syntheticBenchmarkDataset,
  syntheticTwoEtfDataset,
} from './fixtures.ts';
