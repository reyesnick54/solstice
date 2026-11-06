import type { CounterfactualOutcomeDistribution } from './types.ts';
import {
  formatMinor,
  meanBigint,
  medianUnweightedSorted,
  parseMinor,
  quantileUnweightedSorted,
  sortedCopy,
} from './numeric.ts';

export type BuildFactualDistributionInput = {
  readonly outcomesMinor: readonly string[];
  readonly drawdownsMinor?: readonly string[] | null;
  readonly drawdownThresholdMinor?: string | null;
};

function proportionBelow(sorted: readonly bigint[], threshold: bigint): number {
  if (sorted.length === 0) {
    return 0;
  }
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < threshold) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo / sorted.length;
}

function tailMean(sorted: readonly bigint[], startRankInclusive: number, endRankExclusive: number): bigint {
  if (startRankInclusive >= endRankExclusive || startRankInclusive < 0 || endRankExclusive > sorted.length) {
    throw new Error('CF06: invalid rank range for tail mean');
  }
  let s = 0n;
  const n = endRankExclusive - startRankInclusive;
  for (let i = startRankInclusive; i < endRankExclusive; i += 1) {
    s += sorted[i]!;
  }
  return s / BigInt(n);
}

/**
 * Empirical factual distribution over observed outcomes (no reweighting).
 */
export function buildCounterfactualOutcomeDistribution(input: BuildFactualDistributionInput): CounterfactualOutcomeDistribution {
  const values = input.outcomesMinor.map((s) => parseMinor(s));
  if (values.length === 0) {
    throw new Error('CF06: factual distribution requires at least one outcome');
  }
  const sorted = sortedCopy(values);
  const mean = meanBigint(sorted);
  const median = medianUnweightedSorted(sorted);

  const q = (p: number) => quantileUnweightedSorted(sorted, p);
  const p05 = q(0.05);
  const p10 = q(0.1);
  const p25 = q(0.25);
  const p75 = q(0.75);
  const p90 = q(0.9);
  const p95 = q(0.95);

  const n = sorted.length;
  const lossBps = Math.round(proportionBelow(sorted, 0n) * 10000);

  let pddBps: number | null = null;
  if (input.drawdownsMinor && input.drawdownsMinor.length > 0 && input.drawdownThresholdMinor != null) {
    const dSorted = sortedCopy(input.drawdownsMinor.map((s) => parseMinor(s)));
    const thr = parseMinor(input.drawdownThresholdMinor);
    const prop = dSorted.filter((d) => d > thr).length / dSorted.length;
    pddBps = Math.round(prop * 10000);
  }

  // Expected shortfall below empirical p05: mean of outcomes <= p05
  let esi = 0n;
  let c = 0n;
  for (const v of sorted) {
    if (v <= p05) {
      esi += v;
      c += 1n;
    }
  }
  const es =
    c > 0n ? esi / c : p05;

  const k10 = Math.max(1, Math.floor(0.1 * n));
  const downsideTail = tailMean(sorted, 0, k10);
  const upsideTail = tailMean(sorted, n - k10, n);

  return {
    schema: 'sunrey.helios.cf06.counterfactual-outcome-distribution.v1',
    sampleCount: n,
    meanMinor: formatMinor(mean),
    medianMinor: formatMinor(median),
    p05Minor: formatMinor(p05),
    p10Minor: formatMinor(p10),
    p25Minor: formatMinor(p25),
    p75Minor: formatMinor(p75),
    p90Minor: formatMinor(p90),
    p95Minor: formatMinor(p95),
    probabilityOfLossBps: lossBps,
    probabilityOfDrawdownAboveThresholdBps: pddBps,
    expectedShortfallBelowP05Minor: formatMinor(es),
    upsideTailMeanMinor: formatMinor(upsideTail),
    downsideTailMeanMinor: formatMinor(downsideTail),
  };
}
