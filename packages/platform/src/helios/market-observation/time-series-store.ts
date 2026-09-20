/**
 * In-memory time-series store with knowableAt-aware query semantics.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { HeliosObservationStoreSnapshot } from '../observation/store.ts';
import type {
  BarTimeframe,
  CanonicalMarketObservation,
  MarketQuoteObservation,
  MarketTradeObservation,
  MarketStatusObservation,
  OrderBookObservation,
  OhlcvBar,
  SealedMarketObservation,
} from './types.ts';
import { barDedupeKey } from './validation.ts';

export type MarketTimeSeriesStoreSnapshot = {
  readonly sealed: readonly SealedMarketObservation[];
  readonly barKeys: readonly string[];
  readonly lastSequenceByInstrument: Readonly<Record<string, bigint>>;
  readonly observationStore: HeliosObservationStoreSnapshot;
};

export type BarQuery = {
  readonly instrumentId: string;
  readonly timeframe: BarTimeframe;
  readonly knowableAt: UtcInstant;
  readonly from?: UtcInstant;
  readonly to?: UtcInstant;
  readonly limit?: number;
  readonly providerId?: string;
  readonly freshnessThresholdMs?: number;
};

export type LatestObservationQuery = {
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly providerId?: string;
  readonly freshnessThresholdMs?: number;
};

export type MarketTimeSeriesStore = {
  readonly put: (sealed: SealedMarketObservation) => void;
  readonly get: (observationId: string) => SealedMarketObservation | undefined;
  readonly list: () => readonly SealedMarketObservation[];
  readonly hasBar: (bar: OhlcvBar) => boolean;
  readonly getBars: (query: BarQuery) => readonly OhlcvBar[];
  readonly getLatestQuote: (query: LatestObservationQuery) => MarketQuoteObservation | null;
  readonly getLatestTrade: (query: LatestObservationQuery) => MarketTradeObservation | null;
  readonly getLatestMarketStatus: (query: LatestObservationQuery) => MarketStatusObservation | null;
  readonly getLatestOrderBook: (query: LatestObservationQuery) => OrderBookObservation | null;
  readonly lastSequenceFor: (instrumentId: string) => bigint | null;
  readonly recordSequence: (instrumentId: string, sequence: bigint) => void;
  readonly observationStoreSnapshot: () => HeliosObservationStoreSnapshot;
  readonly restoreObservationStore: (snapshot: HeliosObservationStoreSnapshot) => void;
  readonly snapshot: () => MarketTimeSeriesStoreSnapshot;
  readonly restore: (snapshot: MarketTimeSeriesStoreSnapshot) => void;
};

function withinFreshness(
  observationKnowableAt: UtcInstant,
  queryKnowableAt: UtcInstant,
  thresholdMs: number | undefined,
): boolean {
  if (Date.parse(queryKnowableAt) < Date.parse(observationKnowableAt)) {
    return false;
  }
  if (thresholdMs === undefined) return true;
  const ageMs = Date.parse(queryKnowableAt) - Date.parse(observationKnowableAt);
  return ageMs <= thresholdMs;
}

function sortByKnowableAt(a: SealedMarketObservation, b: SealedMarketObservation): number {
  return Date.parse(a.knowableAt) - Date.parse(b.knowableAt);
}

export function rebuildMarketTimeSeriesFromEnvelopes(
  store: MarketTimeSeriesStore,
  envelopes: readonly import('../observation/types.ts').HeliosMarketObservationEnvelope[],
): void {
  for (const envelope of envelopes) {
    const data = envelope.observation.data as CanonicalMarketObservation;
    if (!data || typeof data !== 'object' || !('schema' in data)) continue;
    if (data.schema !== 'sunrey.helios.market-time-series.v1') continue;
    store.put(
      Object.freeze({
        marketObservation: data,
        envelope,
        informationTime: envelope.informationTime,
        knowableAt: envelope.informationTime.knowableAt,
      }),
    );
  }
}

export function createMarketTimeSeriesStore(
  observationStoreSnapshot: () => HeliosObservationStoreSnapshot,
  restoreObservationStore: (snapshot: HeliosObservationStoreSnapshot) => void,
): MarketTimeSeriesStore {
  const sealedById = new Map<string, SealedMarketObservation>();
  const sealedList: SealedMarketObservation[] = [];
  const barKeys = new Set<string>();
  const lastSequenceByInstrument = new Map<string, bigint>();

  function put(sealed: SealedMarketObservation): void {
    if (sealedById.has(sealed.envelope.observationId)) {
      return;
    }
    sealedById.set(sealed.envelope.observationId, sealed);
    sealedList.push(sealed);
    if (sealed.marketObservation.observationType === 'ohlcv_bar') {
      barKeys.add(barDedupeKey(sealed.marketObservation));
    }
    const seq = 'sequence' in sealed.marketObservation ? sealed.marketObservation.sequence : null;
    if (seq !== null) {
      const prior = lastSequenceByInstrument.get(sealed.marketObservation.instrumentId);
      if (prior === undefined || seq > prior) {
        lastSequenceByInstrument.set(sealed.marketObservation.instrumentId, seq);
      }
    }
  }

  function eligible(sealed: SealedMarketObservation, query: LatestObservationQuery): boolean {
    if (sealed.marketObservation.instrumentId !== query.instrumentId) return false;
    if (query.providerId && sealed.marketObservation.providerId !== query.providerId) return false;
    return withinFreshness(sealed.knowableAt, query.knowableAt, query.freshnessThresholdMs);
  }

  function latestOf<T extends CanonicalMarketObservation['observationType']>(
    query: LatestObservationQuery,
    type: T,
  ): Extract<CanonicalMarketObservation, { observationType: T }> | null {
    let best: SealedMarketObservation | null = null;
    for (const sealed of sealedList) {
      if (sealed.marketObservation.observationType !== type) continue;
      if (!eligible(sealed, query)) continue;
      if (!best || Date.parse(sealed.knowableAt) > Date.parse(best.knowableAt)) {
        best = sealed;
      }
    }
    return best ? (best.marketObservation as Extract<CanonicalMarketObservation, { observationType: T }>) : null;
  }

  return Object.freeze({
    put,
    get(observationId: string) {
      return sealedById.get(observationId);
    },
    list() {
      return Object.freeze([...sealedList].sort(sortByKnowableAt));
    },
    hasBar(bar: OhlcvBar) {
      return barKeys.has(barDedupeKey(bar));
    },
    getBars(query: BarQuery) {
      const rows = sealedList
        .filter((sealed) => {
          if (sealed.marketObservation.observationType !== 'ohlcv_bar') return false;
          const bar = sealed.marketObservation;
          if (bar.instrumentId !== query.instrumentId) return false;
          if (bar.timeframe !== query.timeframe) return false;
          if (query.providerId && bar.providerId !== query.providerId) return false;
          if (!withinFreshness(sealed.knowableAt, query.knowableAt, query.freshnessThresholdMs)) return false;
          if (query.from && Date.parse(bar.startTime) < Date.parse(query.from)) return false;
          if (query.to && Date.parse(bar.startTime) > Date.parse(query.to)) return false;
          return true;
        })
        .map((sealed) => sealed.marketObservation as OhlcvBar)
        .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
      if (query.limit !== undefined) {
        return Object.freeze(rows.slice(-query.limit));
      }
      return Object.freeze(rows);
    },
    getLatestQuote(query: LatestObservationQuery) {
      const quote = latestOf(query, 'quote');
      if (quote) return quote;
      return latestOf(query, 'best_bid_offer') ?? latestOf(query, 'reference_price');
    },
    getLatestTrade(query: LatestObservationQuery) {
      return latestOf(query, 'trade');
    },
    getLatestMarketStatus(query: LatestObservationQuery) {
      return latestOf(query, 'market_status');
    },
    getLatestOrderBook(query: LatestObservationQuery) {
      return latestOf(query, 'order_book_snapshot');
    },
    lastSequenceFor(instrumentId: string) {
      return lastSequenceByInstrument.get(instrumentId) ?? null;
    },
    recordSequence(instrumentId: string, sequence: bigint) {
      lastSequenceByInstrument.set(instrumentId, sequence);
    },
    observationStoreSnapshot,
    restoreObservationStore,
    snapshot() {
      return Object.freeze({
        sealed: Object.freeze([...sealedList]),
        barKeys: Object.freeze([...barKeys]),
        lastSequenceByInstrument: Object.freeze(Object.fromEntries(lastSequenceByInstrument)),
        observationStore: observationStoreSnapshot(),
      });
    },
    restore(snapshot: MarketTimeSeriesStoreSnapshot) {
      sealedById.clear();
      sealedList.length = 0;
      barKeys.clear();
      lastSequenceByInstrument.clear();
      restoreObservationStore(snapshot.observationStore);
      for (const key of snapshot.barKeys) barKeys.add(key);
      for (const [instrument, seq] of Object.entries(snapshot.lastSequenceByInstrument)) {
        lastSequenceByInstrument.set(instrument, BigInt(seq));
      }
      for (const sealed of snapshot.sealed) {
        put(sealed);
      }
    },
  });
}
