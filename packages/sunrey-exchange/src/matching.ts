import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { DigitalOrder, ImmutableTrade } from './types.ts';
import type { SelfTradePolicy } from './taxonomy.ts';
import type { OrderId } from './ids.ts';
import { comparePrice, type ExchangePrice } from './price.ts';
import { newExecutionId, newTradeId, type MarketDataSequence } from './ids.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { FeeSchedule } from './types.ts';
import { Money } from '../../money/src/money.ts';
import { quoteMoney } from './price.ts';

export type Match = {
  readonly maker: DigitalOrder;
  readonly taker: DigitalOrder;
  readonly quantity: AssetQuantity;
  readonly price: ExchangePrice;
};

/**
 * Deterministic price-time priority.
 * Bids: highest price first, then earliest sequence.
 * Asks: lowest price first, then earliest sequence.
 * Trades execute at the resting (maker) price.
 */
export function sortBook(orders: readonly DigitalOrder[]): {
  readonly bids: DigitalOrder[];
  readonly asks: DigitalOrder[];
} {
  const open = orders.filter((order) => order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED');
  const bids = open
    .filter((order) => order.side === 'BUY' && order.limitPrice)
    .sort((a, b) => {
      const priceCmp = comparePrice(b.limitPrice!, a.limitPrice!);
      return priceCmp !== 0 ? priceCmp : a.sequence - b.sequence;
    });
  const asks = open
    .filter((order) => order.side === 'SELL' && order.limitPrice)
    .sort((a, b) => {
      const priceCmp = comparePrice(a.limitPrice!, b.limitPrice!);
      return priceCmp !== 0 ? priceCmp : a.sequence - b.sequence;
    });
  return { bids, asks };
}

export function pricesCross(bid: ExchangePrice, ask: ExchangePrice): boolean {
  return comparePrice(bid, ask) >= 0;
}

export function matchIncoming(
  incoming: DigitalOrder,
  resting: readonly DigitalOrder[],
  policy: { readonly selfTrade: SelfTradePolicy },
): {
  readonly matches: Match[];
  readonly rejectIncoming: boolean;
  readonly cancelledRestingIds: readonly OrderId[];
  readonly reason?: string;
} {
  if (incoming.family !== 'DIGITAL_ASSET') {
    return { matches: [], rejectIncoming: true, cancelledRestingIds: [], reason: 'FAMILY_MISMATCH' };
  }
  const book = sortBook(resting);
  const opposite = incoming.side === 'BUY' ? book.asks : book.bids;
  const matches: Match[] = [];
  const cancelledRestingIds: OrderId[] = [];
  let remaining = incoming.remaining.scaledUnits;
  for (const maker of opposite) {
    if (remaining <= 0n) {
      break;
    }
    if (maker.beneficialParticipantId === incoming.beneficialParticipantId) {
      if (policy.selfTrade === 'CANCEL_OLDEST') {
        cancelledRestingIds.push(maker.orderId);
        continue;
      }
      if (
        policy.selfTrade === 'PREVENT' ||
        policy.selfTrade === 'REJECT' ||
        policy.selfTrade === 'CANCEL_INCOMING' ||
        policy.selfTrade === 'CANCEL_NEWEST'
      ) {
        return { matches: [], rejectIncoming: true, cancelledRestingIds: [], reason: 'SELF_TRADE' };
      }
    }
    const makerPrice = maker.limitPrice;
    if (!makerPrice) {
      continue;
    }
    if (
      (incoming.orderType === 'LIMIT' || incoming.orderType === 'MARKET_WITH_PROTECTION') &&
      incoming.limitPrice
    ) {
      if (incoming.side === 'BUY' && !pricesCross(incoming.limitPrice, makerPrice)) {
        break;
      }
      if (incoming.side === 'SELL' && !pricesCross(makerPrice, incoming.limitPrice)) {
        break;
      }
    }
    const fill = remaining < maker.remaining.scaledUnits ? remaining : maker.remaining.scaledUnits;
    matches.push({
      maker,
      taker: incoming,
      quantity: AssetQuantity.fromScaledUnits(fill, incoming.quantity.assetId),
      price: makerPrice,
    });
    remaining -= fill;
  }
  if (incoming.orderType === 'POST_ONLY' || incoming.timeInForce === 'POST_ONLY') {
    if (matches.length > 0) {
      return { matches: [], rejectIncoming: true, cancelledRestingIds: [], reason: 'POST_ONLY_WOULD_TAKE' };
    }
  }
  if (incoming.orderType === 'FOK' || incoming.timeInForce === 'FOK') {
    if (remaining > 0n) {
      return { matches: [], rejectIncoming: true, cancelledRestingIds: [], reason: 'FOK_UNFILLED' };
    }
  }
  return { matches, rejectIncoming: false, cancelledRestingIds };
}

export function toTrade(
  match: Match,
  sequence: number,
  matchedAt: UtcInstant,
  fees: FeeSchedule,
  quoteCurrency: Money['currency'],
): ImmutableTrade {
  const quoteAmount = quoteMoney(match.price, match.quantity, quoteCurrency);
  return Object.freeze({
    tradeId: newTradeId(),
    executionId: newExecutionId(),
    marketId: match.taker.marketId,
    makerOrderId: match.maker.orderId,
    takerOrderId: match.taker.orderId,
    quantity: match.quantity,
    price: match.price,
    quoteAmount,
    makerFee: Money.fromMinorUnits(fees.makerFeeMinor, quoteCurrency),
    takerFee: Money.fromMinorUnits(fees.takerFeeMinor, quoteCurrency),
    feeScheduleId: fees.scheduleId,
    matchedAt,
    sequence: sequence as MarketDataSequence,
  });
}

export function applyFill(order: DigitalOrder, fill: AssetQuantity): DigitalOrder {
  const remaining = order.remaining.minus(fill);
  if (remaining.isNegative()) {
    throw new Error('fill exceeds remaining quantity');
  }
  return Object.freeze({
    ...order,
    remaining,
    version: (order.version + 1) as DigitalOrder['version'],
    status: remaining.isZero() ? 'FILLED' : 'PARTIALLY_FILLED',
  });
}
