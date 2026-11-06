import type { UtcInstant } from '@solstice/domain';

import type { HeliosCf10GateFamily, HeliosCf10RejectionClassification } from './taxonomy.ts';

/** ESTIMATED — bounded 0..1; interpretation is model-relative, not a calibrated probability claim. */
export type HeliosCf10EstimatedUnitInterval = number;

/**
 * ESTIMATED — multivariate outcome vector (e.g. path PnL, stress, liquidity) in minor units as decimal strings.
 * Keys are model-defined; values are never interpreted as authoritative balances.
 */
export type HeliosCf10MultivariateOutcomeVector = Readonly<Record<string, string>>;

/**
 * Single observation: a gate / reason evaluated against a candidate, with counterfactual and OPE-style estimates.
 * All economics are ESTIMATED minor-unit strings (bigint decimal); no floating money.
 */
export type HeliosCf10GateDecisionObservation = {
  readonly observationId: string;
  readonly gateFamily: HeliosCf10GateFamily;
  readonly reasonCode: string;
  readonly evaluatedAt: UtcInstant;
  readonly outcomeHorizonEndsAt: UtcInstant;
  readonly rejected: boolean;
  /** Counted when this reason participates in an evaluation (gate touched the path). */
  readonly evaluationCount: bigint;
  /** Counted when the decision path ends in reject with this reason as primary. */
  readonly rejectionCount: bigint;
  /**
   * ESTIMATED — realized or simulated forward market path after the decision point, in reporting currency minor units
   * (e.g. foregone path value for the notional under study).
   */
  readonly futureMarketPathResultMinor: string;
  /**
   * ESTIMATED — what the shadow execution layer would have produced under the counterfactual “had the gate passed”
   * assumption; still subject to slippage and policy models.
   */
  readonly executionCounterfactualEstimateMinor: string;
  /**
   * ESTIMATED — off-policy / importance-weighted style value estimate from logged propensity / support;
   * not a live trading signal.
   */
  readonly opeEstimateMinor: string;
  /** ESTIMATED — epistemic confidence in the joint estimate (0..1). */
  readonly estimateConfidence: HeliosCf10EstimatedUnitInterval;
  /** Support mass / effective sample size behind the estimate (may be fractional for weighted OPE). */
  readonly estimateSupport: number;
  /** Regime label the observation is tagged with (e.g. volatility bucket). */
  readonly regimeId: string;
  /** Optional — when present, must inform protective vs costly classification. */
  readonly multivariateOutcomes?: HeliosCf10MultivariateOutcomeVector;
  /**
   * Optional explicit stress flags — when true with protective gate families, rejection is not “costly” on price alone.
   */
  readonly observedDownsideStress?: boolean;
  readonly observedLiquidityStress?: boolean;
  /**
   * Optional risk penalty in minor units to subtract from raw regret (drawdown, liquidity, model risk).
   * ESTIMATED.
   */
  readonly riskAdjustmentMinor?: string;
};

/**
 * ESTIMATED opportunity cost between counterfactual execution and the path that unfolded (or shadow best).
 */
export type HeliosCf10OpportunityCostEstimate = {
  readonly foregoneBestPathMinor: string;
  readonly counterfactualExecutionMinor: string;
  readonly netOpportunityCostMinor: string;
  readonly semantics: 'ESTIMATED';
};

/**
 * ESTIMATED regret after multivariate / risk adjustments (still not a mandate to change gates).
 */
export type HeliosCf10EstimatedDecisionRegret = {
  readonly rawRegretMinor: string;
  readonly riskAdjustedRegretMinor: string;
  readonly semantics: 'ESTIMATED';
};

export type HeliosCf10RejectionReasonPerformance = {
  readonly gateFamily: HeliosCf10GateFamily;
  readonly reasonCode: string;
  readonly evaluated: bigint;
  readonly rejected: bigint;
  readonly futureMarketPathResultMinor: string;
  readonly executionCounterfactualEstimateMinor: string;
  readonly opeEstimateMinor: string;
  readonly confidence: HeliosCf10EstimatedUnitInterval;
  readonly support: number;
  readonly regimeDependence: Readonly<Record<string, number>>;
  readonly semantics: 'ESTIMATED';
};

export type HeliosCf10DecisionGateAttribution = {
  readonly gateFamily: HeliosCf10GateFamily;
  readonly reasonRollups: readonly HeliosCf10RejectionReasonPerformance[];
  readonly semantics: 'ESTIMATED';
};

export type HeliosCf10GateCalibrationState = {
  readonly gateFamily: HeliosCf10GateFamily;
  /** Fraction of evaluations that end in reject (ESTIMATED rolling). */
  readonly empiricalRejectRate: HeliosCf10EstimatedUnitInterval;
  /** How fragmented reasons are within the family (Shannon entropy of reason mix, normalized 0..1). */
  readonly reasonMixEntropy: HeliosCf10EstimatedUnitInterval;
  /** Mean |risk-adjusted regret| for rejected rows, minor units. */
  readonly meanAbsRiskAdjustedRegretRejectedMinor: string;
  readonly sampleRejected: bigint;
  readonly semantics: 'ESTIMATED';
};

export type HeliosCf10DecisionAttributionReport = {
  readonly schema: 'sunrey.helios.counterfactual-learning.cf10.v1';
  readonly qualificationMarker: typeof import('./taxonomy.ts').HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED;
  readonly generatedAt: UtcInstant;
  readonly perObservation: readonly HeliosCf10PerObservationAttribution[];
  readonly gateAttribution: readonly HeliosCf10DecisionGateAttribution[];
  readonly gateCalibration: readonly HeliosCf10GateCalibrationState[];
  readonly semantics: 'ESTIMATED';
};

export type HeliosCf10PerObservationAttribution = {
  readonly observationId: string;
  readonly gateFamily: HeliosCf10GateFamily;
  readonly reasonCode: string;
  readonly opportunityCost: HeliosCf10OpportunityCostEstimate;
  readonly decisionRegret: HeliosCf10EstimatedDecisionRegret;
  readonly rejectionInterpretation: HeliosCf10RejectionClassification;
  readonly notes: readonly string[];
  readonly semantics: 'ESTIMATED';
};
