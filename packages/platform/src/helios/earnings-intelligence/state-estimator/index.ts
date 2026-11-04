export {
  HELIOS_EARNINGS_STATE_ESTIMATOR_SCHEMA,
  HELIOS_EARNINGS_STATE_ESTIMATOR_AUTHORITY,
  EARNINGS_EXPERT_KINDS,
  EARNINGS_GATING_VARIABLES,
  EARNINGS_ESTIMATE_TARGETS,
  EARNINGS_KNOWLEDGE_LAYERS,
  HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED,
  HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_BLOCKED,
  type EarningsExpertKind,
  type EarningsGatingVariable,
  type EarningsEstimateTarget,
  type EarningsKnowledgeLayer,
} from './taxonomy.ts';

export type {
  EarningsGatingContext,
  EarningsExpertSignal,
  StudentTDistribution,
  ConformalInterval,
  NumericalForecastDistribution,
  ProbabilityForecast,
  ReturnForecastDistribution,
  NextQuarterEPSDistribution,
  NextQuarterRevenueDistribution,
  EarningsEvidenceContribution,
  EarningsCalibrationSnapshot,
  ProbabilisticEarningsState,
  EarningsOutcomeRecord,
  ExpertReliabilityRecord,
  ConformalResidualRecord,
  EarningsStateEstimatorStoreSnapshot,
  EstimateProbabilisticEarningsStateInput,
  ApplyEarningsOutcomeInput,
} from './types.ts';

export { DEFAULT_EXPERT_PRIMARY_TARGETS } from './expert-targets.ts';
export { estimateProbabilisticEarningsState } from './estimator.ts';
export { computeExpertGateWeight, listGatingVariablesUsed } from './gating.ts';
export { effectiveMixtureWeights, bmaNumericForTarget, bmaProbabilityForTarget } from './bma.ts';
export { combineStudentTMixture, combineProbabilitiesLogit, clampProbability } from './distributions.ts';
export {
  defaultExpertReliability,
  reliabilityWeight,
  updateExpertReliabilityFromOutcome,
  assertOutcomeStrictlyPrior,
} from './reliability.ts';
export { buildConformalInterval, recordConformalResidual, filterPriorConformalResiduals } from './conformal.ts';
export { buildCalibrationSnapshot, brierScore, logLoss, meanAbsoluteError, crpsMean } from './calibration.ts';
export { buildEvidenceContributions } from './contributions.ts';
export {
  createEarningsStateEstimatorStore,
  emptyEarningsStateEstimatorStore,
  type EarningsStateEstimatorStore,
} from './store.ts';
export {
  createHeliosEarningsStateEstimatorService,
  assertResearchReturnNotFact,
  type HeliosEarningsStateEstimatorService,
  type HeliosEarningsStateEstimatorServiceOptions,
} from './service.ts';
export {
  evaluateEarn09StateEstimatorQualification,
  type Earn09StateEstimatorQualificationChecks,
  type Earn09StateEstimatorQualificationResult,
} from './qualification.ts';
export {
  FIXTURE_EARNINGS_AS_OF,
  FIXTURE_EARNINGS_GATING,
  fixtureEarningsExpertSignals,
} from './fixtures.ts';
export {
  parseEarningsDecimal,
  formatEarningsDecimal,
  numberToEarningsDecimal,
  earningsDecimalToNumber,
} from './numeric.ts';
