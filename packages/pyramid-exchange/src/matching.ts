import { assertClearedOrder, type ClearedOrder } from './cleared-order.ts';
import type { Fill, Order, OrderSide } from './types.ts';
import { oppositeSide } from './types.ts';

export type BookLevel = {
  readonly price: bigint;
  readonly orders: readonly Order[];
};

export type OrderBookSnapshot = {
  readonly pair: string;
  readonly bids: readonly BookLevel[];
  readonly asks: readonly BookLevel[];
  readonly sequence: number;
};

export type MatchResult = {
  readonly fills: readonly Fill[];
  readonly resting: Order | undefined;
  readonly cancelled: boolean;
  readonly selfTradePrevented: boolean;
};

function priceTimeLess(a: Order, b: Order, side: OrderSide): boolean {
  const pa = a.price;
  const pb = b.price;
  if (pa === undefined || pb === undefined) {
    return a.sequence < b.sequence;
  }
  if (side === 'BUY') {
    if (pa !== pb) return pa > pb;
  } else if (pa !== pb) {
    return pa < pb;
  }
  return a.sequence < b.sequence;
}

/**
 * Deterministic price-time priority matching engine.
 * The only public entry is `accept(cleared: ClearedOrder)`.
 * A raw Order is not a legal argument.
 */
export class MatchingEngine {
  readonly #resting: Order[] = [];
  readonly #orders = new Map<string, Order>();
  readonly #fills: Fill[] = [];
  #fillSeq = 0;
  #bookSeq = 0;
  readonly seed: string;

  constructor(seed: string) {
    this.seed = seed;
  }

  get orderCount(): number {
    return this.#orders.size;
  }

  get fillCount(): number {
    return this.#fills.length;
  }

  listFills(): readonly Fill[] {
    return this.#fills.slice();
  }

  listResting(): readonly Order[] {
    return this.#resting.slice();
  }

  getOrder(id: string): Order | undefined {
    return this.#orders.get(id);
  }

  snapshot(pair: string): OrderBookSnapshot {
    const bids = this.#levels('BUY', pair);
    const asks = this.#levels('SELL', pair);
    return Object.freeze({
      pair,
      bids,
      asks,
      sequence: this.#bookSeq,
    });
  }

