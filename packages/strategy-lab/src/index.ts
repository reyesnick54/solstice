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
export { asStrategyFamilyId } from './capsule/ids.ts';
export type { StrategyFamilyId } from './capsule/ids.ts';
export {
  STRATEGY_CAPSULE_ENVIRONMENTS,
  STRATEGY_CAPSULE_QUALIFICATION_STATES,
  STRATEGY_CAPSULE_SCOPES,
  TERMINAL_CAPSULE_QUALIFICATION_STATES,
} from './capsule/types.ts';
export type {
  DeterministicDecisionRule,
  FixedQualifiedParameters,
  InstrumentUniverseSpec,
  StrategyCapsuleComparison,
  StrategyCapsuleEvidence,
  StrategyCapsuleFailure,
  StrategyCapsuleMaterial,
  StrategyCapsuleQualificationState,
  StrategyCapsuleRecord,
  StrategyCapsuleScope,
} from './capsule/types.ts';
export {
  computeStrategyCapsuleMaterialHash,
  projectMaterialForHash,
  serializeStrategyCapsuleMaterial,
} from './capsule/fingerprint.ts';
export {
  LEGAL_CAPSULE_QUALIFICATION_TRANSITIONS,
  canActivateCapsule,
  canPromoteCapsule,
  requiresReviewBeforePromotion,
  transitionCapsuleQualification,
} from './capsule/lifecycle.ts';
export {
  HELIOS_H14_CAPSULE_ID,
  HELIOS_H14_ENTRY_QUANTITY_UNITS,
  HELIOS_H14_ENTRY_THRESHOLD_MINOR,
  HELIOS_H14_EXIT_THRESHOLD_MINOR,
  HELIOS_H14_FAMILY_ID,
  HELIOS_H14_RULE_ID,
  buildHeliosH14Material,
  buildHeliosH14StrategyCapsule,
} from './capsule/h14.ts';
export {
  HELIOS_M09_CAPSULE_ID,
  HELIOS_M09_FAMILY_ID,
  HELIOS_M09_RULE_ID,
  buildHeliosM09Material,
  buildHeliosM09StrategyCapsule,
} from './capsule/m09-index-mean-reversion.ts';
export {
  HELIOS_M10_CAPSULE_ID,
  HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1,
  HELIOS_M10_FAMILY_ID,
  HELIOS_M10_RULE_ID,
  buildHeliosM10Material,
  buildHeliosM10StrategyCapsule,
} from './capsule/m10.ts';
export {
  HELIOS_M11_CAPSULE_ID,
  HELIOS_M11_COMMODITY_TREND_FOLLOWING_V1,
  HELIOS_M11_FAMILY_ID,
  HELIOS_M11_RULE_ID,
  buildHeliosM11Material,
  buildHeliosM11StrategyCapsule,
} from './capsule/m11.ts';
export {
  HELIOS_M12_CAPSULE_ID,
  HELIOS_M12_FAMILY_ID,
  HELIOS_M12_RULE_ID,
  buildHeliosM12Material,
  buildHeliosM12StrategyCapsule,
} from './capsule/m12-relative-value.ts';
export {
  HELIOS_M09_STRATEGY_CAPSULE_ID,
  HELIOS_M09_STRATEGY_CAPSULE_VERSION,
  observeM09CapsuleQualification,
  buildM09EvaluationCapsule,
  registerM09StrategyCapsuleRecord,
  m09MaterialFingerprint,
} from './m09-capsule-bridge.ts';
export type { M09CapsuleQualificationObservation } from './m09-capsule-bridge.ts';
export {
  M09_SPY_INSTRUMENT_ID,
  M09_QQQ_INSTRUMENT_ID,
  M09_INSTRUMENT_UNIVERSE,
  M09_BAR_INTERVAL,
} from './m09/ids.ts';
export {
  M09_PARAMETERS_V1,
  M09_PARAMETERS_V2,
  M09_Z_SCORE_SCALE,
  resolveM09Parameters,
  parameterFingerprint,
  freezeM09ParameterRecord,
} from './m09/parameters.ts';
export type { M09ParameterVersion, M09StrategyParameters, M09ParameterRecord } from './m09/parameters.ts';
export {
  HELIOS_M09_INDEX_MEAN_REVERSION_RULE_ID,
  evaluateM09IndexMeanReversion,
  evaluateM09Universe,
} from './m09/rule.ts';
export {
  rollingMeanMinor,
  realizedVolBps,
  zScoreScaled,
  buildFeatureSnapshot,
  barsForInstrument,
  indexAtOrBefore,
} from './m09/features.ts';
export {
  syntheticM09BarSeries,
  m09ChronologicalManifest,
  barsFromManifest,
  buildM09Bar,
} from './m09/fixtures.ts';
export { runM09ChronologicalEvaluation, m09BuyAndHoldEnding } from './m09/evaluation.ts';
export type { M09ChronologicalEvaluationResult } from './m09/evaluation.ts';
export {
  initialM09LifecycleState,
  promoteM09ToShadow,
  promoteM09ToPaper,
  demoteM09,
  restartM09Lifecycle,
} from './m09/lifecycle.ts';
export type { M09LifecycleMode, M09LifecycleState } from './m09/lifecycle.ts';
export {
  HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED,
  HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_BLOCKED,
  evaluateM09Qualification,
} from './m09/qualification.ts';
export type { M09QualificationChecks, M09QualificationResult } from './m09/qualification.ts';
export type {
  M09BarObservation,
  M09FeatureSnapshot,
  M09StrategyDecision,
  M09EvaluationContext,
  M09OpenPosition,
  M09EntryBlockReason,
  M09ExitReason,
} from './m09/types.ts';
export { StrategyCapsuleService } from './capsule/service.ts';
export type { CreateStrategyCapsuleDraftInput } from './capsule/service.ts';
export { freezePromotionCapsule } from './promotion-capsule.ts';
export type { PromotionCapsule, PromotionCapsuleEvidenceRef } from './promotion-capsule.ts';
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
  HELIOS_M10_STRATEGY_CAPSULE_ID,
  HELIOS_M10_STRATEGY_CAPSULE_VERSION,
  observeM10CapsuleQualification,
  buildM10ReferenceCapsule,
  buildM10StrategySpecification,
} from './m10-capsule-bridge.ts';
export type { M10CapsuleQualificationObservation } from './m10-capsule-bridge.ts';
export {
  HELIOS_M11_STRATEGY_CAPSULE_ID,
  HELIOS_M11_STRATEGY_CAPSULE_VERSION,
  observeM11CapsuleQualification,
  buildM11ReferenceCapsule,
  buildM11StrategySpecification,
} from './m11-capsule-bridge.ts';
export type { M11CapsuleQualificationObservation } from './m11-capsule-bridge.ts';
export {
  HELIOS_M12_STRATEGY_CAPSULE_ID,
  HELIOS_M12_STRATEGY_CAPSULE_VERSION,
  observeM12CapsuleQualification,
  buildM12ReferenceCapsule,
  registerM12StrategyCapsuleRecord,
  m12MaterialFingerprint,
} from './m12-capsule-bridge.ts';
export type { M12CapsuleQualificationObservation } from './m12-capsule-bridge.ts';
export {
  M12_SPY_QQQ_PAIR_ID,
  M12_BTC_ETH_PAIR_ID,
  M12_GLD_GC_RESEARCH_PAIR_ID,
  M12_PAIR_UNIVERSE,
  M12_BAR_INTERVAL,
  M12_PARAMETERS_V1,
  M12_PARAMETERS_V2,
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED,
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED,
  evaluateM12RelativeValueStatArb,
  validatePair,
  discoverRelationship,
  evaluateM12Qualification,
  syntheticM12BarSeries,
  m12ChronologicalManifest,
  buildM12Bar,
  runM12ChronologicalEvaluation,
  initialM12LifecycleState,
  promoteM12ToShadow,
  promoteM12ToPaper,
  demoteM12,
  restartM12Lifecycle,
  recommendPairAllocation,
  parameterFingerprint as m12ParameterFingerprint,
  resolveM12Parameters,
} from './relative-value/index.ts';
export type {
  M12PairId,
  M12StrategyProposal,
  M12StrategyLeg,
  M12BarObservation,
  M12PairValidationResult,
  M12QualificationChecks,
  M12QualificationResult,
  M12LifecycleState,
  M12OpenSpreadPosition,
  M12EvaluationContext,
} from './relative-value/index.ts';
export {
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
  GOLD_ETF_GLD_ID,
  GOLD_FUTURES_CONTINUOUS_ID,
  GOLD_FUTURES_GCZ2026_ID,
  GOLD_REFERENCE_ID,
  HELIOS_COMMODITY_OBSERVATION_SCHEMA,
  HELIOS_CRYPTO_USD_INSTRUMENTS,
  HELIOS_M11_INSTRUMENT_UNIVERSE,
  HELIOS_MULTI_ASSET_M09_STRATEGY_LAB_FOUNDATION,
  WTI_COMMODITY_REFERENCE_ID,
  WTI_FUTURES_CLM2026_ID,
  WTI_FUTURES_CONTINUOUS_ID,
  WTI_OIL_ETF_PROXY_ID,
  commodityBarToChronologicalObservation,
  cryptoBarToChronologicalObservation,
} from './multi-asset/index.ts';
export {
  DEFAULT_M10_CONFIG,
  HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED,
  evaluateCryptoMomentumBreakoutRule,
  cryptoMomentumEvaluationManifest,
  computeRollingRangeHighPriorBars,
  VALID_GOVERNANCE,
  baseBtcBar,
  baseEthBar,
  flatPosition,
  openPosition,
  validBreakoutControls,
  validBtcBreakoutMarket,
  validEthBreakoutMarket,
} from './crypto-momentum/index.ts';
export type {
  CryptoMomentumBreakoutConfig,
  CryptoMomentumDecision,
  CryptoMomentumEvaluateInput,
  CryptoMomentumMarketState,
  CryptoMomentumPosition,
} from './crypto-momentum/index.ts';
export {
  DEFAULT_M11_CONFIG,
  HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED,
  evaluateCommodityTrendFollowingRule,
  commodityTrendEvaluationManifest,
  computeSimpleMovingAveragePriorBars,
  isContinuousResearchInstrument,
  VALID_GOVERNANCE as COMMODITY_VALID_GOVERNANCE,
  VALID_GOVERNANCE_LONG_ONLY as COMMODITY_VALID_GOVERNANCE_LONG_ONLY,
  baseGoldBar,
  baseWtiBar,
  flatPosition as commodityFlatPosition,
  openLongPosition,
  openShortPosition,
  validGoldDowntrendMarket,
  validGoldUptrendMarket,
  validWtiDowntrendMarket,
  validWtiUptrendMarket,
} from './commodity-trend/index.ts';
export type {
  CommodityTrendDecision,
  CommodityTrendEvaluateInput,
  CommodityTrendFollowingConfig,
  CommodityTrendGovernance,
  CommodityTrendMarketState,
  CommodityTrendPosition,
} from './commodity-trend/index.ts';
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
export {
  asStrategyCapsuleId,
  asStrategyCapsuleVersion,
  asStrategyEvaluationId,
  asEvaluationDatasetManifestId,
  EVALUATION_MODES,
  EVALUATION_RUN_KINDS,
  QUALIFICATION_OUTCOMES,
  BENCHMARK_KINDS,
  FILL_MODEL_VERSION,
  LATENCY_MODEL_VERSION,
  EVALUATION_ENGINE_VERSION,
  STRATEGY_CAPSULE_SCHEMA,
  computeCapsuleFingerprint,
  freezeStrategyCapsule,
  verifyCapsuleFingerprint,
  buildInformationTimeFields,
  computeKnowableAt,
  isKnowableAt,
  assertNoFutureInformationLeak,
  buildChronologicalObservation,
  freezeEvaluationDatasetManifest,
  manifestViewAt,
  manifestLimitations,
  sortObservationsChronologically,
  uniqueDecisionTimes,
  chronologyTieBreakReport,
  DEFAULT_CONSERVATIVE_LATENCY,
  validateLatencyModel,
  buildExecutionTimeline,
  simulateRealisticFill,
  buildEvaluationEconomics,
  extendMetrics,
  runBenchmarkSuite,
  sealEvaluationRecord,
  ChronologicalEvaluationStore,
  runChronologicalEvaluation,
  assertEvaluationReproducible,
  deterministicEvaluationSeed,
  informationTimeLeakFixture,
  chronologicalEvaluationManifest,
  buildReferenceCapsule,
} from './evaluation/index.ts';
export type {
  StrategyCapsuleId,
  StrategyCapsuleVersion,
  StrategyEvaluationId,
  EvaluationDatasetManifestId,
  EvaluationMode,
  EvaluationRunKind,
  QualificationOutcome,
  BenchmarkKind,
  LatencyModelSpec,
  EvaluationEconomics,
  BenchmarkComparison,
  RegimeSlice,
  ExtendedEvaluationMetrics,
  EvaluationLimitation,
  EvaluationFailure,
  ChronologicalEvaluationConfig,
  StrategyCapsule,
  InformationTimeFields,
  ChronologicalObservation,
  EvaluationDatasetManifest,
  DegradedPeriod,
  ExecutionTimeline,
  RealisticFillInput,
  RealisticFillResult,
  StrategyEvaluationRecord,
  EvaluationRecordStore,
  ChronologicalEvaluationResult,
} from './evaluation/index.ts';
