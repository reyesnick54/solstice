import { FORBIDDEN_INTRINSIC_INPUT_KEYS } from './taxonomy.ts';
import type {
  IndependentIntrinsicValueDistribution,
  IntrinsicModelCandidate,
  MarketReferencedModelCandidate,
} from './types.ts';

export type LaneSeparationViolation = {
  readonly candidateId: string;
  readonly forbiddenKey: string;
};

export function assertIntrinsicInputsPriceFree(
  candidate: Pick<IntrinsicModelCandidate, 'candidateId' | 'inputKeysUsed' | 'lane'>,
): readonly LaneSeparationViolation[] {
  if (candidate.lane !== 'INTRINSIC') {
    return Object.freeze([
      Object.freeze({ candidateId: candidate.candidateId, forbiddenKey: 'wrong_lane' }),
    ]);
  }
  const forbidden = new Set<string>(FORBIDDEN_INTRINSIC_INPUT_KEYS);
  return Object.freeze(
    candidate.inputKeysUsed
      .filter((key) => forbidden.has(key))
      .map((key) => Object.freeze({ candidateId: candidate.candidateId, forbiddenKey: key })),
  );
}

export function assertAllIntrinsicCandidatesPriceFree(
  candidates: readonly IntrinsicModelCandidate[],
): readonly LaneSeparationViolation[] {
  return Object.freeze(candidates.flatMap((c) => assertIntrinsicInputsPriceFree(c)));
}

export function assertNoMarketPriceInIntrinsicAggregation(
  intrinsic: Pick<IndependentIntrinsicValueDistribution, 'noMarketPriceInput' | 'lane'>,
): boolean {
  return intrinsic.lane === 'INTRINSIC' && intrinsic.noMarketPriceInput === true;
}

export function assertMarketReferencedLaneIntegrity(
  candidate: Pick<MarketReferencedModelCandidate, 'lane'>,
): boolean {
  return candidate.lane === 'MARKET_REFERENCED';
}

/** Lane B values must not be folded into Lane A weighted sums. */
export function assertLanesNotBlended(input: {
  readonly intrinsicWeightSum: number;
  readonly marketReferencedInIntrinsicSum: number;
}): boolean {
  return input.marketReferencedInIntrinsicSum === 0 && input.intrinsicWeightSum > 0;
}
