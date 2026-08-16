import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { DigitalOrder, ImmutableTrade } from './types.ts';
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
  policy: { readonly selfTrade: 'CANCEL_INCOMING' | 'PREVENT' },
): { readonly matches: Match[]; readonly rejectIncoming: boolean; readonly reason?: string } {
  if (incoming.family !== 'DIGITAL_ASSET') {
    return { matches: [], rejectIncoming: true, reason: 'FAMILY_MISMATCH' };
  }
  const book = sortBook(resting);
  const opposite = incoming.side === 'BUY' ? book.asks : book.bids;
  const matches: Match[] = [];
  let remaining = incoming.remaining.scaledUnits;
  for (const maker of opposite) {
    if (remaining <= 0n) {
      break;
    }
    if (maker.beneficialParticipantId === incoming.beneficialParticipantId) {
      if (policy.selfTrade === 'PREVENT' || policy.selfTrade === 'CANCEL_INCOMING') {
        return { matches: [], rejectIncoming: true, reason: 'SELF_TRADE' };
      }
    }
    const makerPrice = maker.limitPrice;
    if (!makerPrice) {
      continue;
    }
    if (incoming.orderType === 'LIMIT' && incoming.limitPrice) {
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
  return { matches, rejectIncoming: false };
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
    makerFee: Money.of(fees.makerFeeMinor, quoteCurrency),
    takerFee: Money.of(fees.takerFeeMinor, quoteCurrency),
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
