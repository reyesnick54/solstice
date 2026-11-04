/**
 * Robust distributions for earnings forecasts (Student-t heavy tails).
 */

import type { StudentTDistribution } from './types.ts';

const MIN_DF = 3;
const MAX_DF = 30;

export function clampProbability(p: number): number {
  return Math.min(0.999, Math.max(0.001, p));
}

export function logit(p: number): number {
  const c = clampProbability(p);
  return Math.log(c / (1 - c));
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

export function combineStudentTMixture(
  components: readonly { readonly mean: number; readonly scale: number; readonly weight: number; readonly df?: number }[],
): StudentTDistribution | null {
  if (components.length === 0) return null;
  let weightSum = 0;
  let mean = 0;
  let secondMoment = 0;
  let dfWeighted = 0;
  for (const c of components) {
    const w = Math.max(0, c.weight);
    if (w === 0) continue;
    weightSum += w;
    mean += w * c.mean;
    secondMoment += w * (c.scale * c.scale + c.mean * c.mean);
    dfWeighted += w * (c.df ?? MIN_DF);
  }
  if (weightSum === 0) return null;
  mean /= weightSum;
  const variance = Math.max(1e-12, secondMoment / weightSum - mean * mean);
  const df = Math.min(MAX_DF, Math.max(MIN_DF, dfWeighted / weightSum));
  return Object.freeze({
    kind: 'student_t',
    mean,
    scale: Math.sqrt(variance),
    degreesOfFreedom: df,
  });
}

/** Gaussian approximation CRPS for Student-t (research metric; undefined when not implemented). */
export function crpsStudentTApprox(actual: number, dist: StudentTDistribution): number {
  const z = Math.abs(actual - dist.mean) / Math.max(dist.scale, 1e-9);
  return dist.scale * (z * (2 * normalCdf(z) - 1) + 2 * normalPdf(z) - 1 / Math.sqrt(Math.PI));
}

function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
      Math.exp(-ax * ax));
  return sign * y;
}

export function combineProbabilitiesLogit(
  components: readonly { readonly probability: number; readonly weight: number; readonly uncertainty?: number }[],
): { readonly probability: number; readonly uncertainty: number } {
  if (components.length === 0) {
    return { probability: 0.5, uncertainty: 1 };
  }
  let weightSum = 0;
  let logitSum = 0;
  let uncSum = 0;
  for (const c of components) {
    const w = Math.max(0, c.weight);
    if (w === 0) continue;
    weightSum += w;
    logitSum += w * logit(c.probability);
    uncSum += w * (c.uncertainty ?? 0.25);
  }
  if (weightSum === 0) {
    return { probability: 0.5, uncertainty: 1 };
  }
  const meanLogit = logitSum / weightSum;
  return Object.freeze({
    probability: clampProbability(sigmoid(meanLogit)),
    uncertainty: Math.min(1, uncSum / weightSum),
  });
}
