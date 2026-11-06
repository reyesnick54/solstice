import {
  HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED,
  HELIOS_CF05_OPE_BLOCKED,
  HELIOS_CF05_SCHEMA,
} from './taxonomy.ts';
import type { OpeEstimatorKind, OpeEvaluationStatus } from './taxonomy.ts';

/** Provenance for imperfect counterfactual or analyst labels (CANDOR-inspired). */
export type AnnotationSource =
  | 'analyst'
  | 'agent'
  | 'generated_counterfactual'
  | 'system'
  | 'unknown';

/** Lightweight calibration snapshot (bins sum to declared coverage). */
export type AnnotationCalibrationBin = {
  readonly binLabel: string;
  readonly expected: number;
  readonly observed: number;
};

/**
 * Optional research annotations. Never used as observed actions for IPS/SNIPS/DR weights;
 * they may inform the direct-method path only when policy permits.
 */
export type CounterfactualAnnotation = {
  readonly source: AnnotationSource;
  /** Research weight / belief strength in [0, 1]. */
  readonly confidence: number;
  readonly calibration: readonly AnnotationCalibrationBin[];
  readonly modelVersion: string;
  readonly evidence: readonly string[];
};

/** CF03 — propensity and overlap inputs for behavior vs target policies. */
export type PropensitySupportSummary = {
  readonly minBehaviorPropensity: number;
  readonly maxBehaviorPropensity: number;
  readonly meanBehaviorPropensity: number;
  /** max π_e/π_b over the logged sample (untruncated). */
  readonly maxImportanceRatio: number;
  /** Optional cap applied in SWITCH_DR (same units as importance ratio). */
  readonly importanceWeightCap?: number;
};

/** CF04 — conditional outcome model outputs consumed by DR / direct method. */
export type OutcomeModelRow = {
  /** μ(x, a_obs) — prediction at the logged action. */
  readonly meanUnderObservedAction: number;
  /**
   * E[Y | x, A ~ π_e] under the target policy (integrated prediction), used for direct method
   * and for the DR plug-in μ(x, π_e).
   */
  readonly meanUnderTargetPolicy: number;
};

export type HeliosOpeLogRow = {
  readonly blockId: string;
  readonly timeBucketId: string;
  /** Logged (factual) action identifier for auditing only — not used as π(a|x) for IPS. */
  readonly observedActionId: string;
  /** Observed factual outcome (e.g. reward). */
  readonly outcome: number;
  /** Behavior policy propensity π_b(a_obs|x). Must be > 0 where IPS-based estimators run. */
  readonly behaviorPropensity: number;
  /** Target policy propensity π_e(a_obs|x) for the logged action. */
  readonly targetPropensity: number;
  readonly outcomeModel: OutcomeModelRow;
  readonly annotation?: CounterfactualAnnotation;
};

export type BlockBootstrapOptions = {
  /** e.g. 0.95 for a two-sided central interval. */
  readonly confidenceLevel: number;
  readonly bootstrapReplicates: number;
  /** Deterministic seed for reproducible bootstrap (integer). */
  readonly rngSeed: number;
};

export type AnnotationDirectPolicy = 'forbid' | 'permit';

export type ContextAdaptiveSwitchPolicy = {
  readonly enabled: boolean;
  /**
   * When DR bootstrap variance exceeds this multiple of self-normalized IPS variance,
   * report SWITCH_DR point estimate aligned with the safer SNIPS path (documented in diagnostics).
   */
  readonly varianceRatioThreshold: number;
};

export type OffPolicyEvaluationOptions = {
  /** Which estimators to report (default: all five). */
  readonly estimators?: ReadonlySet<OpeEstimatorKind>;
  readonly bootstrap: BlockBootstrapOptions;
  /** Minimum effective sample size (SNIPS-style) required for qualification. */
  readonly minimumEffectiveSampleSize: number;
  /** Maximum allowed importance ratio before support is considered weak. */
  readonly maximumImportanceRatio: number;
  /**
   * Relative spread of point estimates across estimators above which status = INCONCLUSIVE.
   * Default interpretation: coefficient of variation above this threshold triggers INCONCLUSIVE.
   */
  readonly inconclusiveCovThreshold: number;
  /** Cap on importance weights for SWITCH_DOUBLY_ROBUST (τ in w' = min(w, τ)). */
  readonly switchImportanceCap: number;
  readonly annotationDirectPolicy: AnnotationDirectPolicy;
  readonly contextAdaptiveSwitch: ContextAdaptiveSwitchPolicy;
};

export type OffPolicyConfidenceInterval = {
  readonly level: number;
  readonly lower: number;
  readonly upper: number;
  readonly method: 'block_bootstrap_percentile';
};

export type AnnotationQualityRecord = {
  readonly rowIndex: number;
  readonly source: AnnotationSource;
  readonly confidence: number;
  readonly calibration: readonly AnnotationCalibrationBin[];
  readonly modelVersion: string;
  readonly evidenceCount: number;
};

export type EstimatorDiagnostics = {
  readonly estimator: OpeEstimatorKind;
  readonly pointEstimate: number;
  readonly effectiveSampleSize: number;
  readonly usedAnnotationInDirectMethod: boolean;
  readonly bootstrapStdError?: number;
  readonly notes: readonly string[];
};

export type OffPolicyEstimate = {
  readonly estimator: OpeEstimatorKind;
  readonly expectedOutcome: number;
  readonly confidenceInterval: OffPolicyConfidenceInterval | null;
  readonly effectiveSampleSize: number;
  readonly support: PropensitySupportSummary;
  readonly diagnostics: EstimatorDiagnostics;
  readonly annotationQuality: readonly AnnotationQualityRecord[];
};

export type EstimatorAgreement = {
  readonly meanEstimate: number;
  readonly minEstimate: number;
  readonly maxEstimate: number;
  readonly range: number;
  readonly coefficientOfVariation: number;
  readonly maxPairwiseAbsDiff: number;
};

export type Cf05QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED
    | typeof HELIOS_CF05_OPE_BLOCKED;
  readonly blockers: readonly string[];
};

export type MultiEstimatorOffPolicyResult = {
  readonly schemaVersion: typeof HELIOS_CF05_SCHEMA;
  readonly status: OpeEvaluationStatus;
  readonly estimates: readonly OffPolicyEstimate[];
  readonly estimatorAgreement: EstimatorAgreement;
  readonly qualification: Cf05QualificationResult;
};
