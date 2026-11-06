/**
 * HELIOS CF09 — heterogeneous decision-effect intelligence (taxonomy).
 */

export const HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED =
  'HELIOS_CF09_HETEROGENEOUS_EFFECTS_QUALIFIED' as const;

export const HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED = 'HELIOS_CF09_HETEROGENEOUS_EFFECTS_BLOCKED' as const;

/** Example HELIOS decision arms for treatment definitions (non-exhaustive). */
export const CF09_EXAMPLE_DECISION_ARMS = Object.freeze([
  'ENTER',
  'NO_ACTION',
  'ENTER_NOW',
  'WAIT',
  'FULL_SIZE',
  'REDUCED_SIZE',
  'LIMIT',
  'AGGRESSIVE_LIMIT',
  'EARLY_EXIT',
  'HOLD',
] as const);

export type Cf09ExampleDecisionArm = (typeof CF09_EXAMPLE_DECISION_ARMS)[number];

/** Heterogeneous effect estimators supported by the CF09 research method set. */
export const CF09_HETEROGENEOUS_MODEL_KINDS = Object.freeze([
  'DML_ORTHOGONAL_LEARNER',
  'R_LEARNER',
  'CAUSAL_FOREST',
  'PENALIZED_SMOOTH_HETEROGENEOUS',
] as const);

export type Cf09HeterogeneousModelKind = (typeof CF09_HETEROGENEOUS_MODEL_KINDS)[number];

export type Cf09OverlapStatus = 'ADEQUATE' | 'WEAK' | 'FAILED';

export type Cf09ConfoundingStatus = 'ADDRESSED' | 'RESIDUAL_CONCERN' | 'UNADDRESSED';

export type Cf09SupportStatus = 'ADEQUATE' | 'SPARSE' | 'FAILED';

export type Cf09TreatmentConsistencyStatus = 'CONSISTENT' | 'MIXED' | 'FAILED';

export type Cf09TemporalStabilityStatus = 'STABLE' | 'UNSTABLE' | 'UNKNOWN';

/**
 * How risk/compliance rejections enter the analysis sample.
 * Rejections are not automatically valid counterfactual controls.
 */
export type Cf09RejectionSamplePolicy = 'EXCLUDED_FROM_ESTIMATION' | 'ANALYZED_SEPARATELY' | 'INCLUDED_WITH_EXPLICIT_RATIONALE';

export type Cf09CausalOutputClassification =
  | 'CAUSAL_ESTIMATE_SUPPORTED'
  | 'ASSOCIATIONAL_ONLY'
  | 'INSUFFICIENT_SUPPORT'
  | 'IDENTIFICATION_FAILED';
