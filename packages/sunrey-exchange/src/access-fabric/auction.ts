import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asOrderId, type ExchangeAccountId, type ExchangeMarketId } from '../ids.ts';
import {
  appendAuctionOrder,
  auctionAcceptsAt,
  clearAuction,
  openAuction,
} from '../auction.ts';
import type { ExchangePrice } from '../price.ts';
import type { AuctionClearingMethod, ExchangeCounterpartyClass } from '../taxonomy.ts';
import type { AuctionBook, AuctionClearing, UniversalOrder } from '../types-universal.ts';
import type { CapacityAccessTerms } from './types.ts';
import { evaluateTermsCompleteness } from './terms.ts';

/**
 * Capacity batch auction.
 *
 * This is an adapter, not a second matching engine. Bids and offers are mapped
 * onto canonical `UniversalOrder` values and cleared by the canonical
 * `clearAuction` in `../auction.ts`. Height gates, price-time priority, and
 * uniform-price clearing all remain owned there.
 */
export function openCapacityAuction(input: {
  readonly auctionId: string;
  readonly marketId: ExchangeMarketId;
  readonly terms: CapacityAccessTerms;
  readonly openHeight: bigint;
  readonly closeHeight: bigint;
  readonly clearingMethod?: AuctionClearingMethod;
}): AuctionBook {
  const completeness = evaluateTermsCompleteness(input.terms);
  if (!completeness.complete) {
    throw new TypeError(
      `capacity auction refused: incomplete terms (${completeness.missing.join(', ')})`,
    );
  }
  return openAuction({
    auctionId: input.auctionId,
    marketId: input.marketId,
    instrumentId: input.terms.instrumentId,
    openHeight: input.openHeight,
    closeHeight: input.closeHeight,
    ...(input.clearingMethod ? { clearingMethod: input.clearingMethod } : {}),
  });
}

/** Map a capacity bid or offer onto the canonical universal order shape. */
export function capacityAuctionOrder(input: {
  readonly orderId: string;
  readonly exchangeAccountId: ExchangeAccountId;
  readonly marketId: ExchangeMarketId;
  readonly terms: CapacityAccessTerms;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly limitPrice: ExchangePrice;
  readonly actorClass: ExchangeCounterpartyClass;
  readonly jurisdiction: Jurisdiction;
  readonly sequence: number;
  readonly capabilities?: readonly string[];
  readonly machineId?: string | null;
}): UniversalOrder {
  if (input.limitPrice.baseAssetId !== input.terms.unit) {
    throw new TypeError('capacity auction limit price base must be the capacity unit');
  }
  return Object.freeze({
    orderId: asOrderId(input.orderId),
    exchangeAccountId: input.exchangeAccountId,
    marketId: input.marketId,
    instrumentId: input.terms.instrumentId,
    family: input.terms.family,
    side: input.side,
    orderType: 'LIMIT',
    quantity: input.quantity,
    remaining: input.quantity,
    limitPrice: input.limitPrice,
    purpose: input.terms.rightsTerms.permittedPurposes[0] ?? null,
    recipientClass: null,
    actorClass: input.actorClass,
    capabilities: Object.freeze([...(input.capabilities ?? [])]),
    jurisdiction: input.jurisdiction,
    geography: input.terms.geography.deliveryLocation,
    machineId: input.machineId ?? null,
    consentRef: null,
    clientIdempotencyKey: input.orderId,
    sequence: input.sequence,
    status: 'OPEN',
  });
}

export function submitCapacityAuctionOrder(
  book: AuctionBook,
  order: UniversalOrder,
  height: bigint,
): AuctionBook {
  return appendAuctionOrder(book, order, height);
}

export function capacityAuctionAcceptsAt(book: AuctionBook, height: bigint): boolean {
  return auctionAcceptsAt(book, height);
}

/** Clear a capacity auction through the canonical deterministic clearing algorithm. */
export function clearCapacityAuction(
  book: AuctionBook,
  method?: AuctionClearingMethod,
): AuctionClearing {
  return method ? clearAuction(book, method) : clearAuction(book);
}
