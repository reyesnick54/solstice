import type { UtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import type { ExchangeAccountId, ExchangeMarketId } from '../ids.ts';
import { quoteForQuantity, type ExchangePrice } from '../price.ts';
import type { CapacityAccessTerms, FixedPriceAccessOffer } from './types.ts';
import type { CapacityOfferState } from './taxonomy.ts';
import { evaluateTermsCompleteness } from './terms.ts';

/**
 * Fixed-price access offers.
 *
 * A provider lists capacity at a firm unit price. Taking an offer produces a
 * take record; consideration is then reserved and settled by the dual-economy
 * clearing adapter. No price is invented here and no balance is held.
 */
export function openFixedPriceAccessOffer(input: {
  readonly offerId: string;
  readonly listingId: string;
  readonly marketId: ExchangeMarketId;
  readonly providerAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly unitPrice: ExchangePrice;
  readonly offeredQuantity: bigint;
  readonly minimumTakeQuantity?: bigint;
  readonly at: UtcInstant;
}): FixedPriceAccessOffer {
  const completeness = evaluateTermsCompleteness(input.terms);
  if (!completeness.complete) {
    throw new TypeError(
      `fixed-price access offer refused: incomplete terms (${completeness.missing.join(', ')})`,
    );
  }
  if (input.offeredQuantity <= 0n) {
    throw new TypeError('fixed-price access offer requires a positive quantity');
  }
  if (input.unitPrice.baseAssetId !== input.terms.unit) {
    throw new TypeError(
      `unit price base ${input.unitPrice.baseAssetId} must be the capacity unit ${input.terms.unit}`,
    );
  }
  return Object.freeze({
    offerId: input.offerId,
    listingId: input.listingId,
    marketId: input.marketId,
    providerAccountId: input.providerAccountId,
    terms: input.terms,
    unitPrice: input.unitPrice,
    minimumTakeQuantity: input.minimumTakeQuantity ?? 1n,
    offeredQuantity: input.offeredQuantity,
    takenQuantity: 0n,
    state: 'LISTED',
    createdAt: input.at,
  });
}

export type FixedPriceTake =
  | {
      readonly ok: true;
      readonly offer: FixedPriceAccessOffer;
      readonly takenQuantity: bigint;
      readonly unitPrice: ExchangePrice;
    }
  | { readonly ok: false; readonly reason: string };

/** Take part or all of a fixed-price offer. Remaining quantity is derived. */
export function takeFixedPriceAccessOffer(
  offer: FixedPriceAccessOffer,
  quantity: bigint,
): FixedPriceTake {
  if (offer.state === 'WITHDRAWN') {
    return { ok: false, reason: 'offer is withdrawn' };
  }
  if (offer.state === 'EXHAUSTED') {
    return { ok: false, reason: 'offer is exhausted' };
  }
  if (quantity <= 0n) {
    return { ok: false, reason: 'take quantity must be positive' };
  }
  if (quantity < offer.minimumTakeQuantity) {
    return { ok: false, reason: 'take quantity is below the minimum' };
  }
  const remaining = offer.offeredQuantity - offer.takenQuantity;
  if (quantity > remaining) {
    return { ok: false, reason: 'take quantity exceeds remaining offered capacity' };
  }
  const taken = offer.takenQuantity + quantity;
  const state: CapacityOfferState = taken === offer.offeredQuantity ? 'EXHAUSTED' : 'PARTIALLY_TAKEN';
  return {
    ok: true,
    offer: Object.freeze({ ...offer, takenQuantity: taken, state }),
    takenQuantity: quantity,
    unitPrice: offer.unitPrice,
  };
}

export function withdrawFixedPriceAccessOffer(offer: FixedPriceAccessOffer): FixedPriceAccessOffer {
  return Object.freeze({ ...offer, state: 'WITHDRAWN' });
}

export function offerRemainingQuantity(offer: FixedPriceAccessOffer): bigint {
  return offer.offeredQuantity - offer.takenQuantity;
}

/**
 * Exact consideration for a capacity quantity. Integer minor units only; a
 * price that does not divide exactly at listing precision is refused by
 * `quoteForQuantity` rather than rounded.
 */
export function fiatConsiderationFor(input: {
  readonly unitPrice: ExchangePrice;
  readonly quantity: bigint;
  readonly unit: string;
  readonly currency: string;
}): Money {
  if (input.unitPrice.quoteKind !== 'FIAT_MONEY') {
    throw new TypeError('fiat consideration requires a FIAT_MONEY unit price');
  }
  const units = AssetQuantity.fromScaledUnits(input.quantity, input.unit);
  return Money.fromMinorUnits(quoteForQuantity(input.unitPrice, units), input.currency);
}

/** Exact native-asset consideration for a capacity quantity. */
export function nativeConsiderationFor(input: {
  readonly unitPrice: ExchangePrice;
  readonly quantity: bigint;
  readonly unit: string;
}): AssetQuantity {
  if (input.unitPrice.quoteKind !== 'ASSET') {
    throw new TypeError('native consideration requires an ASSET unit price');
  }
  const units = AssetQuantity.fromScaledUnits(input.quantity, input.unit);
  return AssetQuantity.fromScaledUnits(
    quoteForQuantity(input.unitPrice, units),
    input.unitPrice.quoteAssetId,
  );
}
