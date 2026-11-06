import {
  HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED,
  HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED,
  type Cf06DistributionalEstimatorKind,
  type Cf06ValidationStrength,
} from './taxonomy.ts';

/**
 * One sample from a logged policy (behavior) trajectory used for off-policy evaluation.
 */
export type Cf06LoggedTrajectorySample = {
  /** Observed outcome in policy outcome units (minor units when outcome is monetary). */
  readonly outcomeMinor: string;
  /** Probability under the logging (behavior) policy π_b(a|s). */
  readonly behaviorPolicyProbabilityBps: number;
  /** Probability under the evaluation policy π_e(a|s). */
  readonly evalPolicyProbabilityBps: number;
  /** Optional realized peak-to-trough drawdown over the horizon (minor units), for tail-of-drawdown summaries. */
  readonly peakToTroughDrawdownMinor?: string | null;
};

/**
 * Empirical / factual outcome distribution summary (from observed data).
 */
export type CounterfactualOutcomeDistribution = {
  readonly schema: 'sunrey.helios.cf06.counterfactual-outcome-distribution.v1';
  readonly sampleCount: number;
  readonly meanMinor: string;
  readonly medianMinor: string;
  readonly p05Minor: string;
  readonly p10Minor: string;
  readonly p25Minor: string;
  readonly p75Minor: string;
  readonly p90Minor: string;
  readonly p95Minor: string;
  /** Probability that the outcome is strictly below zero (loss in outcome space). */
  readonly probabilityOfLossBps: number | null;
  /** Probability that peak-to-trough drawdown in minor units exceeds the threshold. */
  readonly probabilityOfDrawdownAboveThresholdBps: number | null;
  /** Expected outcome conditional on being at or below the p05 threshold (tail CVaR-style). Minor units. */
  readonly expectedShortfallBelowP05Minor: string | null;
  /** Mean outcome in the top decile (p90–p100), minor units. */
  readonly upsideTailMeanMinor: string | null;
  /** Mean outcome in the bottom decile (p0–p10), minor units. */
  readonly downsideTailMeanMinor: string | null;
};

export type CounterfactualQuantileEstimate = {
  readonly probabilityMassBps: number;
  /** Quantile value in outcome minor units. */
  readonly valueMinor: string;
  readonly standardErrorMinor: string | null;
};

/**
 * Tail summary for alternative-policy risk views.
 */
export type TailOutcomeState = {
  readonly probabilityOfLossBps: number | null;
  readonly probabilityOfDrawdownAboveThresholdBps: number | null;
  readonly expectedShortfallBelowP05Minor: string | null;
  readonly upsideTailMeanMinor: string | null;
  readonly downsideTailMeanMinor: string | null;
};

/**
 * Distributional estimate of outcomes under an alternative (evaluation) policy.
 */
export type DistributionalPolicyEstimate = {
  readonly schema: 'sunrey.helios.cf06.distributional-policy-estimate.v1';
  readonly estimatorKind: Cf06DistributionalEstimatorKind;
  /** When validation is weak, this stays research-only; production surfaces should not treat it as certified. */
  readonly validationStrength: Cf06ValidationStrength;
  readonly sampleCountEffective: number;
  readonly quantiles: {
    readonly mean: CounterfactualQuantileEstimate;
    readonly median: CounterfactualQuantileEstimate;
    readonly p05: CounterfactualQuantileEstimate;
    readonly p10: CounterfactualQuantileEstimate;
    readonly p25: CounterfactualQuantileEstimate;
    readonly p75: CounterfactualQuantileEstimate;
    readonly p90: CounterfactualQuantileEstimate;
    readonly p95: CounterfactualQuantileEstimate;
  };
  readonly tails: TailOutcomeState;
};

/**
 * Comparison of factual vs estimated alternative-policy distribution.
 * Named EstimatedPolicyOutcomeDifference — not "profit missed".
 */
export type EstimatedPolicyOutcomeDifference = {
  readonly schema: 'sunrey.helios.cf06.estimated-policy-outcome-difference.v1';
  readonly factual: CounterfactualOutcomeDistribution;
  readonly alternativePolicyEstimate: DistributionalPolicyEstimate;
  /** Signed difference (alternative − factual) for central summaries; minor units. */
  readonly meanDifferenceMinor: string;
  readonly medianDifferenceMinor: string;
  readonly p05DifferenceMinor: string;
  readonly p10DifferenceMinor: string;
  readonly p25DifferenceMinor: string;
  readonly p75DifferenceMinor: string;
  readonly p90DifferenceMinor: string;
  readonly p95DifferenceMinor: string;
  /** Epistemic / sampling uncertainty on the mean difference (minor units). */
  readonly meanDifferenceStandardErrorMinor: string | null;
};

export type Cf06QualificationResult = {
  readonly marker: typeof HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED | typeof HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED;
  readonly blockers: readonly string[];
};
