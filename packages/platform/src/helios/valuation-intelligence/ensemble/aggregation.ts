import type {
  IndependentIntrinsicValueDistribution,
  IntrinsicModelCandidate,
  MarketReferencedModelCandidate,
  MarketReferencedValueDistribution,
  ModelDisagreement,
  ModelWeight,
} from './types.ts';
import { coefficientOfVariation, mergeQuantiles, weightedMeanBigint } from './numeric.ts';

const DEFAULT_QUANTILES = Object.freeze(['p10', 'p50', 'p90'] as const);

export function aggregateIntrinsicLane(input: {
  readonly distributionId: string;
  readonly currency: string;
  readonly candidates: readonly IntrinsicModelCandidate[];
  readonly weights: readonly ModelWeight[];
}): IndependentIntrinsicValueDistribution {
  const byMethod = new Map(input.weights.map((w) => [String(w.method), w]));
  const applicable = input.candidates.filter((c) => c.applicable);

  const weightedSamples = applicable
    .map((c) => {
      const w = byMethod.get(String(c.method));
      if (!w || c.equityValuePerShareMinor === null) return null;
      return Object.freeze({ valueMinor: c.equityValuePerShareMinor, weight: w.posteriorWeight });
    })
    .filter((r): r is { valueMinor: bigint; weight: number } => r !== null);

  const perModel = applicable
    .map((c) => {
      const w = byMethod.get(String(c.method));
      if (!w) return null;
      return Object.freeze({ weight: w.posteriorWeight, quantiles: c.quantiles });
    })
    .filter((r): r is { weight: number; quantiles: IntrinsicModelCandidate['quantiles'] } => r !== null);

  const medians = applicable
    .map((c) => c.quantiles.find((q) => q.quantile === 'p50')?.equityValuePerShareMinor ?? c.equityValuePerShareMinor)
    .filter((v): v is bigint => v !== null);

  return Object.freeze({
    distributionId: input.distributionId,
    lane: 'INTRINSIC',
    currency: input.currency,
    meanEquityPerShareMinor: weightedMeanBigint(weightedSamples),
    medianEquityPerShareMinor: weightedMeanBigint(
      medians.map((valueMinor) => Object.freeze({ valueMinor, weight: 1 })),
    ),
    quantiles: mergeQuantiles(DEFAULT_QUANTILES, perModel),
    modelWeights: Object.freeze(input.weights.filter((w) => w.lane === 'INTRINSIC')),
    contributingMethods: Object.freeze(applicable.map((c) => c.method)),
    notAFact: true,
    researchOnly: true,
    grantsExecutionAuthority: false,
    noMarketPriceInput: true,
  });
}

export function aggregateMarketReferencedLane(input: {
  readonly distributionId: string;
  readonly currency: string;
  readonly candidates: readonly MarketReferencedModelCandidate[];
  readonly weights: readonly ModelWeight[];
}): MarketReferencedValueDistribution {
  const byMethod = new Map(input.weights.map((w) => [String(w.method), w]));
  const applicable = input.candidates.filter((c) => c.applicable);

  const weightedSamples = applicable
    .map((c) => {
      const w = byMethod.get(String(c.method));
      if (!w || c.equityValuePerShareMinor === null) return null;
      return Object.freeze({ valueMinor: c.equityValuePerShareMinor, weight: w.posteriorWeight });
    })
    .filter((r): r is { valueMinor: bigint; weight: number } => r !== null);

  const perModel = applicable
    .map((c) => {
      const w = byMethod.get(String(c.method));
      if (!w) return null;
      return Object.freeze({ weight: w.posteriorWeight, quantiles: c.quantiles });
    })
    .filter((r): r is { weight: number; quantiles: MarketReferencedModelCandidate['quantiles'] } => r !== null);

  const medians = applicable
    .map((c) => c.quantiles.find((q) => q.quantile === 'p50')?.equityValuePerShareMinor ?? c.equityValuePerShareMinor)
    .filter((v): v is bigint => v !== null);

  return Object.freeze({
    distributionId: input.distributionId,
    lane: 'MARKET_REFERENCED',
    currency: input.currency,
    meanEquityPerShareMinor: weightedMeanBigint(weightedSamples),
    medianEquityPerShareMinor: weightedMeanBigint(
      medians.map((valueMinor) => Object.freeze({ valueMinor, weight: 1 })),
    ),
    quantiles: mergeQuantiles(DEFAULT_QUANTILES, perModel),
    modelWeights: Object.freeze(input.weights.filter((w) => w.lane === 'MARKET_REFERENCED')),
    contributingMethods: Object.freeze(applicable.map((c) => c.method)),
    notAFact: true,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}

export function computeModelDisagreement(
  lane: ModelDisagreement['lane'],
  candidates: readonly { method: string; equityValuePerShareMinor: bigint | null }[],
): ModelDisagreement {
  const values = candidates
    .map((c) => c.equityValuePerShareMinor)
    .filter((v): v is bigint => v !== null);

  const min = values.length ? values.reduce((a, b) => (a < b ? a : b)) : null;
  const max = values.length ? values.reduce((a, b) => (a > b ? a : b)) : null;
  const spread = min !== null && max !== null ? max - min : null;

  const pairwise: {
    readonly methodA: string;
    readonly methodB: string;
    readonly divergenceRatio: number | null;
  }[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!.equityValuePerShareMinor;
      const b = candidates[j]!.equityValuePerShareMinor;
      if (a === null || b === null || a === 0n) continue;
      const ratio = Number(b > a ? b - a : a - b) / Number(a);
      pairwise.push(
        Object.freeze({
          methodA: String(candidates[i]!.method),
          methodB: String(candidates[j]!.method),
          divergenceRatio: ratio,
        }),
      );
    }
  }

  const interpretation: string[] = [];
  if (spread !== null && spread > 0n) {
    interpretation.push('material_cross_model_spread');
  } else {
    interpretation.push('models broadly aligned or insufficient coverage');
  }

  return Object.freeze({
    lane,
    methodSpreadMinor: spread,
    coefficientOfVariation: coefficientOfVariation(values),
    pairwiseDivergence: Object.freeze(pairwise),
    interpretation: Object.freeze(interpretation),
  });
}
