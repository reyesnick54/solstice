import type { ModelImpliedMarginOfSafety } from './types.ts';
import { probabilityAbove } from './distribution-summary.ts';

export function computeModelImpliedMarginOfSafety(input: {
  readonly valuePerShareSamples: readonly number[];
  readonly marketPriceMinor: bigint;
  readonly priceScaleMinor?: bigint;
}): ModelImpliedMarginOfSafety {
  const scale = Number(input.priceScaleMinor ?? 100n);
  const market = Number(input.marketPriceMinor) / scale;
  return Object.freeze({
    probabilityValueAboveMarketPrice: probabilityAbove(input.valuePerShareSamples, market),
    probabilityValueAboveMarketPrice120Pct: probabilityAbove(input.valuePerShareSamples, market * 1.2),
    probabilityValueBelowMarketPrice80Pct:
      input.valuePerShareSamples.filter((row) => row < market * 0.8).length /
      Math.max(input.valuePerShareSamples.length, 1),
    notGuaranteedReturnProbability: true,
    researchEvidenceOnly: true,
  });
}
