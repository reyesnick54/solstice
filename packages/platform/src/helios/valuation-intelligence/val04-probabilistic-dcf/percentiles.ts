import type { DcfDistributionPercentiles } from './types.ts';

export function distributionPercentiles(samples: readonly number[]): DcfDistributionPercentiles {
  if (samples.length === 0) {
    return Object.freeze({
      p05: 0,
      p10: 0,
      p25: 0,
      median: 0,
      p75: 0,
      p90: 0,
      p95: 0,
    });
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return Object.freeze({
    p05: percentile(sorted, 5),
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    median: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
  });
}

function percentile(sorted: readonly number[], pct: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const rank = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const weight = rank - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}
