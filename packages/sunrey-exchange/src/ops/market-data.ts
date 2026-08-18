import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { sortBook } from '../matching.ts';
import type { ExchangeMarketId } from '../ids.ts';
import type { DigitalOrder, ImmutableTrade } from '../types.ts';
import type { MarketState } from '../taxonomy.ts';
import type { MarketDataStream, MarketDataTier } from './taxonomy.ts';
import type {
  AuctionState,
  DepthLevel,
  MarketDataBook,
  MarketDataIncrement,
  MarketDataSequence,
  MarketDataSnapshot,
  PublicMarketDataView,
} from './types.ts';

function digest(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function depthFromOrders(orders: readonly DigitalOrder[]): MarketDataBook {
  const book = sortBook(orders);
  const collapse = (side: readonly DigitalOrder[]): DepthLevel[] => {
    const levels = new Map<string, { priceUnits: bigint; quantity: bigint; orderCount: number }>();
    for (const order of side) {
      if (!order.limitPrice) {
        continue;
      }
      const key = order.limitPrice.priceUnits.toString();
      const current = levels.get(key) ?? { priceUnits: order.limitPrice.priceUnits, quantity: 0n, orderCount: 0 };
      current.quantity += order.remaining.scaledUnits;
      current.orderCount += 1;
      levels.set(key, current);
    }
    return [...levels.values()].map((row) => Object.freeze(row));
  };
  const marketId = (book.bids[0]?.marketId ?? book.asks[0]?.marketId ?? 'market:unknown') as ExchangeMarketId;
  return Object.freeze({
    marketId,
    bids: Object.freeze(collapse(book.bids)),
    asks: Object.freeze(collapse(book.asks)),
  });
}

export class SequencedMarketData {
  readonly sequences = new Map<string, MarketDataSequence>();
  readonly snapshots = new Map<string, MarketDataSnapshot>();
  readonly increments = new Map<string, MarketDataIncrement[]>();

  readonly sessionId: string;

  constructor(sessionId = 'md_session_sim') {
    this.sessionId = sessionId;
  }

  private key(marketId: string, stream: MarketDataStream): string {
    return `${marketId}:${stream}`;
  }

  next(marketId: ExchangeMarketId, stream: MarketDataStream): bigint {
    const key = this.key(marketId, stream);
    const current = this.sequences.get(key) ?? {
      marketId,
      stream,
      sessionId: this.sessionId,
      nextSequence: 1n,
    };
    const seq = current.nextSequence;
    this.sequences.set(key, { ...current, nextSequence: seq + 1n });
    return seq;
  }

  publishSnapshot(input: {
    readonly marketId: ExchangeMarketId;
    readonly stream: MarketDataStream;
    readonly state: MarketState;
    readonly auctionState: AuctionState | null;
    readonly orders: readonly DigitalOrder[];
    readonly lastTrade: ImmutableTrade | null;
    readonly volume: bigint;
    readonly tradeCount: bigint;
    readonly at: UtcInstant;
  }): MarketDataSnapshot {
    const depth = depthFromOrders(input.orders);
    const sequence = this.next(input.marketId, input.stream);
    const snapshot: MarketDataSnapshot = Object.freeze({
      marketId: input.marketId,
      stream: input.stream,
      sequence,
      snapshotId: `mds_${input.marketId}_${sequence.toString()}`,
      at: input.at,
      state: input.state,
      auctionState: input.auctionState,
      bestBid: depth.bids[0]?.priceUnits ?? null,
      bestAsk: depth.asks[0]?.priceUnits ?? null,
      lastTradePrice: input.lastTrade?.price.priceUnits ?? null,
      lastTradeQuantity: input.lastTrade?.quantity.scaledUnits ?? null,
      depth,
      volume: input.volume,
      tradeCount: input.tradeCount,
      digest: digest([
        input.marketId,
        input.stream,
        sequence.toString(),
        input.state,
        (depth.bids[0]?.priceUnits ?? 0n).toString(),
        (depth.asks[0]?.priceUnits ?? 0n).toString(),
        input.volume.toString(),
      ]),
      lastPriceLabel: input.lastTrade ? 'SIMULATION_MARKET_PRICE' : 'UNAVAILABLE',
    });
    this.snapshots.set(this.key(input.marketId, input.stream), snapshot);
    this.increments.set(this.key(input.marketId, input.stream), []);
    return snapshot;
  }

  publishIncrement(input: {
    readonly marketId: ExchangeMarketId;
    readonly stream: MarketDataStream;
    readonly kind: MarketDataIncrement['kind'];
    readonly payload: MarketDataIncrement['payload'];
    readonly at: UtcInstant;
  }): MarketDataIncrement {
    const snapshot = this.snapshots.get(this.key(input.marketId, input.stream));
    const sequence = this.next(input.marketId, input.stream);
    const increment: MarketDataIncrement = Object.freeze({
      marketId: input.marketId,
      stream: input.stream,
      sequence,
      snapshotSeq: snapshot?.sequence ?? 0n,
      kind: input.kind,
      payload: input.payload,
      digest: digest([input.marketId, input.stream, sequence.toString(), input.kind, JSON.stringify(input.payload)]),
      at: input.at,
    });
    const list = this.increments.get(this.key(input.marketId, input.stream)) ?? [];
    list.push(increment);
    this.increments.set(this.key(input.marketId, input.stream), list);
    return increment;
  }

  recover(marketId: ExchangeMarketId, stream: MarketDataStream, fromSeq: bigint): {
    readonly snapshot: MarketDataSnapshot | null;
    readonly increments: readonly MarketDataIncrement[];
    readonly gap: boolean;
  } {
    const snapshot = this.snapshots.get(this.key(marketId, stream)) ?? null;
    const all = this.increments.get(this.key(marketId, stream)) ?? [];
    const increments = all.filter((row) => row.sequence > fromSeq);
    const expected = fromSeq + 1n;
    const gap = increments.length > 0 && increments[0]!.sequence !== expected && (snapshot === null || fromSeq < snapshot.sequence);
    return { snapshot, increments: gap && snapshot ? all.filter((row) => row.sequence > snapshot.sequence) : increments, gap };
  }

  publicView(snapshot: MarketDataSnapshot, tier: MarketDataTier): PublicMarketDataView {
    const delayed = tier === 'PUBLIC_DELAYED';
    return Object.freeze({
      tier,
      marketId: snapshot.marketId,
      delayedMs: delayed ? 15 * 60 * 1000 : 0,
      depthLevels: delayed ? 1 : snapshot.depth.bids.length + snapshot.depth.asks.length,
      bestBid: snapshot.bestBid,
      bestAsk: snapshot.bestAsk,
      lastTradePrice: snapshot.lastTradePrice,
      state: snapshot.state,
      sequence: snapshot.sequence,
    });
  }
}
