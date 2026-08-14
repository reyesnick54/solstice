import type { Fill } from './types.ts';
import type { MatchingEngine, OrderBookSnapshot } from './matching.ts';

export type TradePrint = {
  readonly tradeId: string;
  readonly pair: string;
  readonly price: bigint;
  readonly quantity: bigint;
  readonly occurredAt: string;
  readonly sequence: number;
};

export type HistoricalPoint = {
  readonly sequence: number;
  readonly price: bigint;
  readonly quantity: bigint;
  readonly cumulativeQuantity: bigint;
};

/**
 * Deterministic market data. Snapshots and prints are derived from the
 * seeded matching engine. The same seed + order sequence yields the same series.
 */
export class MarketDataService {
  readonly #engine: MatchingEngine;
  readonly #prints: TradePrint[] = [];

  constructor(engine: MatchingEngine) {
    this.#engine = engine;
  }

  recordFills(fills: readonly Fill[]): readonly TradePrint[] {
    const added: TradePrint[] = [];
    for (const fill of fills) {
      const print: TradePrint = Object.freeze({
        tradeId: fill.id,
        pair: fill.pair,
        price: fill.price,
        quantity: fill.quantity,
        occurredAt: fill.occurredAt,
        sequence: fill.sequence,
      });
      this.#prints.push(print);
      added.push(print);
    }
    return Object.freeze(added);
  }

  snapshot(pair: string): OrderBookSnapshot {
    return this.#engine.snapshot(pair);
  }

  prints(): readonly TradePrint[] {
    return this.#prints.slice();
  }

  historicalSeries(): readonly HistoricalPoint[] {
    let cumulative = 0n;
    return Object.freeze(
      this.#prints.map((print) => {
        cumulative += print.quantity;
        return Object.freeze({
          sequence: print.sequence,
          price: print.price,
          quantity: print.quantity,
          cumulativeQuantity: cumulative,
        });
      }),
    );
  }
}
