import type { MerchantOffer, NormalizedOfferView } from './types.ts';

/**
 * Sealed offer visibility rules.
 *
 * Merchants do NOT receive real-time visibility into competitors' offers.
 * This prevents race-to-the-bottom reverse auctions.
 */
export const OFFER_VISIBILITY_RULES = Object.freeze({
  /** Merchants see only their own offers. */
  merchantSeesOwnOffersOnly: true,
  /** Merchants cannot see competitor prices or identities. */
  competitorOffersHidden: true,
  /** Users see all normalized offers for comparison. */
  userSeesAllOffers: true,
  /** Merchants receive aggregate market signal only (count, not prices). */
  merchantAggregateSignal: 'OFFER_COUNT_ONLY' as const,
  /** No live bid updates streamed to merchants. */
  liveCompetitorFeedForbidden: true,
});

export type MerchantOfferVisibility = {
  readonly ownOffers: readonly MerchantOffer[];
  readonly competitorOfferCount: number;
  readonly competitorOffers: readonly never[];
  readonly aggregateOnly: true;
};

export type UserOfferVisibility = {
  readonly offers: readonly NormalizedOfferView[];
  readonly sealed: true;
};

/** What a merchant can see about the offer market for an intent. */
export function merchantOfferVisibility(
  merchantId: string,
  allOffers: readonly MerchantOffer[],
): MerchantOfferVisibility {
  const own = allOffers.filter((o) => o.merchantId === merchantId && o.status === 'ACTIVE');
  const competitorCount = allOffers.filter((o) => o.merchantId !== merchantId && o.status === 'ACTIVE').length;
  return Object.freeze({
    ownOffers: Object.freeze(own),
    competitorOfferCount: competitorCount,
    competitorOffers: Object.freeze([]),
    aggregateOnly: true,
  });
}

/** Assert no competitor offer data leaks to merchant views. */
export function assertSealedOfferBoundary(view: MerchantOfferVisibility): void {
  if (view.competitorOffers.length > 0) {
    throw new TypeError('sealed offer boundary violated: competitor offers must not be visible');
  }
}
