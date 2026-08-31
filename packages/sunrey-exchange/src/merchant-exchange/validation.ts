import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import type { MerchantEligibilityResult } from './eligibility.ts';
import type { MerchantOffer, PurchaseIntent } from './types.ts';

export type OfferValidationInput = {
  readonly intent: PurchaseIntent;
  readonly offer: Omit<MerchantOffer, 'contentHash' | 'version' | 'status' | 'submittedAt'>;
  readonly eligibility: MerchantEligibilityResult;
  readonly now: UtcInstant;
  readonly existingOffersByMerchant: number;
  readonly maxOffersPerMerchant: number;
};

export type OfferValidationResult = {
  readonly valid: boolean;
  readonly reasons: readonly string[];
};

export function validateMerchantOffer(input: OfferValidationInput): OfferValidationResult {
  const reasons: string[] = [];
  const { offer, intent, eligibility, now } = input;

  if (offer.intentId !== intent.intentId) {
    return reject(['INTENT_MISMATCH']);
  }
  if (eligibility.outcome !== 'ELIGIBLE') {
    return reject([...eligibility.reasons]);
  }
  if (offer.price.minorUnits < 0n) {
    return reject(['NEGATIVE_PRICE']);
  }
  if (offer.discountMinorUnits < 0n) {
    return reject(['NEGATIVE_DISCOUNT']);
  }
  if (offer.discountMinorUnits > offer.price.minorUnits) {
    return reject(['DISCOUNT_EXCEEDS_PRICE']);
  }
  if (offer.price.currency !== intent.required.currency) {
    return reject(['CURRENCY_MISMATCH']);
  }
  if (!offer.deliveryTerms.trim()) {
    return reject(['DELIVERY_TERMS_REQUIRED']);
  }
  if (!offer.availability.trim()) {
    return reject(['AVAILABILITY_REQUIRED']);
  }
  if (offer.expiresAt <= now) {
    return reject(['OFFER_ALREADY_EXPIRED']);
  }
  if (offer.expiresAt > intent.expiresAt) {
    return reject(['OFFER_EXPIRES_AFTER_INTENT']);
  }
  if (intent.status !== 'OPEN_FOR_OFFERS') {
    return reject(['INTENT_NOT_OPEN_FOR_OFFERS']);
  }
  if (input.existingOffersByMerchant >= input.maxOffersPerMerchant) {
    return reject(['DUPLICATE_MERCHANT_OFFER_LIMIT']);
  }

  reasons.push('VALID');
  return Object.freeze({ valid: true, reasons: Object.freeze(reasons) });
}

/** Compute immutable content hash for offer version control. */
export function computeOfferContentHash(offer: Omit<MerchantOffer, 'contentHash'>): string {
  const payload = JSON.stringify({
    offerId: offer.offerId,
    intentId: offer.intentId,
    merchantId: offer.merchantId,
    priceMinorUnits: offer.price.minorUnits.toString(),
    currency: offer.price.currency,
    discountMinorUnits: offer.discountMinorUnits.toString(),
    deliveryTerms: offer.deliveryTerms,
    availability: offer.availability,
    warranty: offer.warranty,
    serviceTerms: offer.serviceTerms,
    incentives: offer.incentives,
    sunReyBenefit: offer.sunReyBenefit,
    expiresAt: offer.expiresAt,
    version: offer.version,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/** Verify an accepted offer snapshot has not been tampered with. */
export function verifyOfferImmutability(
  snapshot: { readonly offer: MerchantOffer; readonly contentHash: string; readonly offerVersion: number },
): boolean {
  if (snapshot.offer.version !== snapshot.offerVersion) return false;
  return computeOfferContentHash(snapshot.offer) === snapshot.contentHash;
}

export function parseOfferPrice(amountMinorUnits: string, currency: string): Money | null {
  try {
    const minor = BigInt(amountMinorUnits);
    if (minor < 0n) return null;
    return Money.fromMinorUnits(minor, currency);
  } catch {
    return null;
  }
}

function reject(reasons: readonly string[]): OfferValidationResult {
  return Object.freeze({ valid: false, reasons: Object.freeze([...reasons]) });
}
