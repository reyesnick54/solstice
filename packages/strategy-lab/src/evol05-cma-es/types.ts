/**
 * HELIOS EVOL05 — CMA-ES for bounded continuous Strategy Genome parameters only.
 * Categorical strategy architecture is out of scope for this optimizer.
 */

/** Program qualification marker for EVOL05 (CMA-ES continuous parameter search). */
export const HELIOS_EVOL05_CMA_ES_QUALIFIED = 'HELIOS_EVOL05_CMA_ES_QUALIFIED' as const;

/**
 * Economic / policy bounds in native parameter units (e.g. bps, bars, days).
 * The optimizer maps an internal unconstrained coordinate through a sigmoid into (min, max).
 * Use a strictly interior range when zero or negativity must be impossible (e.g. min: 1 for lookback bars).
 */
export type CmaEsParameterBounds = Readonly<{
  readonly parameterId: string;
  readonly min: number;
  readonly max: number;
  /** When true, decoded values are rounded to nearest integer after projection. */
  readonly integral?: boolean;
}>;

export type CmaEsParameterVector = Readonly<Record<string, number>>;

export type CmaEsCandidateValidity =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * One population member: continuous parameters only (strategy architecture is fixed elsewhere).
 */
export type CmaEsCandidate = Readonly<{
  readonly candidateIndex: number;
  readonly generation: number;
  /** Unconstrained vector z in R^n (same order as bounds). */
  readonly z: readonly number[];
  /** Decoded parameters in native units, clamped to bounds. */
  readonly parameters: CmaEsParameterVector;
  readonly validity: CmaEsCandidateValidity;
  /** Inner training/validation objective only — holdout must never be passed here (EVOL05). */
  readonly fitness: number | null;
  /** Sealed audit trail: every evaluated point, including invalid / non-finite fitness. */
  readonly evaluated: boolean;
}>;

export type CmaEsPopulation = Readonly<{
  readonly generation: number;
  readonly candidates: readonly CmaEsCandidate[];
}>;

export type CmaEsGeneration = Readonly<{
  readonly generation: number;
  readonly population: CmaEsPopulation;
  /** State after mean / covariance / step-size update for this generation. */
  readonly nextSearchState: CmaEsSearchState;
  readonly populationMeanUnconstrained: readonly number[];
  readonly sigma: number;
  readonly bestFitness: number | null;
  readonly bestCandidateIndex: number | null;
}>;

export type CmaEsSearchState = Readonly<{
  readonly dimension: number;
  /** Number of covariance updates applied so far (for path-length normalization). */
  readonly updateGeneration: number;
  readonly lambda: number;
  readonly mu: number;
  readonly weights: readonly number[];
  readonly muEff: number;
  readonly cSigma: number;
  readonly dSigma: number;
  readonly cC: number;
  readonly c1: number;
  readonly cMu: number;
  readonly chiN: number;
  /** Mean in unconstrained space. */
  readonly mean: readonly number[];
  /** Global step size. */
  readonly sigma: number;
  /** Covariance in unconstrained space (symmetric PSD). */
  readonly covariance: readonly (readonly number[])[];
  /** Evolution paths for cumulation. */
  readonly pathSigma: readonly number[];
  readonly pathC: readonly number[];
  /** Eigendecomposition of current C: C = B D^2 B^T (columns of B are eigenvectors). */
  readonly B: readonly (readonly number[])[];
  readonly eigenvalues: readonly number[];
  /** Diagonal sqrt(eigenvalues) for sampling. */
  readonly sqrtEigenvalues: readonly number[];
}>;

/** Explicit guard: optimizers must not use holdout feedback inside the search loop. */
export const HOLDOUT_FEEDBACK_LEAKAGE = 'HOLDOUT_FEEDBACK_LEAKAGE' as const;

export type CmaEsObjectiveWindow = 'TRAIN' | 'VALIDATION' | 'INNER_NESTED';
