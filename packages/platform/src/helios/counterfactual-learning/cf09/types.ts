/**
 * HELIOS CF09 — heterogeneous decision-effect intelligence (types).
 */

import type {
  Cf09CausalOutputClassification,
  Cf09ConfoundingStatus,
  Cf09HeterogeneousModelKind,
  Cf09OverlapStatus,
  Cf09RejectionSamplePolicy,
  Cf09SupportStatus,
  Cf09TemporalStabilityStatus,
  Cf09TreatmentConsistencyStatus,
} from './taxonomy.ts';

/**
 * Declares a binary HELIOS decision contrast for heterogeneous effect analysis.
 * Outcomes and covariates are referenced by id; estimation stays outside this package.
 */
export type DecisionTreatmentDefinition = {
  readonly schema: 'sunrey.helios.cf09.decision-treatment.v1';
  readonly definitionId: string;
  readonly label: string;
  readonly treatedArm: string;
  readonly controlArm: string;
  /** Covariate / context feature ids available at decision time (pre-outcome). */
  readonly pretreatmentCovariateRefs: readonly string[];
  /** Outcome definition id (engine-neutral). */
  readonly outcomeRef: string;
  readonly estimatedAtUtc: string;
};

/** One stratum or context slice where a conditional effect is reported. */
export type DecisionContextSlice = {
  readonly sliceId: string;
  readonly description: string;
  /** Predicates on pretreatment features (engine evaluates elsewhere). */
  readonly predicateSummary: string;
};

/**
 * Effect-neutral validation: hyperparameters and folds must not be chosen to maximize
 * estimated treatment effects (e.g. cross-validated risk on residuals/pseudo-outcomes).
 */
export type EffectNeutralValidationCriterion = {
  readonly criterionId: string;
  readonly label: string;
  readonly summary: string;
};

export type CrossFitSpecification = {
  /** Cross-fitting required: at least two held-out folds for nuisance models. */
  readonly foldCount: number;
  readonly foldIds: readonly string[];
};

export type CausalIdentificationAssessment = {
  readonly schema: 'sunrey.helios.cf09.identification.v1';
  readonly treatmentDefinitionId: string;
  readonly contextSliceId: string;
  readonly overlap: Cf09OverlapStatus;
  readonly confounding: Cf09ConfoundingStatus;
  readonly support: Cf09SupportStatus;
  readonly treatmentConsistency: Cf09TreatmentConsistencyStatus;
  readonly temporalStability: Cf09TemporalStabilityStatus;
  readonly rejectionSamplePolicy: Cf09RejectionSamplePolicy;
  /** True when primary rows include risk/compliance rejects as if they were ordinary actions. */
  readonly includesRiskComplianceRejections: boolean;
  readonly crossFit: CrossFitSpecification;
  /** True when model selection used only effect-neutral criteria. */
  readonly modelSelectionIsEffectNeutral: boolean;
  readonly validationCriteria: readonly EffectNeutralValidationCriterion[];
  readonly outputClassification: Cf09CausalOutputClassification;
};

/**
 * A heterogeneous treatment effect estimate for one context slice, paired with its
 * identification assessment (never label association as causality in consumer UIs).
 */
export type ConditionalDecisionEffect = {
  readonly schema: 'sunrey.helios.cf09.conditional-effect.v1';
  readonly treatmentDefinitionId: string;
  readonly contextSlice: DecisionContextSlice;
  readonly modelKind: Cf09HeterogeneousModelKind;
  readonly crossFit: CrossFitSpecification;
  readonly validationCriteria: readonly EffectNeutralValidationCriterion[];
  /**
   * Effect estimate in minor units of the outcome currency as a decimal string, or a
   * signed raw scalar string when the outcome is not monetary (same representation rules
   * as the rest of HELIOS analytics).
   */
  readonly pointEstimate: string;
  readonly intervalLow: string | null;
  readonly intervalHigh: string | null;
  readonly assessment: CausalIdentificationAssessment;
};

/** Aggregate CF09 intelligence artifact for one treatment definition. */
export type HeterogeneousEffectState = {
  readonly schema: 'sunrey.helios.cf09.heterogeneous-effect-state.v1';
  readonly treatment: DecisionTreatmentDefinition;
  readonly effects: readonly ConditionalDecisionEffect[];
  readonly sealedAtUtc: string;
};
