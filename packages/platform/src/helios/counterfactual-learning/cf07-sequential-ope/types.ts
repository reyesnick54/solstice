/**
 * HELIOS CF07 — sequential OPE domain types (simulation / research only).
 */

import type { HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION } from './taxonomy.ts';
import type {
  HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED,
  HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED,
} from './taxonomy.ts';

/** Optional history features for behavior and evaluation propensities (history-dependent modeling). */
export type BehaviorHistoryContext = {
  readonly priorPositionsSummary?: string;
  readonly priorTradesSummary?: string;
  readonly pnlPathMinor?: readonly bigint[];
  readonly drawdownBps?: number;
  readonly remainingMandateBps?: number;
  readonly cashMinor?: bigint;
  readonly marginUsedMinor?: bigint;
  readonly regimeLabel?: string;
  readonly previousAgentConclusions?: readonly string[];
};

/**
 * One decision on a trajectory; propensities are under the logged history (cf. stateKey / history).
 */
export type DecisionTrajectoryStep = {
  readonly stepIndex: number;
  /** Discrete summary of pre-decision state (may embed history). */
  readonly stateKey: string;
  readonly actionKey: string;
  /** Reward in minor units (integer). */
  readonly rewardMinor: bigint;
  /**
   * Behavior policy probability of the taken action given history σ(a|h).
   * Must be in (0, 1] for weighting; caller supplies a floor when modeling.
   */
  readonly behaviorPropensity: number;
  /**
   * Evaluation policy probability of the same action under the same history π(a|h).
   */
  readonly evaluationPropensity: number;
  /** When present, documents support for history-conditioned propensity models. */
  readonly history?: BehaviorHistoryContext;
};

export type DecisionTrajectory = {
  readonly schema: typeof HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION;
  readonly trajectoryId: string;
  readonly steps: readonly DecisionTrajectoryStep[];
};

/** Portfolio snapshot at a decision boundary (minor units, simulation). */
export type PortfolioState = {
  readonly cashMinor: bigint;
  readonly marginUsedMinor: bigint;
  /** Encoded positions, e.g. instrument id -> quantity minor. */
  readonly positionEncoding: string;
  readonly unrealizedPnlMinor: bigint;
};

export type PortfolioConstraintSpec = {
  readonly capitalMinor: bigint;
  readonly maxPositionUnitsMinor?: bigint;
  readonly maxLeverageNumerator?: number;
  readonly maxLeverageDenominator?: number;
  readonly mandateRemainingMinor?: bigint;
  readonly maxRiskNotionalMinor?: bigint;
};

export type ConstraintViolationKind =
  | 'CAPITAL_CONSERVATION'
  | 'SETTLEMENT'
  | 'MARGIN'
  | 'POSITION_LIMIT'
  | 'MANDATE'
  | 'RISK_LIMIT';

export type PortfolioConstraintViolation = {
  readonly kind: ConstraintViolationKind;
  readonly stepIndex: number;
  readonly detail: string;
};

/**
 * Feasible transition along the observed path (counterfactual path must not invent capital).
 */
export type PortfolioStateTransition = {
  readonly stepIndex: number;
  readonly from: PortfolioState;
  readonly to: PortfolioState;
  readonly capitalConserved: boolean;
  readonly settlementFeasible: boolean;
  readonly marginFeasible: boolean;
};

export type TrajectorySupportAssessment = {
  /** Share of state-action pairs in trajectories that appeared at least once in the support set. */
  readonly trajectoryCoverage: number;
  /** Kish effective sample size for sequential importance weights across trajectories. */
  readonly effectiveTrajectorySampleSize: number;
  /** max_t max_i ρ_{0:t} over trajectories (explosion diagnostic). */
  readonly importanceWeightMax: number;
  /** Fraction of weight mass on state keys below a minimum visit threshold. */
  readonly stateExtrapolationFraction: number;
  readonly blockReasons: readonly string[];
};

export type FittedQEvaluationState = {
  readonly iteration: number;
  readonly bellmanResidualMean: number;
  readonly bellmanResidualMax: number;
  readonly converged: boolean;
  readonly diverged: boolean;
};

export type OpeDiagnostics = {
  readonly fqe: FittedQEvaluationState | null;
  readonly sequentialImportanceWeightsPerTrajectory: readonly number[];
  readonly sequentialDoublyRobustTermsPerTrajectory: readonly number[];
  readonly trajectorySupport: TrajectorySupportAssessment;
  readonly importanceWeightExplosion: boolean;
  readonly stateExtrapolationSuspected: boolean;
};

export type SequentialPolicyEstimate = {
  readonly method: 'SEQUENTIAL_IMPORTANCE_SAMPLING' | 'SEQUENTIAL_DR' | 'FQE_VALUE';
  /** Expected return in minor units (integer aggregate). */
  readonly valueMinor: bigint;
  readonly diagnostics: OpeDiagnostics;
};

export type SequentialOpeResult = {
  readonly qualified: boolean;
  readonly qualificationMarker:
    | typeof HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED
    | typeof HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED;
  readonly portfolioViolations: readonly PortfolioConstraintViolation[];
  readonly estimates: {
    readonly wis: SequentialPolicyEstimate | null;
    readonly dr: SequentialPolicyEstimate | null;
    readonly fqe: SequentialPolicyEstimate | null;
  };
  readonly blockedReasons: readonly string[];
};
