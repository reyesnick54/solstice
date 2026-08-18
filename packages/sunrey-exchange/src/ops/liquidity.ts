import { sortBook } from '../matching.ts';
import type { DigitalOrder, ImmutableTrade } from '../types.ts';
import type { LiquidityMetric } from './types.ts';
import type { ExchangeMarketId } from '../ids.ts';

export function measureLiquidity(input: {
  readonly marketId: ExchangeMarketId;
  readonly orders: readonly DigitalOrder[];
  readonly trades: readonly ImmutableTrade[];
  readonly marketMakerAccountIds: ReadonlySet<string>;
}): LiquidityMetric {
  const book = sortBook(input.orders);
  const bestBid = book.bids[0]?.limitPrice?.priceUnits ?? null;
  const bestAsk = book.asks[0]?.limitPrice?.priceUnits ?? null;
  const spreadUnits = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  const bidDepth = book.bids.reduce((sum, order) => sum + order.remaining.scaledUnits, 0n);
  const askDepth = book.asks.reduce((sum, order) => sum + order.remaining.scaledUnits, 0n);
  const turnover = input.trades.reduce((sum, trade) => sum + trade.quantity.scaledUnits, 0n);
  const totalDepth = bidDepth + askDepth;
  const imbalanceBps = totalDepth > 0n ? ((bidDepth - askDepth) * 10_000n) / totalDepth : null;
  const impactQty = bidDepth > 0n ? bidDepth / 10n : 0n;
  let walked = 0n;
  let last = bestAsk;
  for (const ask of book.asks) {
    if (!ask.limitPrice || impactQty <= 0n) {
      break;
    }
    walked += ask.remaining.scaledUnits;
    last = ask.limitPrice.priceUnits;
    if (walked >= impactQty) {
      break;
    }
  }
  const priceImpactBps =
    bestAsk !== null && last !== null && bestAsk > 0n ? ((last - bestAsk) * 10_000n) / bestAsk : null;
  const participants = new Set(input.orders.map((order) => order.beneficialParticipantId));
  const mmQty = input.orders
    .filter((order) => input.marketMakerAccountIds.has(order.exchangeAccountId))
    .reduce((sum, order) => sum + order.remaining.scaledUnits, 0n);
  const bookQty = bidDepth + askDepth;
  return Object.freeze({
    marketId: input.marketId,
    spreadUnits,
    bidDepth,
    askDepth,
    turnover,
    imbalanceBps,
    priceImpactBps,
    activeParticipants: participants.size,
    marketMakerParticipationBps: bookQty > 0n ? (mmQty * 10_000n) / bookQty : 0n,
    commercialPricing: false,
  });
}
