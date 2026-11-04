/**
 * Deterministic numeric helpers for analyst consensus (no live providers).
 */

export function sortedCopy(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = sortedCopy(values);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function trimmedMean(values: readonly number[], trimFraction = 0.1): number {
  if (values.length === 0) return 0;
  const sorted = sortedCopy(values);
  const trimCount = Math.floor(sorted.length * trimFraction);
  const slice = sorted.slice(trimCount, sorted.length - trimCount || undefined);
  if (slice.length === 0) return mean(sorted);
  return mean(slice);
}

export function sampleStandardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function interquartileRange(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = sortedCopy(values);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return q3 - q1;
}

export function quantile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const clamped = Math.min(1, Math.max(0, p));
  const pos = (sortedAsc.length - 1) * clamped;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedAsc[base + 1] === undefined) return sortedAsc[base]!;
  return sortedAsc[base]! + rest * (sortedAsc[base + 1]! - sortedAsc[base]!);
}

export function medianAbsoluteDeviation(values: readonly number[], center?: number): number {
  if (values.length === 0) return 0;
  const c = center ?? median(values);
  const deviations = values.map((v) => Math.abs(v - c));
  return median(deviations);
}

export function forecastRange(values: readonly number[]): { readonly min: number; readonly max: number } {
  if (values.length === 0) {
    return Object.freeze({ min: 0, max: 0 });
  }
  const sorted = sortedCopy(values);
  return Object.freeze({ min: sorted[0]!, max: sorted[sorted.length - 1]! });
}

/** Sample standard deviation of a dispersion time series (VoD). */
export function volatilityOfSeries(series: readonly number[]): number {
  return sampleStandardDeviation(series);
}

export function huberWeight(residual: number, delta: number): number {
  const abs = Math.abs(residual);
  if (abs <= delta) return 1;
  return delta / abs;
}

export function studentTLogLikelihood(residual: number, scale: number, nu = 5): number {
  const s = Math.max(scale, 1e-9);
  const x = residual / s;
  return -0.5 * (nu + 1) * Math.log(1 + (x * x) / nu);
}
