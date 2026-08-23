import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DigitalOrder, ImmutableTrade, MarketDataSnapshot } from '../types.ts';
import type {
  MarketStreamTopic,
  OrderPreview,
  ProductCandle,
  ProductEligibilityDecision,
  ProductMarketStatus,
  ProductMarketTicker,
  ProductOrderBookView,
  ProductTradePrint,
  StreamEvent,
} from './types.ts';

const FRESHNESS_CAP_MS = 5_000n;

export function freshnessMs(asOf: UtcInstant, now: UtcInstant): bigint {
  const delta = Date.parse(now) - Date.parse(asOf);
  if (!Number.isFinite(delta) || delta <= 0) {
    return 0n;
  }
  return BigInt(delta);
}

export function tickerFromSnapshot(
  snapshot: MarketDataSnapshot,
  now: UtcInstant,
): ProductMarketTicker {
  return Object.freeze({
    marketId: snapshot.marketId,
    lastPriceUnits: snapshot.lastTrade?.price.priceUnits ?? null,
    bestBidUnits: snapshot.bestBid?.priceUnits ?? null,
    bestAskUnits: snapshot.bestAsk?.priceUnits ?? null,
    volume: snapshot.volume.scaledUnits,
    asOf: now,
    freshnessMs: freshnessMs(snapshot.lastTrade?.matchedAt ?? now, now),
    label: snapshot.lastPriceLabel,
  });
}

export function orderBookFromSnapshot(snapshot: MarketDataSnapshot, now: UtcInstant): ProductOrderBookView {
  return Object.freeze({
    marketId: snapshot.marketId,
    bids: Object.freeze(snapshot.depth.bids.map((level) => ({
      priceUnits: level.price.priceUnits,
      quantity: level.quantity.scaledUnits,
    }))),
    asks: Object.freeze(snapshot.depth.asks.map((level) => ({
      priceUnits: level.price.priceUnits,
      quantity: level.quantity.scaledUnits,
    }))),
    sequence: snapshot.sequence,
    asOf: now,
    freshnessMs: freshnessMs(now, now),
  });
}

export function tradePrints(trades: readonly ImmutableTrade[], marketId: string): readonly ProductTradePrint[] {
  return Object.freeze(
    trades
      .filter((trade) => trade.marketId === marketId)
      .map((trade) =>
        Object.freeze({
          tradeId: trade.tradeId,
          marketId: trade.marketId,
          priceUnits: trade.price.priceUnits,
          quantity: trade.quantity.scaledUnits,
          asOf: trade.matchedAt,
        }),
      ),
  );
}

export function candlesFromTrades(input: {
  readonly marketId: string;
  readonly trades: readonly ImmutableTrade[];
  readonly periodMs: number;
  readonly now: UtcInstant;
}): readonly ProductCandle[] {
  const relevant = input.trades.filter((trade) => trade.marketId === input.marketId);
  if (relevant.length === 0) {
    return Object.freeze([]);
  }
  const buckets = new Map<number, ImmutableTrade[]>();
  for (const trade of relevant) {
    const ts = Date.parse(trade.matchedAt);
    const start = Math.floor(ts / input.periodMs) * input.periodMs;
    const list = buckets.get(start) ?? [];
    list.push(trade);
    buckets.set(start, list);
  }
  const candles: ProductCandle[] = [];
  for (const [start, bucket] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const prices = bucket.map((trade) => trade.price.priceUnits);
    const open = prices[0]!;
    const close = prices[prices.length - 1]!;
    let high = open;
    let low = open;
    let volume = 0n;
    for (let i = 0; i < prices.length; i += 1) {
      const price = prices[i]!;
      if (price > high) high = price;
      if (price < low) low = price;
      volume += bucket[i]!.quantity.scaledUnits;
    }
    const periodStart = new Date(start).toISOString() as UtcInstant;
    const periodEnd = new Date(start + input.periodMs).toISOString() as UtcInstant;
    candles.push(
      Object.freeze({
        marketId: input.marketId,
        periodStart,
        periodEnd,
        open,
        high,
        low,
        close,
        volume,
        asOf: input.now,
        freshnessMs: freshnessMs(periodEnd, input.now),
        label: 'SIMULATION_MARKET_PRICE',
      }),
    );
  }
  return Object.freeze(candles);
}