  #levels(side: OrderSide, pair: string): readonly BookLevel[] {
    const relevant = this.#resting.filter((order) => order.side === side && order.pair.symbol === pair);
    const byPrice = new Map<string, Order[]>();
    for (const order of relevant) {
      if (order.price === undefined) continue;
      const key = order.price.toString();
      const bucket = byPrice.get(key) ?? [];
      bucket.push(order);
      byPrice.set(key, bucket);
    }
    const prices = [...byPrice.keys()].map((key) => BigInt(key));
    prices.sort((a, b) => (side === 'BUY' ? (a > b ? -1 : a < b ? 1 : 0) : a < b ? -1 : a > b ? 1 : 0));
    return Object.freeze(
      prices.map((price) => {
        const orders = (byPrice.get(price.toString()) ?? []).slice();
        orders.sort((a, b) => a.sequence - b.sequence);
        return Object.freeze({ price, orders: Object.freeze(orders) });
      }),
    );
  }

  /**
   * Accept a compliance-cleared order. There is no overload for a raw Order.
   */
  accept(cleared: ClearedOrder): MatchResult {
    assertClearedOrder(cleared);
    const incoming = { ...cleared.order, remaining: cleared.order.quantity, state: 'CLEARED' as const };
    this.#bookSeq += 1;

    if (incoming.type === 'CANCEL') {
      return this.#cancel(incoming);
    }

    const fills: Fill[] = [];
    let remaining = incoming.quantity;
    let selfTradePrevented = false;
    const opposite = oppositeSide(incoming.side);

    const candidates = this.#resting
      .filter((resting) => resting.pair.symbol === incoming.pair.symbol && resting.side === opposite)
      .slice()
      .sort((a, b) => (priceTimeLess(a, b, opposite) ? -1 : 1));

    for (const candidate of candidates) {
      if (remaining <= 0n) break;
      if (incoming.type === 'LIMIT' && incoming.price !== undefined && candidate.price !== undefined) {
        if (incoming.side === 'BUY' && incoming.price < candidate.price) break;
        if (incoming.side === 'SELL' && incoming.price > candidate.price) break;
      }
      if (incoming.type === 'MARKET' && candidate.price === undefined) continue;
      if (candidate.customerId === incoming.customerId) {
        selfTradePrevented = true;
        continue;
      }
      const tradeQty = remaining < candidate.remaining ? remaining : candidate.remaining;
      const tradePrice = candidate.price ?? incoming.price;
      if (tradePrice === undefined) continue;

      remaining -= tradeQty;
      const makerRemaining = candidate.remaining - tradeQty;
      const makerState = makerRemaining === 0n ? 'FILLED' : 'PARTIALLY_FILLED';
      const makerNext: Order = Object.freeze({
        ...candidate,
        remaining: makerRemaining,
        state: makerState,
        updatedAt: incoming.updatedAt,
      });
      this.#replaceResting(makerNext);
      this.#orders.set(makerNext.id, makerNext);

      this.#fillSeq += 1;
      const buy = incoming.side === 'BUY' ? incoming : candidate;
      const sell = incoming.side === 'SELL' ? incoming : candidate;
      const fill: Fill = Object.freeze({
        id: `fill_${this.seed}_${this.#fillSeq}`,
        pair: incoming.pair.symbol,
        price: tradePrice,
        quantity: tradeQty,
        buyOrderId: buy.id,
        sellOrderId: sell.id,
        buyCustomerId: buy.customerId,
        sellCustomerId: sell.customerId,
        takerOrderId: incoming.id,
        makerOrderId: candidate.id,
        feeQuoteMinor: 0n,
        feePayerCustomerId: incoming.customerId,
        occurredAt: incoming.createdAt,
        sequence: this.#fillSeq,
      });
      fills.push(fill);
      this.#fills.push(fill);
    }

    let resting: Order | undefined;
    const filledQty = incoming.quantity - remaining;
    let state: Order['state'] = remaining === 0n ? 'FILLED' : filledQty > 0n ? 'PARTIALLY_FILLED' : 'CLEARED';

    if (incoming.timeInForce === 'FOK' && remaining > 0n) {
      this.#rollbackFills(fills);
      const cancelled: Order = Object.freeze({ ...incoming, remaining: incoming.quantity, state: 'CANCELLED' });
      this.#orders.set(cancelled.id, cancelled);
      return Object.freeze({ fills: Object.freeze([] as Fill[]), resting: undefined, cancelled: true, selfTradePrevented });
    }

    if (remaining > 0n && incoming.timeInForce !== 'IOC' && incoming.type !== 'MARKET') {
      resting = Object.freeze({
        ...incoming,
        remaining,
        state: filledQty > 0n ? 'PARTIALLY_FILLED' : 'RESTING',
      });
      this.#resting.push(resting);
      state = resting.state;
    } else if (remaining > 0n) {
      state = filledQty > 0n ? 'PARTIALLY_FILLED' : 'CANCELLED';
    }

    const finalOrder: Order = Object.freeze({
      ...incoming,
      remaining,
      state,
    });
    this.#orders.set(finalOrder.id, finalOrder);
    return Object.freeze({
      fills: Object.freeze(fills.slice()),
      resting,
      cancelled: state === 'CANCELLED',
      selfTradePrevented,
    });
  }

  #cancel(incoming: Order): MatchResult {
    const existing = this.#orders.get(incoming.id) ?? this.#resting.find((row) => row.id === incoming.id);
    if (!existing) {
      const cancelled: Order = Object.freeze({ ...incoming, state: 'CANCELLED' });
      this.#orders.set(cancelled.id, cancelled);
      return Object.freeze({ fills: Object.freeze([] as Fill[]), resting: undefined, cancelled: true, selfTradePrevented: false });
    }
    this.#resting.splice(
      0,
      this.#resting.length,
      ...this.#resting.filter((row) => row.id !== existing.id),
    );
    const cancelled: Order = Object.freeze({ ...existing, state: 'CANCELLED', remaining: existing.remaining });
    this.#orders.set(cancelled.id, cancelled);
    return Object.freeze({ fills: Object.freeze([] as Fill[]), resting: undefined, cancelled: true, selfTradePrevented: false });
  }

  #replaceResting(next: Order): void {
    const index = this.#resting.findIndex((row) => row.id === next.id);
    if (index < 0) return;
    if (next.remaining === 0n) {
      this.#resting.splice(index, 1);
      return;
    }
    this.#resting[index] = next;
  }

  #rollbackFills(fills: readonly Fill[]): void {
    for (const fill of fills) {
      const idx = this.#fills.findIndex((row) => row.id === fill.id);
      if (idx >= 0) this.#fills.splice(idx, 1);
    }
  }
}
