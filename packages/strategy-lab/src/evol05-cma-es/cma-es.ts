/**
 * (μ, λ)-CMA-ES in unconstrained coordinates with bounded decode per dimension.
 * References: Hansen (CMA-ES tutorial) — faithful enough for deterministic research.
 */

import {
  jacobiEigenDecomposition,
  matAdd,
  matScale,
  matVecMul,
  matZeros,
  outer,
  symmetrize,
  vecCopy,
  vecMultiply,
  vecNorm,
  vecScale,
  vecSub,
  vecZeros,
} from './linear-algebra.ts';
import { createCmaEsRngState, nextCmaEsStandardNormal, type CmaEsRngState } from './rng.ts';
import type {
  CmaEsCandidate,
  CmaEsGeneration,
  CmaEsParameterBounds,
  CmaEsParameterVector,
  CmaEsPopulation,
  CmaEsSearchState,
} from './types.ts';

const EPS_DECODE = 1e-12;
const MIN_EIGEN = 1e-18;

function defaultLambda(n: number): number {
  return 4 + Math.floor(3 * Math.log(n));
}

function defaultMu(lambda: number): number {
  return Math.floor(lambda / 2);
}

/** Positive recombination weights, descending, sum normalized to 1. */
function recombinationWeights(mu: number): number[] {
  const raw: number[] = [];
  for (let i = 1; i <= mu; i += 1) {
    raw.push(Math.log(mu + 0.5) - Math.log(i));
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0 || !Number.isFinite(sum)) {
    const uniform = 1 / mu;
    return Array(mu).fill(uniform);
  }
  return raw.map((w) => w / sum);
}

function muEffective(weights: readonly number[]): number {
  const sSq = weights.reduce((a, w) => a + w * w, 0);
  return 1 / Math.max(EPS_DECODE, sSq);
}

function chiExpectationN(n: number): number {
  return Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
}

function nativeToUnconstrained(t: number, min: number, max: number): number {
  const span = max - min;
  if (!(span > 0)) {
    throw new Error('CmaEsParameterBounds requires max > min');
  }
  const p = Math.min(1 - EPS_DECODE, Math.max(EPS_DECODE, (t - min) / span));
  return Math.log(p / (1 - p));
}

export function decodeUnconstrainedToParameters(
  z: readonly number[],
  bounds: readonly CmaEsParameterBounds[],
): CmaEsParameterVector {
  const out: Record<string, number> = {};
  for (let i = 0; i < bounds.length; i += 1) {
    const b = bounds[i]!;
    const s = 1 / (1 + Math.exp(-z[i]!));
    let v = b.min + (b.max - b.min) * s;
    if (b.integral) {
      v = Math.round(v);
      v = Math.min(b.max, Math.max(b.min, v));
    }
    out[b.parameterId] = v;
  }
  return Object.freeze(out);
}

/** Optional per-parameter policy checks (e.g. lookback &gt; 0, liquidity threshold &gt; 0). */
export type CmaEsPolicyGate = (
  params: CmaEsParameterVector,
  bounds: readonly CmaEsParameterBounds[],
) => { ok: boolean; reason?: string };

function defaultPolicyGate(
  params: CmaEsParameterVector,
  bounds: readonly CmaEsParameterBounds[],
): { ok: boolean; reason?: string } {
  for (const b of bounds) {
    const v = params[b.parameterId]!;
    if (!Number.isFinite(v)) {
      return { ok: false, reason: `non-finite value for ${b.parameterId}` };
    }
    if (v < b.min || v > b.max) {
      return { ok: false, reason: `${b.parameterId} out of bounds after decode` };
    }
    if (b.integral && !Number.isInteger(v)) {
      return { ok: false, reason: `${b.parameterId} must be integral` };
    }
  }
  return { ok: true };
}

