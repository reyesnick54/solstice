import type { ValuationDistributionSummary } from './types.ts';

export function distributionSummaryFromSamples(
  samples: readonly number[],
  scaleMinor = 100n,
): ValuationDistributionSummary {
  if (samples.length === 0) {
    return Object.freeze({
      p10Minor: 0n,
      p50Minor: 0n,
      p90Minor: 0n,
      sampleCount: 0,
    });
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (pct: number) => sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * (sorted.length - 1)))]!;
  const toMinor = (value: number) => BigInt(Math.round(value * Number(scaleMinor)));
  return Object.freeze({
    p10Minor: toMinor(pick(10)),
    p50Minor: toMinor(pick(50)),
    p90Minor: toMinor(pick(90)),
    sampleCount: samples.length,
  });
}

export function probabilityAbove(samples: readonly number[], threshold: number): number {
  if (samples.length === 0) return 0;
  const hits = samples.filter((row) => row > threshold).length;
  return hits / samples.length;
}
