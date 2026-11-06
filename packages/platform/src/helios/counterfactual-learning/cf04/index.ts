export {
  HELIOS_CF04_OUTCOME_MODEL_SCHEMA,
  HELIOS_CF04_OUTCOME_MODEL_AUTHORITY,
  HELIOS_CF04_OUTCOME_MODEL_QUALIFIED,
  HELIOS_CF04_OUTCOME_MODEL_BLOCKED,
  HELIOS_CF04_CALIBRATION_CERTIFIER_ROLE,
  OUTCOME_DIMENSION_KEYS,
  CF04_BASELINE_MODEL_KINDS,
  CF04_QUANTILE_LEVELS,
  REGIME_LABELS,
  CF04_LIQUIDITY_BUCKETS,
  type OutcomeDimensionKey,
  type Cf04BaselineModelKind,
  type Cf04QuantileLevel,
  type Cf04RegimeLabel,
  type Cf04LiquidityBucket,
} from './taxonomy.ts';

export type {
  AafCertifiedFeatureRow,
  CounterfactualTrainingRow,
  OutcomeVector,
  OutcomeDimensionQuantiles,
  OutcomeQuantileSurface,
  OutcomeDistribution,
  OutcomePrediction,
  ScalarMetricSummary,
  QuantileCoverageReport,
  RegimeCalibrationSlice,
  ActionCalibrationSlice,
  LiquidityCalibrationSlice,
  OutcomeModelCalibration,
  ChronologicalSplitPolicy,
  Cf04TrainingConstraints,
  CounterfactualOutcomeModel,
  CrossFitOutcomeModelOptions,
} from './types.ts';

export { OUTCOME_VECTOR_KEYS, outcomeVectorToArray, arrayToOutcomeVector, zeroOutcomeVector } from './vector.ts';

export {
  evaluateCf04OutcomeModelQualification,
  CF04_ENGINEERING_TRUTH_CHECKS,
  type Cf04OutcomeModelQualificationChecks,
  type Cf04OutcomeModelQualificationResult,
} from './qualification.ts';

export { fixtureCf04TrainingRows } from './fixtures.ts';

export {
  fitCrossFitOutcomeModel,
  createCounterfactualOutcomeModel,
  type CrossFitOutcomeModel,
} from './cross-fit-outcome-model.ts';

export {
  buildChronologicalFolds,
  assertIssuerInstrumentLeakageGuard,
  trainFoldModels,
  type FoldBoundary,
  type DimModelState,
  type FoldTrainedModels,
} from './training.ts';
