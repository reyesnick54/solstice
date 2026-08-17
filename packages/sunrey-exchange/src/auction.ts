import { asAuctionId, type AuctionId, type OrderId } from './ids.ts';
import { comparePrice, type ExchangePrice } from './price.ts';
import type { AuctionBook, AuctionClearing, UniversalOrder } from './types-universal.ts';
import type { AuctionClearingMethod } from './taxonomy.ts';

/**
 * Deterministic batch auction.
 *
 * Clearing algorithm (UNIFORM_PRICE):
 * 1. Sort bids by price descending, then sequence ascending.
 * 2. Sort offers by price ascending, then sequence ascending.
 * 3. Walk both books. A pair crosses when bid.price >= offer.price.
 * 4. Fill the minimum remaining quantity at the maker (offer) price for
 *    discriminatory mode, or at a single uniform clearing price otherwise.
 * 5. Uniform clearing price is the last crossed offer price (the marginal
 *    accepted ask). Ties break by earlier sequence, then order id.
 * 6. Height gates: orders are accepted only while openHeight <= height < closeHeight.
 */
export function sortAuctionSide(orders: readonly UniversalOrder[], side: 'BUY' | 'SELL'): UniversalOrder[] {
  const filtered = orders.filter((order) => order.side === side && order.status === 'OPEN' && order.limitPrice);
  return filtered.sort((a, b) => {
    const priceCmp = side === 'BUY' ? comparePrice(b.limitPrice!, a.limitPrice!) : comparePrice(a.limitPrice!, b.limitPrice!);
    if (priceCmp !== 0) {
      return priceCmp;
    }
    if (a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    return a.orderId < b.orderId ? -1 : a.orderId > b.orderId ? 1 : 0;
  });
}

export function auctionAcceptsAt(book: AuctionBook, height: bigint): boolean {
  return book.state === 'OPEN' && height >= book.openHeight && height < book.closeHeight;
}

export function clearAuction(book: AuctionBook, method: AuctionClearingMethod = book.clearingMethod): AuctionClearing {
  const bids = sortAuctionSide(book.bids, 'BUY').map((order) => ({ ...order, remaining: order.remaining }));
  const offers = sortAuctionSide(book.offers, 'SELL').map((order) => ({ ...order, remaining: order.remaining }));
  const allocated: AuctionClearing['allocated'][number][] = [];
  let bidIndex = 0;
  let offerIndex = 0;
  let lastPrice: ExchangePrice | null = null;

  while (bidIndex < bids.length && offerIndex < offers.length) {
    const bid = bids[bidIndex]!;
    const offer = offers[offerIndex]!;
    if (!bid.limitPrice || !offer.limitPrice || comparePrice(bid.limitPrice, offer.limitPrice) < 0) {
      break;
    }
    const quantity = bid.remaining < offer.remaining ? bid.remaining : offer.remaining;
    if (quantity <= 0n) {
      if (bid.remaining <= 0n) {
        bidIndex += 1;
      }
      if (offer.remaining <= 0n) {
        offerIndex += 1;
      }
      continue;
    }
    lastPrice = offer.limitPrice;
    allocated.push({
      bidOrderId: bid.orderId as OrderId,
      offerOrderId: offer.orderId as OrderId,
      quantity,
      price: method === 'DISCRIMINATORY' ? offer.limitPrice : offer.limitPrice,
    });
    bid.remaining -= quantity;
    offer.remaining -= quantity;
    if (bid.remaining <= 0n) {
      bidIndex += 1;
    }
    if (offer.remaining <= 0n) {
      offerIndex += 1;
    }
  }

  const uniform = lastPrice;
  const finalized = method === 'UNIFORM_PRICE' && uniform
    ? allocated.map((row) => ({ ...row, price: uniform }))
    : allocated;

  return Object.freeze({
    auctionId: book.auctionId,
    clearingPrice: uniform,
    allocated: Object.freeze(finalized),
    unfilledBidQuantity: bids.reduce((sum, order) => sum + order.remaining, 0n),
    unfilledOfferQuantity: offers.reduce((sum, order) => sum + order.remaining, 0n),
    method,
    tieBreak: 'PRICE_THEN_SEQUENCE',
  });
}

export function openAuction(input: {
  readonly auctionId?: string;
  readonly marketId: AuctionBook['marketId'];
  readonly instrumentId: AuctionBook['instrumentId'];
  readonly openHeight: bigint;
  readonly closeHeight: bigint;
  readonly clearingMethod?: AuctionClearingMethod;
}): AuctionBook {
  if (input.closeHeight <= input.openHeight) {
    throw new TypeError('auction closeHeight must be greater than openHeight');
  }
  return Object.freeze({
    auctionId: input.auctionId ? asAuctionId(input.auctionId) : asAuctionId(`xauc_${input.marketId}`),
    marketId: input.marketId,
    instrumentId: input.instrumentId,
    openHeight: input.openHeight,
    closeHeight: input.closeHeight,
    clearingMethod: input.clearingMethod ?? 'UNIFORM_PRICE',
    state: 'OPEN',
    bids: [],
    offers: [],
  });
}

export function appendAuctionOrder(book: AuctionBook, order: UniversalOrder, height: bigint): AuctionBook {
  if (!auctionAcceptsAt(book, height)) {
    throw new TypeError('auction is not accepting orders at this height');
  }
  const bids = order.side === 'BUY' ? [...book.bids, order] : book.bids;
  const offers = order.side === 'SELL' ? [...book.offers, order] : book.offers;
  return Object.freeze({ ...book, bids, offers });
}