export function createInitialCmaEsSearchState(input: {
  readonly bounds: readonly CmaEsParameterBounds[];
  readonly initialParameters: CmaEsParameterVector;
  readonly seed: number;
  readonly lambda?: number;
  readonly sigma0?: number;
}): CmaEsSearchState {
  const n = input.bounds.length;
  if (n === 0) {
    throw new Error('CMA-ES requires at least one bounded parameter');
  }
  const lambda = input.lambda ?? defaultLambda(n);
  const mu = defaultMu(lambda);
  if (mu < 1) {
    throw new Error('CMA-ES lambda too small for positive selection');
  }
  const weights = Object.freeze(recombinationWeights(mu));
  const muEff = muEffective(weights);

  const cSigma = (muEff + 2) / (n + muEff + 5);
  const dSigma =
    1 + (2 * Math.max(0, Math.sqrt((muEff - 1) / (n + 1)) - 1)) + cSigma;
  const cC = (4 + muEff / n) / (n + 4 + (2 * muEff) / n);
  const c1 = 2 / ((n + 1.3) * (n + 1.3) + muEff);
  const cMu = Math.min(1 - c1, (2 * (muEff - 2 + 1 / muEff)) / ((n + 2) * (n + 2) + muEff));

  const mean = vecZeros(n);
  for (let i = 0; i < n; i += 1) {
    const b = input.bounds[i]!;
    const t = input.initialParameters[b.parameterId];
    if (t === undefined || !Number.isFinite(t)) {
      throw new Error(`initialParameters missing or invalid for ${b.parameterId}`);
    }
    mean[i] = nativeToUnconstrained(t, b.min, b.max);
  }

  const C = symmetrize([
    ...Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ),
  ]);

  const eig = jacobiEigenDecomposition(C);
  if (!eig) {
    throw new Error('CMA-ES initial eigendecomposition failed');
  }
  const sqrtEig = eig.eigenvalues.map((ev) => Math.sqrt(Math.max(MIN_EIGEN, ev)));

  const pathSigma = vecZeros(n);
  const pathC = vecZeros(n);
  const sigma = input.sigma0 ?? 0.5;

  return Object.freeze({
    dimension: n,
    updateGeneration: 0,
    lambda,
    mu,
    weights,
    muEff,
    cSigma,
    dSigma,
    cC,
    c1,
    cMu,
    chiN: chiExpectationN(n),
    mean: Object.freeze(mean),
    sigma,
    covariance: Object.freeze(C.map((row) => Object.freeze([...row]))),
    pathSigma: Object.freeze(pathSigma),
    pathC: Object.freeze(pathC),
    B: Object.freeze(eig.B.map((row) => Object.freeze([...row]))),
    eigenvalues: Object.freeze(eig.eigenvalues),
    sqrtEigenvalues: Object.freeze(sqrtEig),
  });
}

function sampleUnconstrainedVector(
  m: readonly number[],
  sigma: number,
  B: readonly (readonly number[])[],
  sqrtEigenvalues: readonly number[],
  rng: CmaEsRngState,
): number[] {
  const n = m.length;
  const xi = vecZeros(n);
  for (let i = 0; i < n; i += 1) {
    xi[i] = nextCmaEsStandardNormal(rng);
  }
  const scaled = vecMultiply(sqrtEigenvalues, xi);
  const rotated = matVecMul(B, scaled);
  return rotated.map((v, i) => m[i]! + sigma * v);
}

function sortByFitnessMaxFirst(
  candidates: readonly CmaEsCandidate[],
  fitnessOf: (c: CmaEsCandidate) => number | null,
): CmaEsCandidate[] {
  const scored = candidates.map((c) => ({
    c,
    f: fitnessOf(c),
  }));
  scored.sort((a, b) => {
    const fa = a.f;
    const fb = b.f;
    if (fa === null && fb === null) return a.c.candidateIndex - b.c.candidateIndex;
    if (fa === null) return 1;
    if (fb === null) return -1;
    if (fb !== fa) return fb - fa;
    return a.c.candidateIndex - b.c.candidateIndex;
  });
  return scored.map((s) => s.c);
}

