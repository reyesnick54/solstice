export {
  HELIOS_CF05_AUTHORITY,
  HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED,
  HELIOS_CF05_OPE_BLOCKED,
  HELIOS_CF05_SCHEMA,
  OPE_ESTIMATOR_KINDS,
  OPE_EVALUATION_STATUS,
  type OpeEstimatorKind,
  type OpeEvaluationStatus,
} from './taxonomy.ts';

export type {
  AnnotationCalibrationBin,
  AnnotationDirectPolicy,
  AnnotationQualityRecord,
  AnnotationSource,
  BlockBootstrapOptions,
  Cf05QualificationResult,
  ContextAdaptiveSwitchPolicy,
  CounterfactualAnnotation,
  EstimatorAgreement,
  EstimatorDiagnostics,
  HeliosOpeLogRow,
  MultiEstimatorOffPolicyResult,
  OffPolicyConfidenceInterval,
  OffPolicyEstimate,
  OffPolicyEvaluationOptions,
  OutcomeModelRow,
  PropensitySupportSummary,
} from './types.ts';

import { evaluateOffPolicyMultiEstimator } from './off-policy-evaluator.ts';

export { evaluateOffPolicyMultiEstimator } from './off-policy-evaluator.ts';

export {
  evaluateCf05OffPolicyQualification,
  qualifyCf05OffPolicyEstimate,
  runCf05Qualification,
} from './qualification.ts';

/** Facade matching the CF05 specification name. */
export const OffPolicyEvaluator = {
  evaluate: evaluateOffPolicyMultiEstimator,
} as const;

export {
  directMethodPoint,
  doublyRobustPoint,
  ipsPoint,
  snipsPoint,
  switchDoublyRobustPoint,
  importanceRatio,
  effectiveSampleSizeFromWeights,
  effectiveSampleSizeFromImportanceRatios,
} from './estimators.ts';
