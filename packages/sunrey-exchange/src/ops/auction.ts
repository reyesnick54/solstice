import type { UtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { applyFill, sortBook } from '../matching.ts';
import { comparePrice, quoteForQuantity } from '../price.ts';
import { Money } from '../../../money/src/money.ts';
import { newExecutionId, newTradeId, type MarketDataSequence } from '../ids.ts';
import type { DigitalOrder, FeeSchedule, ImmutableTrade } from '../types.ts';
import type { AuctionState } from './types.ts';
import type { OperationalOrderType } from './taxonomy.ts';

const AUCTION_ELIGIBLE: readonly OperationalOrderType[] = ['LIMIT', 'POST_ONLY'];

export function idleAuction(marketId: AuctionState['marketId']): AuctionState {
  return Object.freeze({
    auctionId: `xauc_${marketId}`,
    marketId,
    phase: 'IDLE',
    eligibleOrderTypes: AUCTION_ELIGIBLE,
    indicativePrice: null,
    allocatedQuantity: 0n,
    unfilledBidQuantity: 0n,
    unfilledOfferQuantity: 0n,
    tieBreak: 'PRICE_THEN_SEQUENCE',
    method: 'UNIFORM_PRICE',
  });
}

export function openReopeningAuction(marketId: AuctionState['marketId']): AuctionState {
  return Object.freeze({
    ...idleAuction(marketId),
    phase: 'COLLECTING',
  });
}

export function orderEligibleForAuction(orderType: string): boolean {
  return (AUCTION_ELIGIBLE as readonly string[]).includes(orderType);
}

/**
 * Uniform-price reopening auction.
 * Eligible: LIMIT and POST_ONLY.
 * Clearing price: last crossed offer (marginal ask).
 * Allocation: price-time; ties break by earlier sequence then order id.
 * Transition: leftover open orders remain for continuous trading.
 */
export function discoverAuctionPrice(orders: readonly DigitalOrder[]): {
  readonly clearingPrice: bigint | null;
  readonly allocated: readonly { readonly bid: DigitalOrder; readonly offer: DigitalOrder; readonly quantity: bigint }[];
  readonly unfilledBidQuantity: bigint;
  readonly unfilledOfferQuantity: bigint;
} {
  const book = sortBook(orders.filter((order) => orderEligibleForAuction(order.orderType)));
  const bids = book.bids.map((order) => ({ ...order, remaining: order.remaining }));
  const offers = book.asks.map((order) => ({ ...order, remaining: order.remaining }));
  const allocated: { bid: DigitalOrder; offer: DigitalOrder; quantity: bigint }[] = [];
  let bi = 0;
  let oi = 0;
  let last: bigint | null = null;
  while (bi < bids.length && oi < offers.length) {
    const bid = bids[bi]!;
    const offer = offers[oi]!;
    if (!bid.limitPrice || !offer.limitPrice || comparePrice(bid.limitPrice, offer.limitPrice) < 0) {
      break;
    }
    const qty =
      bid.remaining.scaledUnits < offer.remaining.scaledUnits ? bid.remaining.scaledUnits : offer.remaining.scaledUnits;
    if (qty <= 0n) {
      if (bid.remaining.scaledUnits <= 0n) {
        bi += 1;
      }
      if (offer.remaining.scaledUnits <= 0n) {
        oi += 1;
      }
      continue;
    }
    last = offer.limitPrice.priceUnits;
    allocated.push({ bid, offer, quantity: qty });
    bid.remaining = bid.remaining.minus(AssetQuantity.fromScaledUnits(qty, bid.remaining.assetId));
    offer.remaining = offer.remaining.minus(AssetQuantity.fromScaledUnits(qty, offer.remaining.assetId));
    if (bid.remaining.scaledUnits <= 0n) {
      bi += 1;
    }
    if (offer.remaining.scaledUnits <= 0n) {
      oi += 1;
    }
  }
  return {
    clearingPrice: last,
    allocated,
    unfilledBidQuantity: bids.reduce((sum, order) => sum + order.remaining.scaledUnits, 0n),
    unfilledOfferQuantity: offers.reduce((sum, order) => sum + order.remaining.scaledUnits, 0n),
  };
}

export function allocateReopeningAuction(input: {
  readonly marketId: AuctionState['marketId'];
  readonly orders: readonly DigitalOrder[];
  readonly now: UtcInstant;
  readonly fees: FeeSchedule;
  readonly quoteCurrency: ImmutableTrade['quoteAmount']['currency'];
  readonly sequenceStart: number;
}): {
  readonly state: AuctionState;
  readonly trades: readonly ImmutableTrade[];
  readonly orders: readonly DigitalOrder[];
} {
  const discovery = discoverAuctionPrice(input.orders);
  const trades: ImmutableTrade[] = [];
  const byId = new Map(input.orders.map((order) => [order.orderId, order]));
  let seq = input.sequenceStart;
  for (const row of discovery.allocated) {
    const bid = byId.get(row.bid.orderId);
    const offer = byId.get(row.offer.orderId);
    if (!bid || !offer || !offer.limitPrice) {
      continue;
    }
    const match = {
      maker: offer,
      taker: bid,
      quantity: AssetQuantity.fromScaledUnits(row.quantity, bid.quantity.assetId),
      price: offer.limitPrice,
    };
    seq += 1;
    const quoteUnits = quoteForQuantity(match.price, match.quantity);
    trades.push(
      Object.freeze({
        tradeId: newTradeId(),
        executionId: newExecutionId(),
        marketId: match.taker.marketId,
        makerOrderId: match.maker.orderId,
        takerOrderId: match.taker.orderId,
        quantity: match.quantity,
        price: match.price,
        quoteAmount: Money.fromMinorUnits(quoteUnits, input.quoteCurrency),
        makerFee: Money.fromMinorUnits(input.fees.makerFeeMinor, input.quoteCurrency),
        takerFee: Money.fromMinorUnits(input.fees.takerFeeMinor, input.quoteCurrency),
        feeScheduleId: input.fees.scheduleId,
        matchedAt: input.now,
        sequence: seq as MarketDataSequence,
      }),
    );
    const filledBid = applyFill(bid, match.quantity);
    const filledOffer = applyFill(offer, match.quantity);
    byId.set(filledBid.orderId, filledBid);
    byId.set(filledOffer.orderId, filledOffer);
  }
  const state: AuctionState = Object.freeze({
    auctionId: `xauc_${input.marketId}`,
    marketId: input.marketId,
    phase: discovery.clearingPrice === null ? 'COLLECTING' : 'ALLOCATED',
    eligibleOrderTypes: AUCTION_ELIGIBLE,
    indicativePrice: discovery.clearingPrice,
    allocatedQuantity: discovery.allocated.reduce((sum, row) => sum + row.quantity, 0n),
    unfilledBidQuantity: discovery.unfilledBidQuantity,
    unfilledOfferQuantity: discovery.unfilledOfferQuantity,
    tieBreak: 'PRICE_THEN_SEQUENCE',
    method: 'UNIFORM_PRICE',
  });
  return { state, trades, orders: [...byId.values()] };
}