export function runCmaEsGeneration(input: {
  readonly searchState: CmaEsSearchState;
  readonly bounds: readonly CmaEsParameterBounds[];
  readonly generation: number;
  readonly seed: number;
  /** Higher is better; must use only inner windows — never holdout (caller's contract). */
  readonly evaluateFitness: (params: CmaEsParameterVector, candidate: CmaEsCandidate) => number | null;
  readonly policyGate?: CmaEsPolicyGate;
}): CmaEsGeneration {
  const { searchState, bounds, generation } = input;
  const policyGate = input.policyGate ?? defaultPolicyGate;
  const n = searchState.dimension;
  if (bounds.length !== n) {
    throw new Error('bounds length must match searchState.dimension');
  }

  const rng = createCmaEsRngState(input.seed + generation * 1_000_003 + 17);

  const candidates: CmaEsCandidate[] = [];

  for (let i = 0; i < searchState.lambda; i += 1) {
    const z = sampleUnconstrainedVector(
      searchState.mean,
      searchState.sigma,
      searchState.B,
      searchState.sqrtEigenvalues,
      rng,
    );
    const parameters = decodeUnconstrainedToParameters(z, bounds);
    const policy = policyGate(parameters, bounds);
    const validity = policy.ok ? ({ ok: true } as const) : { ok: false, reason: policy.reason ?? 'policy' };

    const partial: CmaEsCandidate = Object.freeze({
      candidateIndex: i,
      generation,
      z: Object.freeze([...z]),
      parameters,
      validity,
      fitness: null,
      evaluated: false,
    });

    let fitness: number | null = null;
    if (validity.ok) {
      fitness = input.evaluateFitness(parameters, partial);
    }

    candidates.push(
      Object.freeze({
        ...partial,
        fitness,
        evaluated: true,
      }),
    );
  }

  const sorted = sortByFitnessMaxFirst(candidates, (c) => c.fitness);
  const best = sorted[0]!;
  const bestFitness = best.fitness;
  const bestIdx =
    bestFitness === null
      ? null
      : candidates.findIndex((c) => c === best);

  const mOld = vecCopy(searchState.mean as unknown as number[]);
  const ySel: number[][] = [];
  let mNew = vecZeros(n);
  for (let j = 0; j < searchState.mu; j += 1) {
    const parent = sorted[j]!;
    const zP = [...parent.z];
    ySel.push(vecScale(vecSub(zP, mOld), 1 / Math.max(EPS_DECODE, searchState.sigma)));
    const wj = searchState.weights[j] ?? 0;
    for (let d = 0; d < n; d += 1) {
      mNew[d] = (mNew[d] ?? 0) + wj * (zP[d] ?? 0);
    }
  }

  const yW = vecZeros(n);
  for (let j = 0; j < searchState.mu; j += 1) {
    const wj = searchState.weights[j] ?? 0;
    for (let d = 0; d < n; d += 1) {
      yW[d] = (yW[d] ?? 0) + wj * (ySel[j]?.[d] ?? 0);
    }
  }

  const C = searchState.covariance.map((row) => [...row]);

  // C^{-1/2} y_w = B diag(1/sqrt(λ)) B^T y_w with eigen-decomposition C = B diag(λ) B^T.
  const Bt = transposeInternal(searchState.B);
  const invSqrtLambda = searchState.sqrtEigenvalues.map((s) => 1 / Math.max(MIN_EIGEN, s));
  const btY = matVecMul(Bt, yW);
  const invSqrtBtY = vecMultiply(invSqrtLambda, btY);
  const invCsqrtY = matVecMul(searchState.B, invSqrtBtY);

  const pathSigmaNew = vecZeros(n);
  const psFactor = Math.sqrt(searchState.cSigma * (2 - searchState.cSigma) * searchState.muEff);
  for (let d = 0; d < n; d += 1) {
    pathSigmaNew[d] =
      (1 - searchState.cSigma) * searchState.pathSigma[d]! + psFactor * invCsqrtY[d]!;
  }

  const psNorm = vecNorm(pathSigmaNew);
  const pathDenom = Math.sqrt(1 - Math.pow(1 - searchState.cSigma, 2 * (searchState.updateGeneration + 1)));
  const hsThreshold = (1.4 + 2 / (n + 1)) * searchState.chiN;
  const hSigma = psNorm / Math.max(EPS_DECODE, pathDenom) < hsThreshold ? 1 : 0;

  const pathCNew = vecZeros(n);
  const pcFactor = hSigma * Math.sqrt(searchState.cC * (2 - searchState.cC) * searchState.muEff);
  for (let d = 0; d < n; d += 1) {
    pathCNew[d] = (1 - searchState.cC) * searchState.pathC[d]! + pcFactor * yW[d]!;
  }

  let Cnext = symmetrize(
    matAdd(matScale(C, 1 - searchState.c1 - searchState.cMu), matScale(outer(pathCNew, pathCNew), searchState.c1)),
  );

  const rankMu = matZeros(n);
  for (let j = 0; j < searchState.mu; j += 1) {
    const wj = searchState.weights[j]!;
    const y = ySel[j]!;
    const O = outer(y, y);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        rankMu[r]![c]! += wj * O[r]![c]!;
      }
    }
  }
  Cnext = symmetrize(matAdd(Cnext, matScale(rankMu, searchState.cMu)));

  const sigmaNew =
    searchState.sigma *
    Math.exp(
      (searchState.cSigma / searchState.dSigma) * (psNorm / Math.max(EPS_DECODE, searchState.chiN) - 1),
    );

  const eig = jacobiEigenDecomposition(Cnext);
  if (!eig) {
    throw new Error('CMA-ES covariance eigendecomposition failed after update');
  }
  const floorEigen = eig.eigenvalues.map((ev) => Math.max(MIN_EIGEN, ev));
  const sqrtEig = floorEigen.map((ev) => Math.sqrt(ev));
  const Bnew = eig.B.map((row) => [...row]);

  const nextSearchState: CmaEsSearchState = Object.freeze({
    ...searchState,
    updateGeneration: searchState.updateGeneration + 1,
    mean: Object.freeze(mNew),
    sigma: sigmaNew,
    covariance: Object.freeze(Cnext.map((row) => Object.freeze([...row]))),
    pathSigma: Object.freeze(pathSigmaNew),
    pathC: Object.freeze(pathCNew),
    B: Object.freeze(Bnew.map((row) => Object.freeze([...row]))),
    eigenvalues: Object.freeze(floorEigen),
    sqrtEigenvalues: Object.freeze(sqrtEig),
  });

  const population: CmaEsPopulation = Object.freeze({
    generation,
    candidates: Object.freeze(candidates),
  });

  return Object.freeze({
    generation,
    population,
    nextSearchState,
    populationMeanUnconstrained: Object.freeze(mNew),
    sigma: sigmaNew,
    bestFitness,
    bestCandidateIndex: bestIdx,
  });
}

function transposeInternal(M: readonly (readonly number[])[]): number[][] {
  const n = M.length;
  const m = M[0]?.length ?? 0;
  const R: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      R[j]![i]! = M[i]![j]!;
    }
  }
  return R;
}