export function marketStatus(marketId: string, state: string, now: UtcInstant): ProductMarketStatus {
  return Object.freeze({
    marketId,
    state,
    asOf: now,
    productionTradingEnabled: false,
  });
}

export function buildOrderPreview(input: {
  readonly marketId: string;
  readonly instrument: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly estimatedPriceUnits: bigint | null;
  readonly feeMinorUnits: bigint;
  readonly marketState: string;
  readonly eligibility: ProductEligibilityDecision;
  readonly requiredApproval: OrderPreview['requiredApproval'];
  readonly expiresAt: UtcInstant | null;
  readonly now: UtcInstant;
}): OrderPreview {
  const estimatedTotal =
    input.estimatedPriceUnits === null ? null : input.estimatedPriceUnits * input.quantity + input.feeMinorUnits;
  return Object.freeze({
    previewId: `xprv_${randomUUID().replace(/-/g, '')}`,
    marketId: input.marketId,
    instrument: input.instrument,
    side: input.side,
    quantity: input.quantity,
    estimatedPriceUnits: input.estimatedPriceUnits,
    feeMinorUnits: input.feeMinorUnits,
    estimatedTotalMinorUnits: estimatedTotal,
    marketState: input.marketState,
    slippageWarning: input.estimatedPriceUnits === null ? 'NO_REFERENCE_PRICE' : null,
    eligibility: input.eligibility,
    requiredApproval: input.requiredApproval,
    expiresAt: input.expiresAt,
    guaranteedExecutionPrice: false,
    productionTradingEnabled: false,
  });
}

export class ExchangeMarketStream {
  private sequence = 0;
  private readonly events: StreamEvent[] = [];

  publish(input: {
    readonly topic: MarketStreamTopic;
    readonly marketId: string;
    readonly payload: StreamEvent['payload'];
    readonly at: UtcInstant;
  }): StreamEvent {
    this.sequence += 1;
    const event = Object.freeze({
      sequence: this.sequence,
      topic: input.topic,
      marketId: input.marketId,
      payload: input.payload,
      asOf: input.at,
    });
    this.events.push(event);
    return event;
  }

  after(sequence: number, topics?: readonly MarketStreamTopic[]): readonly StreamEvent[] {
    return Object.freeze(
      this.events.filter(
        (event) => event.sequence > sequence && (topics === undefined || topics.includes(event.topic)),
      ),
    );
  }

  encodeSse(events: readonly StreamEvent[]): string {
    return events
      .map((event) => `id: ${event.sequence}\nevent: ${event.topic}\ndata: ${JSON.stringify(event)}\n\n`)
      .join('');
  }

  publishFromBook(input: {
    readonly snapshot: MarketDataSnapshot;
    readonly trade?: ImmutableTrade;
    readonly order?: DigitalOrder;
    readonly at: UtcInstant;
  }): void {
    this.publish({
      topic: 'ticker',
      marketId: input.snapshot.marketId,
      payload: {
        last: input.snapshot.lastTrade?.price.priceUnits.toString() ?? null,
        bid: input.snapshot.bestBid?.priceUnits.toString() ?? null,
        ask: input.snapshot.bestAsk?.priceUnits.toString() ?? null,
      },
      at: input.at,
    });
    this.publish({
      topic: 'order-book',
      marketId: input.snapshot.marketId,
      payload: { sequence: input.snapshot.sequence },
      at: input.at,
    });
    if (input.trade) {
      this.publish({
        topic: 'trade',
        marketId: input.trade.marketId,
        payload: {
          tradeId: input.trade.tradeId,
          price: input.trade.price.priceUnits.toString(),
          quantity: input.trade.quantity.scaledUnits.toString(),
        },
        at: input.at,
      });
    }
    if (input.order) {
      this.publish({
        topic: 'order-status',
        marketId: input.order.marketId,
        payload: { orderId: input.order.orderId, status: input.order.status },
        at: input.at,
      });
    }
  }
}

void FRESHNESS_CAP_MS;
