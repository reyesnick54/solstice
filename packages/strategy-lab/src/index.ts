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
  asStrategyCapsuleId,
  asQualificationPolicyId,
  asEvaluationQualificationId,
  asPromotionDecisionId,
  asForwardShadowRunId,
  asForwardShadowDecisionId,
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
  StrategyCapsuleId,
  QualificationPolicyId,
  EvaluationQualificationId,
  PromotionDecisionId,
  ForwardShadowRunId,
  ForwardShadowDecisionId,
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
export { freezeStrategyCapsule } from './capsule.ts';
export type { StrategyCapsule, StrategyCapsuleEvidenceRef } from './capsule.ts';
export {
  createQualificationPolicy,
  DEFAULT_QUALIFICATION_POLICY,
  QUALIFICATION_POLICY_VERSION,
} from './qualification-policy.ts';
export type { QualificationPolicy } from './qualification-policy.ts';
export { evaluateQualification } from './evaluation-qualification.ts';
export type { EvaluationQualificationResult, EvaluationQualificationMetrics } from './evaluation-qualification.ts';
export {
  STRATEGY_PROMOTION_STATES,
  PROMOTION_DECISION_KINDS,
  AUTHORITATIVE_PROMOTION_KINDS,
  LEGAL_PROMOTION_TRANSITIONS,
  transitionPromotionState,
  isLiveEligibleState,
} from './promotion-state.ts';
export type { StrategyPromotionState, PromotionDecisionKind } from './promotion-state.ts';
export { gateResearchToEvaluation, gateEvaluationToShadow, gateShadowToPaper } from './promotion-gates.ts';
export type { GateResult } from './promotion-gates.ts';
export {
  startForwardShadowRun,
  recordForwardShadowDecision,
  attachForwardShadowOutcome,
  summarizeForwardShadowEvidence,
} from './forward-shadow.ts';
export type {
  ForwardShadowRun,
  ForwardShadowDecision,
  ForwardShadowOutcome,
  ForwardShadowEvidenceSummary,
} from './forward-shadow.ts';
export {
  canEmitPromotionDecision,
  assertAuthoritativePromotion,
  classifyPromotionActor,
  recordPromotionRecommendation,
} from './promotion-authority.ts';
export type { PromotionActorKind } from './promotion-authority.ts';
export { DEMOTION_TRIGGERS, evaluateDemotionTrigger, buildDemotionRecord, requiresRequalification } from './demotion.ts';
export type { DemotionTrigger, DemotionRecord } from './demotion.ts';
export { sealPromotionEvidence } from './promotion-evidence.ts';
export type { PromotionEvidenceRecord } from './promotion-evidence.ts';
export { StrategyPromotionStore, createEmptyPromotionSnapshot } from './promotion-store.ts';
export type { StrategyPromotionRecord, StrategyPromotionSnapshot } from './promotion-store.ts';
export { StrategyPromotionService } from './promotion-service.ts';
export { lintStrategyPromotionAuthority } from './architecture-guards.ts';
export {
  HELIOS_H14_STRATEGY_CAPSULE_ID,
  HELIOS_H14_STRATEGY_CAPSULE_VERSION,
  observeH14CapsuleQualification,
  buildH14ReferenceCapsule,
} from './h14-capsule-bridge.ts';
export type { H14CapsuleQualificationObservation } from './h14-capsule-bridge.ts';
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
