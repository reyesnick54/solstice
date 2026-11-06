import type { UtcInstant } from '@solstice/domain';

import type { BehaviorPolicySnapshotId } from './ids.ts';
import type {
  HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION,
  StochasticPolicyEnvironment,
} from './taxonomy.ts';
import type { PolicySupportState } from './taxonomy.ts';

/** Non-negative rational probability as decimal integer strings (no floats). */
export type ProbabilityRational = {
  readonly numerator: string;
  readonly denominator: string;
};

export type DeterministicBehaviorPolicySnapshot = {
  readonly schemaVersion: typeof HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION;
  readonly snapshotId: BehaviorPolicySnapshotId;
  readonly decisionAtUtc: UtcInstant;
  readonly contextRef: string;
  readonly candidateActionIds: readonly string[];
  readonly chosenActionId: string;
  readonly policyKind: 'DETERMINISTIC_POLICY';
  /** Do not invent P(action|context) for deterministic behavior policies. */
  readonly propensityMasses: null;
  readonly recordNote: 'DETERMINISTIC_POLICY';
  readonly support: 'SUPPORT_LIMITED';
};

export type ActionPropensityMass = {
  readonly actionId: string;
  readonly probabilityMass: ProbabilityRational;
};

export type StochasticBehaviorPolicySnapshot = {
  readonly schemaVersion: typeof HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION;
  readonly snapshotId: BehaviorPolicySnapshotId;
  readonly decisionAtUtc: UtcInstant;
  readonly contextRef: string;
  readonly candidateActionIds: readonly string[];
  readonly chosenActionId: string;
  readonly policyKind: 'STOCHASTIC_POLICY';
  readonly evaluationEnvironment: StochasticPolicyEnvironment;
  /** P(action | context) for every candidate action; sums to 1 when expressed as rationals with a common denominator. */
  readonly propensityMasses: readonly ActionPropensityMass[];
};

export type BehaviorPolicySnapshot = DeterministicBehaviorPolicySnapshot | StochasticBehaviorPolicySnapshot;

/** Effective sample size for overlap / importance-weighted estimators (rational ESS = (sum w)^2 / sum w^2). */
export type EffectiveSampleSize = {
  readonly sampleCount: number;
  readonly essRational: ProbabilityRational;
};

export type PropensityExtremes = {
  readonly minPropensityRational: ProbabilityRational;
  readonly maxPropensityRational: ProbabilityRational;
};

export type KLDivergenceDiagnostic = {
  readonly kind: 'KL_FORWARD_NATURAL';
  /** Natural-log KL divergence; null when undefined (e.g. missing eval policy). */
  readonly value: number | null;
};

export type ImportanceWeightDiagnostics = {
  readonly weightCount: number;
  readonly maxImportanceWeightRational: ProbabilityRational;
  readonly weightVarianceRational: ProbabilityRational;
  readonly propensityExtremes: PropensityExtremes;
};

/** Overlap between logged behavior policy and evaluation policy for OPE. */
export type OverlapAssessment = {
  readonly supportState: PolicySupportState;
  readonly effectiveSampleSize: EffectiveSampleSize;
  readonly maxImportanceWeightRational: ProbabilityRational;
  readonly weightVarianceRational: ProbabilityRational;
  readonly actionSupportRational: ProbabilityRational;
  readonly contextualSupportRational: ProbabilityRational;
  readonly klDivergenceDiagnostics: readonly KLDivergenceDiagnostic[];
  readonly importanceWeightDiagnostics: ImportanceWeightDiagnostics;
};

export type PolicySupportStateGate = {
  readonly counterfactualOpeEstimationPermitted: boolean;
  readonly refusalReason: 'NO_OVERLAP_SUPPORT' | null;
};
