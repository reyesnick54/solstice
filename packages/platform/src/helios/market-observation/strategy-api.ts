/**
 * Strategy-facing provider-neutral market observation API.
 *
 * HELIOS agents and Strategy Lab orchestration must use this surface — not
 * provider adapters directly. All reads are filtered by knowableAt to prevent
 * look-ahead bias.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MarketTimeSeriesStore } from './time-series-store.ts';
import type { BarTimeframe, MarketSnapshot, OhlcvBar, MarketQuoteObservation } from './types.ts';

export type StrategyMarketDataApi = {
  readonly getBars: (input: {
    readonly instrumentId: string;
    readonly timeframe: BarTimeframe;
    readonly knowableAt: UtcInstant;
    readonly from?: UtcInstant;
    readonly to?: UtcInstant;
    readonly limit?: number;
    readonly providerId?: string;
    readonly freshnessThresholdMs?: number;
  }) => readonly OhlcvBar[];
  readonly getLatestQuote: (input: {
    readonly instrumentId: string;
    readonly knowableAt: UtcInstant;
    readonly providerId?: string;
    readonly freshnessThresholdMs?: number;
  }) => MarketQuoteObservation | null;
  readonly getMarketSnapshot: (input: {
    readonly instrumentId: string;
    readonly knowableAt: UtcInstant;
    readonly timeframes?: readonly BarTimeframe[];
    readonly providerId?: string;
    readonly freshnessThresholdMs?: number;
  }) => MarketSnapshot;
};

export function createStrategyMarketDataApi(store: MarketTimeSeriesStore): StrategyMarketDataApi {
  return Object.freeze({
    getBars(input) {
      return store.getBars({
        instrumentId: input.instrumentId,
        timeframe: input.timeframe,
        knowableAt: input.knowableAt,
        ...(input.from !== undefined ? { from: input.from } : {}),
        ...(input.to !== undefined ? { to: input.to } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        ...(input.freshnessThresholdMs !== undefined
          ? { freshnessThresholdMs: input.freshnessThresholdMs }
          : {}),
      });
    },
    getLatestQuote(input) {
      return store.getLatestQuote({
        instrumentId: input.instrumentId,
        knowableAt: input.knowableAt,
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        ...(input.freshnessThresholdMs !== undefined
          ? { freshnessThresholdMs: input.freshnessThresholdMs }
          : {}),
      });
    },
    getMarketSnapshot(input) {
      const query = {
        instrumentId: input.instrumentId,
        knowableAt: input.knowableAt,
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        ...(input.freshnessThresholdMs !== undefined
          ? { freshnessThresholdMs: input.freshnessThresholdMs }
          : {}),
      };
      const timeframes = input.timeframes ?? (['15m', '1h', '4h', '1d'] as const);
      const latestBarByTimeframe: Partial<Record<BarTimeframe, OhlcvBar>> = {};
      for (const timeframe of timeframes) {
        const bars = store.getBars({ ...query, timeframe, limit: 1 });
        const latest = bars[bars.length - 1];
        if (latest) {
          latestBarByTimeframe[timeframe] = latest;
        }
      }
      return Object.freeze({
        instrumentId: input.instrumentId,
        asOfKnowableAt: input.knowableAt,
        latestQuote: store.getLatestQuote(query),
        latestTrade: store.getLatestTrade(query),
        marketStatus: store.getLatestMarketStatus(query),
        orderBook: store.getLatestOrderBook(query),
        latestBarByTimeframe: Object.freeze(latestBarByTimeframe),
      });
    },
  });
}
