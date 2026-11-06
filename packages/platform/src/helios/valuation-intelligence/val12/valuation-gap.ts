import type { ValuationGapSummary } from './types.ts';
import { probabilityAbove } from './distribution-summary.ts';

export function computeValuationGap(input: {
  readonly valuePerShareSamples: readonly number[];
  readonly marketPriceMinor: bigint;
  readonly priceScaleMinor?: bigint;
}): ValuationGapSummary {
  const scale = Number(input.priceScaleMinor ?? 100n);
  const market = Number(input.marketPriceMinor) / scale;
  const gaps = input.valuePerShareSamples.map((row) => row - market);
  const sorted = [...gaps].sort((a, b) => a - b);
  const pick = (pct: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * (sorted.length - 1)))] ?? 0;
  const toMinor = (value: number) => BigInt(Math.round(value * scale));
  return Object.freeze({
    medianValueGapMinor: toMinor(pick(50)),
    p10ValueGapMinor: toMinor(pick(10)),
    p90ValueGapMinor: toMinor(pick(90)),
    modelImpliedProbabilityValueAbovePrice: probabilityAbove(input.valuePerShareSamples, market),
    modelImpliedProbabilityValueBelowPrice:
      input.valuePerShareSamples.filter((row) => row < market).length /
      Math.max(input.valuePerShareSamples.length, 1),
    notObjectiveMispricingProbability: true,
    researchEvidenceOnly: true,
  });
}
