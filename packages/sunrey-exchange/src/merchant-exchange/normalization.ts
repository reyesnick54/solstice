import type { MerchantOffer, NormalizedOfferView, PurchaseIntent, PurchaseIntentPreferences } from './types.ts';

export type NormalizationInput = {
  readonly intent: PurchaseIntent;
  readonly offers: readonly MerchantOffer[];
};

/**
 * Normalize merchant offers for user comparison.
 * Does not reduce ranking to cheapest price alone.
 */
export function normalizeOffers(input: NormalizationInput): Omit<NormalizedOfferView, 'rankScore' | 'rankPosition'>[] {
  return input.offers
    .filter((o) => o.status === 'ACTIVE' || o.status === 'SELECTED')
    .map((offer) => normalizeOne(offer, input.intent.preferences));
}

function normalizeOne(
  offer: MerchantOffer,
  preferences: PurchaseIntentPreferences,
): Omit<NormalizedOfferView, 'rankScore' | 'rankPosition'> {
  const effectivePrice = offer.price.minorUnits - offer.discountMinorUnits;
  return Object.freeze({
    offerId: offer.offerId,
    merchantId: offer.merchantId,
    totalPriceMinorUnits: offer.price.minorUnits,
    currency: offer.price.currency,
    effectivePriceMinorUnits: effectivePrice,
    deliveryScore: scoreDelivery(offer.deliveryTerms, preferences),
    warrantyScore: scoreWarranty(offer.warranty, preferences.warrantyMinimumMonths),
    availabilityScore: scoreAvailability(offer.availability),
    sunReyBenefitScore: scoreSunReyBenefit(offer.sunReyBenefit.benefitKind),
    preferenceMatchScore: scorePreferences(offer, preferences),
    deliveryTerms: offer.deliveryTerms,
    availability: offer.availability,
    warranty: offer.warranty,
    sunReyBenefit: offer.sunReyBenefit,
  });
}

function scoreDelivery(terms: string, preferences: PurchaseIntentPreferences): number {
  let score = 50;
  const lower = terms.toLowerCase();
  if (lower.includes('express') || lower.includes('same-day')) score += 30;
  else if (lower.includes('next-day') || lower.includes('1-2')) score += 20;
  else if (lower.includes('standard')) score += 10;
  if (preferences.deliverySpeed === 'EXPRESS' && (lower.includes('express') || lower.includes('same-day'))) {
    score += 20;
  }
  return Math.min(score, 100);
}

function scoreWarranty(warranty: string | null, minimumMonths?: number): number {
  if (!warranty) return minimumMonths ? 0 : 30;
  const match = warranty.match(/(\d+)\s*(month|year)/i);
  if (!match) return 40;
  let months = Number.parseInt(match[1]!, 10);
  if (match[2]!.toLowerCase().startsWith('year')) months *= 12;
  if (minimumMonths && months < minimumMonths) return 10;
  return Math.min(40 + months * 2, 100);
}

function scoreAvailability(availability: string): number {
  const lower = availability.toLowerCase();
  if (lower.includes('in stock') || lower.includes('immediate')) return 90;
  if (lower.includes('1-3') || lower.includes('few days')) return 70;
  if (lower.includes('week')) return 50;
  return 40;
}

function scoreSunReyBenefit(kind: string): number {
  if (kind === 'REWARD_CREDIT') return 60;
  if (kind === 'ACCESS_ENTITLEMENT') return 50;
  return 0;
}

function scorePreferences(offer: MerchantOffer, preferences: PurchaseIntentPreferences): number {
  let score = 50;
  if (preferences.ecoFriendly && offer.incentives.some((i) => i.toLowerCase().includes('eco'))) {
    score += 20;
  }
  if (preferences.brandPreferences?.length) {
    const match = preferences.brandPreferences.some((b) =>
      offer.serviceTerms?.toLowerCase().includes(b.toLowerCase()),
    );
    if (match) score += 15;
  }
  return Math.min(score, 100);
}
