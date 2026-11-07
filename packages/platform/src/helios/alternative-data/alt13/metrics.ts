/**
 * HELIOS ALT13 — out-of-sample incremental metrics (simulation-safe numerics).
 */

import type { Alt13IncrementalMetric } from './taxonomy.ts';

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: readonly number[], mu?: number): number {
  if (xs.length < 2) return 0;
  const m = mu ?? mean(xs);
  return xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
}

export function computeMae(actual: readonly number[], predicted: readonly number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += Math.abs(actual[i]! - predicted[i]!);
  }
  return sum / n;
}

export function computeLogLoss(probabilities: readonly number[], labels: readonly boolean[]): number {
  const n = Math.min(probabilities.length, labels.length);
  if (n === 0) return 10;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const p = Math.min(0.999, Math.max(0.001, probabilities[i]!));
    const y = labels[i]! ? 1 : 0;
    sum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }
  return sum / n;
}

export function computeBrier(probabilities: readonly number[], labels: readonly boolean[]): number {
  const n = Math.min(probabilities.length, labels.length);
  if (n === 0) return 1;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const p = Math.min(1, Math.max(0, probabilities[i]!));
    const y = labels[i]! ? 1 : 0;
    sum += (p - y) ** 2;
  }
  return sum / n;
}

export function partialCorrelation(
  x: readonly number[],
  y: readonly number[],
  controls: readonly (readonly number[])[],
): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 4 || controls.length === 0) {
    return pearsonCorrelation(x, y);
  }
  const rx = residualizeOnControls(x, controls);
  const ry = residualizeOnControls(y, controls);
  if (rx === null || ry === null) return null;
  return pearsonCorrelation(rx, ry);
}

export function pearsonCorrelation(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  if (denom === 0) return null;
  return num / denom;
}

function residualizeOnControls(
  target: readonly number[],
  controls: readonly (readonly number[])[],
): readonly number[] | null {
  const n = target.length;
  if (n < controls[0]!.length) return null;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const z = controls.map((c) => c[i] ?? 0);
    const prediction = mean(z);
    out.push(target[i]! - prediction);
  }
  return Object.freeze(out);
}

/**
 * Gaussian-kernel mutual information upper bound via correlation (simulation diagnostic).
 */
export function conditionalMutualInformationProxy(
  feature: readonly number[],
  target: readonly number[],
  controls: readonly (readonly number[])[],
): number {
  const partial = partialCorrelation(feature, target, controls);
  if (partial === null) return 0;
  const rho = Math.min(0.999, Math.max(-0.999, partial));
  return -0.5 * Math.log(1 - rho * rho);
}

export function approximateIncrementalPValue(delta: number, sampleSize: number, metric: Alt13IncrementalMetric): number {
  if (sampleSize < 8) return 1;
  const scale =
    metric === 'DELTA_MAE'
      ? 0.15
      : metric === 'DELTA_LOG_LOSS' || metric === 'DELTA_BRIER'
        ? 0.08
        : 0.12;
  const z = Math.abs(delta) / scale;
  const p = Math.exp(-0.5 * z * z);
  return Math.min(1, Math.max(1e-6, p));
}
