import type { UtcInstant } from '../../../domain/src/time.ts';
import type { NormalizedOfferView, PurchaseIntent, RankedOfferList } from './types.ts';
import { normalizeOffers } from './normalization.ts';

/** Ranking weights in basis points (10_000 = 100%). Integer only — no floats in money paths. */
export type RankingWeights = {
  readonly price: number;
  readonly delivery: number;
  readonly warranty: number;
  readonly availability: number;
  readonly sunReyBenefit: number;
  readonly preferences: number;
};

export const RANKING_WEIGHT_BASIS = 10_000;

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = Object.freeze({
  price: 3000,
  delivery: 2000,
  warranty: 1500,
  availability: 1500,
  sunReyBenefit: 1000,
  preferences: 1000,
});

export type RankingInput = {
  readonly intent: PurchaseIntent;
  readonly offers: Parameters<typeof normalizeOffers>[0]['offers'];
  readonly weights?: RankingWeights;
  readonly now: UtcInstant;
};

/**
 * Deterministic offer ranking. AI may explain ranking but must not
 * invent offer terms — merchant-submitted data remains authoritative.
 */
export function rankOffers(input: RankingInput): RankedOfferList {
  const weights = input.weights ?? DEFAULT_RANKING_WEIGHTS;
  const normalized = normalizeOffers({ intent: input.intent, offers: input.offers });

  if (normalized.length === 0) {
    return Object.freeze({
      intentId: input.intent.intentId,
      offers: Object.freeze([]),
      rankedAt: input.now,
      rankingFactors: Object.freeze(['no_active_offers']),
    });
  }

  const maxPrice = normalized.reduce((max, o) => (o.effectivePriceMinorUnits > max ? o.effectivePriceMinorUnits : max), 0n);
  const minPrice = normalized.reduce((min, o) => (o.effectivePriceMinorUnits < min ? o.effectivePriceMinorUnits : min), maxPrice);

  const scored = normalized.map((view) => {
    const priceScore = priceToScore(view.effectivePriceMinorUnits, minPrice, maxPrice);
    const weighted =
      priceScore * weights.price +
      view.deliveryScore * weights.delivery +
      view.warrantyScore * weights.warranty +
      view.availabilityScore * weights.availability +
      view.sunReyBenefitScore * weights.sunReyBenefit +
      view.preferenceMatchScore * weights.preferences;
    const rankScore = Math.round(weighted / RANKING_WEIGHT_BASIS);
    return Object.freeze({ ...view, rankScore, rankPosition: 0 });
  });

  scored.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (a.effectivePriceMinorUnits !== b.effectivePriceMinorUnits) {
      return a.effectivePriceMinorUnits < b.effectivePriceMinorUnits ? -1 : 1;
    }
    return a.offerId < b.offerId ? -1 : 1;
  });

  const ranked = scored.map((view, index) =>
    Object.freeze({ ...view, rankPosition: index + 1 }),
  );

  return Object.freeze({
    intentId: input.intent.intentId,
    offers: Object.freeze(ranked),
    rankedAt: input.now,
    rankingFactors: Object.freeze([
      'total_price',
      'delivery',
      'warranty',
      'availability',
      'sunrey_benefit',
      'user_preferences',
    ]),
  });
}

/** Lower price = higher score (inverted). */
function priceToScore(price: bigint, min: bigint, max: bigint): number {
  if (max === min) return 100;
  const range = Number(max - min);
  const position = Number(price - min);
  return Math.round(100 * (1 - position / range));
}

/**
 * AI ranking explanation must reference only merchant-submitted data.
 * This helper validates that an explanation does not invent terms.
 */
export function validateRankingExplanation(
  explanation: string,
  rankedOffers: readonly NormalizedOfferView[],
): boolean {
  const forbiddenPatterns = [
    /\bfree shipping\b/i,
    /\b\d+%\s*off\b/i,
    /\blifetime warranty\b/i,
  ];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(explanation)) {
      const foundInOffers = rankedOffers.some(
        (o) =>
          pattern.test(o.deliveryTerms) ||
          pattern.test(o.warranty ?? '') ||
          pattern.test(o.availability),
      );
      if (!foundInOffers) return false;
    }
  }
  return true;
}
