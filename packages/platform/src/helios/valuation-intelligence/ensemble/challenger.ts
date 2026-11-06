import type {
  IndependentIntrinsicValueDistribution,
  IntrinsicModelCandidate,
  MarketReferencedModelCandidate,
  MarketReferencedValueDistribution,
  ModelChallengerCase,
} from './types.ts';
import { aggregateIntrinsicLane, aggregateMarketReferencedLane } from './aggregation.ts';
import type { ModelWeight } from './types.ts';

export type ChallengerPerturbation = {
  readonly caseId: string;
  readonly prompt: string;
  readonly perturbedAssumption: string;
  readonly intrinsicScale: number;
  readonly marketScale: number;
  readonly marginMeanRevertBps?: number;
};

function scaleCandidate<T extends IntrinsicModelCandidate | MarketReferencedModelCandidate>(
  candidate: T,
  scale: number,
): T {
  const scaleBig = (v: bigint | null) => (v === null ? null : BigInt(Math.round(Number(v) * scale)));
  const quantiles = candidate.quantiles.map((q) =>
    Object.freeze({
      ...q,
      equityValuePerShareMinor: scaleBig(q.equityValuePerShareMinor),
      enterpriseValueMinor: scaleBig(q.enterpriseValueMinor),
    }),
  );
  return Object.freeze({
    ...candidate,
    equityValuePerShareMinor: scaleBig(candidate.equityValuePerShareMinor),
    enterpriseValueMinor: scaleBig(candidate.enterpriseValueMinor),
    quantiles: Object.freeze(quantiles),
  }) as T;
}

const DEFAULT_CHALLENGER_CASES: readonly Omit<ChallengerPerturbation, 'caseId'>[] = Object.freeze([
  Object.freeze({
    prompt: 'What if DCF is wrong?',
    perturbedAssumption: 'dcf_growth_and_reinvestment_stress',
    intrinsicScale: 0.82,
    marketScale: 1,
  }),
  Object.freeze({
    prompt: 'What if margins mean-revert?',
    perturbedAssumption: 'operating_margin_mean_reversion',
    intrinsicScale: 0.88,
    marketScale: 0.95,
    marginMeanRevertBps: 300,
  }),
  Object.freeze({
    prompt: 'What if the peer multiple regime changes?',
    perturbedAssumption: 'peer_multiple_regime_shift',
    intrinsicScale: 1,
    marketScale: 0.78,
  }),
  Object.freeze({
    prompt: 'What if the terminal growth assumption is too aggressive?',
    perturbedAssumption: 'terminal_growth_haircut',
    intrinsicScale: 0.75,
    marketScale: 0.92,
  }),
  Object.freeze({
    prompt: 'What if earnings forecasts are optimistic?',
    perturbedAssumption: 'forecast_optimism_haircut',
    intrinsicScale: 0.85,
    marketScale: 0.9,
  }),
]);

export function generateModelChallengerCases(input: {
  readonly intrinsicCandidates: readonly IntrinsicModelCandidate[];
  readonly marketReferencedCandidates: readonly MarketReferencedModelCandidate[];
  readonly weights: readonly ModelWeight[];
  readonly currency: string;
  readonly baseIntrinsic: IndependentIntrinsicValueDistribution;
  readonly baseMarket: MarketReferencedValueDistribution;
}): readonly ModelChallengerCase[] {
  return Object.freeze(
    DEFAULT_CHALLENGER_CASES.map((spec, index) => {
      const caseId = `val11-challenge-${index + 1}`;
      const intrinsicCandidates = input.intrinsicCandidates.map((c) => scaleCandidate(c, spec.intrinsicScale));
      const marketCandidates = input.marketReferencedCandidates.map((c) => scaleCandidate(c, spec.marketScale));

      const intrinsicDistribution = aggregateIntrinsicLane({
        distributionId: `${input.baseIntrinsic.distributionId}:${caseId}:intrinsic`,
        currency: input.currency,
        candidates: intrinsicCandidates,
        weights: input.weights,
      });

      const marketReferencedDistribution = aggregateMarketReferencedLane({
        distributionId: `${input.baseMarket.distributionId}:${caseId}:market`,
        currency: input.currency,
        candidates: marketCandidates,
        weights: input.weights,
      });

      return Object.freeze({
        caseId,
        prompt: spec.prompt,
        perturbedAssumption: spec.perturbedAssumption,
        intrinsicDistribution,
        marketReferencedDistribution,
      });
    }),
  );
}
