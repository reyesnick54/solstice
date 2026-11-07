/** ALT05 numeric helpers (deterministic, no floating authority). */

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function mad(values: readonly number[]): number {
  const m = median(values);
  const dev = values.map((v) => Math.abs(v - m));
  return median(dev) * 1.4826;
}

export function robustZ(value: number, center: number, scale: number): number {
  if (scale <= 1e-9) return 0;
  return (value - center) / scale;
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function momentum(series: readonly number[]): number {
  if (series.length < 2) return 0;
  const tail = series.slice(-5);
  const head = series.slice(-10, -5);
  if (head.length === 0) return tail[tail.length - 1]! - tail[0]!;
  return mean(tail) - mean(head);
}

export function acceleration(series: readonly number[]): number {
  if (series.length < 3) return 0;
  const recent = series.slice(-3);
  return recent[2]! - 2 * recent[1]! + recent[0]!;
}
