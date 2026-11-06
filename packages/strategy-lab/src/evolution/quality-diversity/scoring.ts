import type { Ratio } from '@solstice/risk';

import type { NicheFitnessComponents } from './types.ts';

const RATIO_SCALE = 100_000_000n;

function ratioToUnitless(r: Ratio | null): number {
  if (r === null || r.units === 0n) {
    return 0;
  }
  return Number(r.units) / Number(RATIO_SCALE);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.max(0, Math.min(1, x));
}

/**
 * Lexicographic multi-objective comparison for MAP-Elites **within one niche**.
 * Order: risk-adjusted performance (higher), then robustness and integrity,
 * then lower drawdown / costs / overfitting risk. Not a single Sharpe.
 */
export function compareNicheFitness(a: NicheFitnessComponents, b: NicheFitnessComponents): number {
  const ra = ratioToUnitless(a.riskAdjustedPerformance);
  const rb = ratioToUnitless(b.riskAdjustedPerformance);
  if (ra !== rb) {
    return ra > rb ? 1 : -1;
  }

  const da = ratioToUnitless(a.maxDrawdown);
  const db = ratioToUnitless(b.maxDrawdown);
  if (da !== db) {
    return da < db ? 1 : -1;
  }

  if (a.stabilityScore !== b.stabilityScore) {
    return a.stabilityScore > b.stabilityScore ? 1 : -1;
  }

  const costA = a.transactionCostsMinor;
  const costB = b.transactionCostsMinor;
  if (costA !== costB) {
    return costA < costB ? 1 : -1;
  }

  if (a.capacityScore !== b.capacityScore) {
    return a.capacityScore > b.capacityScore ? 1 : -1;
  }

  const turnA = a.turnoverBps;
  const turnB = b.turnoverBps;
  if (turnA !== turnB) {
    return turnA < turnB ? 1 : -1;
  }

  if (a.aafIntegrityScore !== b.aafIntegrityScore) {
    return a.aafIntegrityScore > b.aafIntegrityScore ? 1 : -1;
  }

  if (a.holdoutRobustnessScore !== b.holdoutRobustnessScore) {
    return a.holdoutRobustnessScore > b.holdoutRobustnessScore ? 1 : -1;
  }

  if (a.walkForwardRobustnessScore !== b.walkForwardRobustnessScore) {
    return a.walkForwardRobustnessScore > b.walkForwardRobustnessScore ? 1 : -1;
  }

  const pboA = a.probabilityOfOverfitting;
  const pboB = b.probabilityOfOverfitting;
  if (pboA !== null && pboB !== null && pboA !== pboB) {
    return pboA < pboB ? 1 : -1;
  }
  if (pboA === null && pboB !== null) {
    return -1;
  }
  if (pboA !== null && pboB === null) {
    return 1;
  }

  const dsrA = a.deflatedSharpeRatio;
  const dsrB = b.deflatedSharpeRatio;
  if (dsrA !== null && dsrB !== null && dsrA !== dsrB) {
    return dsrA > dsrB ? 1 : -1;
  }
  if (dsrA === null && dsrB !== null) {
    return -1;
  }
  if (dsrA !== null && dsrB === null) {
    return 1;
  }

  return 0;
}

/**
 * Scalar summary for telemetry only — still **niche-local**; do not use for cross-niche ranking.
 */
export function computeQualityDiversityScore(f: NicheFitnessComponents): number {
  const ra = ratioToUnitless(f.riskAdjustedPerformance);
  const dd = ratioToUnitless(f.maxDrawdown);
  const pbo = f.probabilityOfOverfitting;
  const pboPenalty = pbo === null ? 0 : pbo;

  const robust =
    (clamp01(f.stabilityScore) +
      clamp01(f.holdoutRobustnessScore) +
      clamp01(f.walkForwardRobustnessScore) +
      clamp01(f.aafIntegrityScore)) /
    4;

  const dsr = f.deflatedSharpeRatio === null ? 0 : Math.max(0, f.deflatedSharpeRatio);
  const costNorm =
    f.transactionCostsMinor < 0n
      ? 0
      : 1 / (1 + Number(f.transactionCostsMinor) / 1_000_000);
  const capacity = clamp01(f.capacityScore);
  const turnPenalty = 1 / (1 + Number(f.turnoverBps) / 100_000);

  const raw =
    0.28 * ra +
    0.12 * robust +
    0.1 * dsr +
    0.08 * capacity +
    0.06 * costNorm +
    0.06 * turnPenalty -
    0.22 * dd -
    0.08 * pboPenalty;

  return Math.max(0, raw);
}
