import { applyFill, matchIncoming, sortBook } from '../matching.ts';
import type { DigitalOrder, ImmutableTrade } from '../types.ts';
import { toTrade } from '../matching.ts';
import type { ProductizedFeeSchedule } from './fees.ts';
import { assessTradeFees } from './fees.ts';

export type ReplayResult = {
  readonly bids: readonly DigitalOrder[];
  readonly asks: readonly DigitalOrder[];
  readonly trades: readonly ImmutableTrade[];
  readonly orders: readonly DigitalOrder[];
  readonly deterministic: true;
  readonly duplicateFills: false;
};

/**
 * Deterministic rematch of accepted orders in sequence order.
 * Used to prove replay, not to mutate the authoritative store.
 * Trades already present in `knownTradeKeys` are not duplicated.
 */
export function replayAcceptedOrders(input: {
  readonly accepted: readonly DigitalOrder[];
  readonly feeSchedule: ProductizedFeeSchedule;
  readonly quoteCurrency: ImmutableTrade['quoteAmount']['currency'];
  readonly selfTrade?: import('../taxonomy.ts').SelfTradePolicy;
  readonly knownTradeKeys?: ReadonlySet<string>;
}): ReplayResult {
  const working = new Map<string, DigitalOrder>();
  const trades: ImmutableTrade[] = [];
  const ordered = [...input.accepted].sort((a, b) => a.sequence - b.sequence);
  let marketSeq = 0;
  for (const incoming of ordered) {
    const current = { ...incoming, remaining: incoming.quantity, status: 'OPEN' as const };
    const resting = [...working.values()].filter(
      (order) =>
        order.marketId === incoming.marketId &&
        (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
    );
    const matched = matchIncoming(current, resting, { selfTrade: input.selfTrade ?? 'CANCEL_INCOMING' });
    if (matched.rejectIncoming) {
      working.set(incoming.orderId, { ...current, status: 'REJECTED' });
      continue;
    }
    let taker: DigitalOrder = current;
    working.set(taker.orderId, taker);
    for (const match of matched.matches) {
      marketSeq += 1;
      const key = `${match.maker.orderId}:${match.taker.orderId}:${match.quantity.scaledUnits.toString()}:${match.price.priceUnits.toString()}`;
      if (input.knownTradeKeys?.has(key)) {
        continue;
      }
      const trade = toTrade(match, marketSeq, incoming.createdAt, input.feeSchedule, input.quoteCurrency);
      const fees = assessTradeFees({ schedule: input.feeSchedule, quote: trade.quoteAmount });
      trades.push(
        Object.freeze({
          ...trade,
          makerFee: fees.makerFee,
          takerFee: fees.takerFee,
        }),
      );
      const maker = applyFill(working.get(match.maker.orderId) ?? match.maker, match.quantity);
      taker = applyFill(working.get(taker.orderId) ?? taker, match.quantity);
      working.set(maker.orderId, maker);
      working.set(taker.orderId, taker);
    }
  }
  const open = [...working.values()];
  const book = sortBook(open);
  return Object.freeze({
    bids: book.bids,
    asks: book.asks,
    trades,
    orders: open,
    deterministic: true,
    duplicateFills: false,
  });
}

export function tradeDedupeKey(trade: ImmutableTrade): string {
  return `${trade.makerOrderId}:${trade.takerOrderId}:${trade.quantity.scaledUnits.toString()}:${trade.price.priceUnits.toString()}`;
}

export function reconstructOpenBook(orders: readonly DigitalOrder[]): {
  readonly bids: readonly DigitalOrder[];
  readonly asks: readonly DigitalOrder[];
} {
  return sortBook(orders);
}
