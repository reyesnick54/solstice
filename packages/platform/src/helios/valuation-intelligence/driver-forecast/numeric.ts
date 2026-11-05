/**
 * Numeric helpers for driver forecasts (ratios as numbers; money paths use model scale).
 */

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const clamped = Math.min(1, Math.max(0, p));
  const index = (sorted.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower] ?? 0;
  }
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function stdDev(values: readonly number[], avg: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function parseFundamentalRatio(ratio: string | null, fallback: number): number {
  if (ratio === null || ratio.trim() === '') {
    return fallback;
  }
  const parsed = Number(ratio);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseFundamentalMinor(valueMinor: bigint | null, scale: number, fallback: number): number {
  if (valueMinor === null) {
    return fallback;
  }
  return Number(valueMinor) / scale;
}
