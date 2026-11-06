/**
 * HELIOS CF09 — heterogeneous decision-effect intelligence (counterfactual learning).
 */

export {
  CF09_EXAMPLE_DECISION_ARMS,
  CF09_HETEROGENEOUS_MODEL_KINDS,
  HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED,
  HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED,
  type Cf09CausalOutputClassification,
  type Cf09ConfoundingStatus,
  type Cf09ExampleDecisionArm,
  type Cf09HeterogeneousModelKind,
  type Cf09OverlapStatus,
  type Cf09RejectionSamplePolicy,
  type Cf09SupportStatus,
  type Cf09TemporalStabilityStatus,
  type Cf09TreatmentConsistencyStatus,
} from './taxonomy.ts';

export type {
  CausalIdentificationAssessment,
  ConditionalDecisionEffect,
  CrossFitSpecification,
  DecisionContextSlice,
  DecisionTreatmentDefinition,
  EffectNeutralValidationCriterion,
  HeterogeneousEffectState,
} from './types.ts';

export {
  conditionalEffectRespectsCausalLabel,
  deriveCf09OutputClassification,
  identificationAssessmentIsInternallyConsistent,
  validateDecisionTreatmentDefinition,
} from './assessment.ts';

export { evaluateCf09HeterogeneousEffectsQualification, type Cf09QualificationResult } from './qualification.ts';
