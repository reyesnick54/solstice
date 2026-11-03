/**
 * Kraken public REST venue adapter — market data only (AAF07 certified profile).
 */

import { asUtcInstant, type UtcInstant } from '../../../../../../domain/src/time.ts';
import { requireAaf07Certification } from '../../aaf07/certification.ts';
import { KRAKEN_PROVIDER_ID } from '../../aaf07/profiles.ts';
import { resolveAaf09Instrument } from '../instruments.ts';
import {
  buildNormalizedObservation,
  decimalStringToMinorUnits,
  krakenSecondsToUtc,
} from '../normalization.ts';
import type { CryptoVenueAdapterFetchContext, CryptoVenueAdapterResult, CryptoVenueMarketDataAdapter } from './types.ts';

export type KrakenFetchFn = (url: string) => Promise<Response>;

export type KrakenVenueAdapterOptions = {
  readonly fetchFn?: KrakenFetchFn;
  readonly baseUrl?: string;
};

type KrakenTickerResult = Record<
  string,
  {
    readonly a: readonly [string, string, string];
    readonly b: readonly [string, string, string];
    readonly c: readonly [string, string];
  }
>;

type KrakenTradesResult = Record<string, unknown> & {
  readonly last?: string;
};

type KrakenOhlcResult = Record<string, unknown> & {
  readonly last?: number;
};

function fail(code: string, message: string): CryptoVenueAdapterResult {
  return Object.freeze({ ok: false, code, message });
}

export function createKrakenVenueAdapter(options: KrakenVenueAdapterOptions = {}): CryptoVenueMarketDataAdapter {
  const certification = requireAaf07Certification(KRAKEN_PROVIDER_ID);
  const fetchFn = options.fetchFn ?? (async (url: string) => fetch(url));
  const baseUrl = options.baseUrl ?? 'https://api.kraken.com/0/public';

  return Object.freeze({
    providerId: KRAKEN_PROVIDER_ID,
    aaf07Certified: certification.ok,

    async fetchBestBidOffer(ctx: CryptoVenueAdapterFetchContext): Promise<CryptoVenueAdapterResult> {
      if (!certification.ok) {
        return fail('AAF07_NOT_CERTIFIED', `Kraken adapter blocked: ${certification.verdict.blockers.join('; ')}`);
      }
      const instrument = resolveAaf09Instrument(ctx.instrumentId);
      if (!instrument) return fail('INVALID_INSTRUMENT', `unknown instrument ${ctx.instrumentId}`);

      const url = `${baseUrl}/Ticker?pair=${instrument.krakenPair}`;
      const response = await fetchFn(url);
      if (!response.ok) {
        return fail('PROVIDER_HTTP_ERROR', `Kraken ticker HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { readonly error: readonly string[]; readonly result: KrakenTickerResult };
      if (payload.error?.length) {
        return fail('PROVIDER_ERROR', payload.error.join(', '));
      }
      const entry = payload.result[instrument.krakenPair] ?? Object.values(payload.result)[0];
      if (!entry) return fail('MALFORMED_PAYLOAD', 'Kraken ticker missing pair');

      const bid = decimalStringToMinorUnits(entry.b[0]);
      const ask = decimalStringToMinorUnits(entry.a[0]);
      const last = decimalStringToMinorUnits(entry.c[0]);
      const eventTime = ctx.nowUtc;

      const observation = buildNormalizedObservation({
        instrument,
        providerId: KRAKEN_PROVIDER_ID,
        observationKind: 'best_bid_offer',
        providerEventTime: eventTime,
        sunreyArrivalTime: ctx.nowUtc,
        sequenceId: null,
        sourceHealth: 'HEALTHY',
        rawPayload: payload,
        bidMinorUnits: bid,
        askMinorUnits: ask,
        lastMinorUnits: last,
      });
      return Object.freeze({ ok: true, observations: Object.freeze([observation]) });
    },

    async fetchRecentTrades(ctx: CryptoVenueAdapterFetchContext): Promise<CryptoVenueAdapterResult> {
      if (!certification.ok) {
        return fail('AAF07_NOT_CERTIFIED', `Kraken adapter blocked: ${certification.verdict.blockers.join('; ')}`);
      }
      const instrument = resolveAaf09Instrument(ctx.instrumentId);
      if (!instrument) return fail('INVALID_INSTRUMENT', `unknown instrument ${ctx.instrumentId}`);

      const url = `${baseUrl}/Trades?pair=${instrument.krakenPair}`;
      const response = await fetchFn(url);
      if (!response.ok) {
        return fail('PROVIDER_HTTP_ERROR', `Kraken trades HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { readonly error: readonly string[]; readonly result: KrakenTradesResult };
      if (payload.error?.length) {
        return fail('PROVIDER_ERROR', payload.error.join(', '));
      }
      const rows = payload.result[instrument.krakenPair];
      if (!Array.isArray(rows) || rows.length === 0) {
        return fail('MALFORMED_PAYLOAD', 'Kraken trades missing rows');
      }
      const lastRow = rows[rows.length - 1] as readonly [string, string, number, string, string, string, number];
      const price = decimalStringToMinorUnits(lastRow[0]);
      const qty = decimalStringToMinorUnits(lastRow[1]);
      const eventTime = krakenSecondsToUtc(lastRow[2]);
      const sequenceId = String(lastRow[6] ?? payload.result.last ?? '');

      const observation = buildNormalizedObservation({
        instrument,
        providerId: KRAKEN_PROVIDER_ID,
        observationKind: 'trade',
        providerEventTime: eventTime,
        sunreyArrivalTime: ctx.nowUtc,
        sequenceId,
        sourceHealth: 'HEALTHY',
        rawPayload: payload,
        tradePriceMinorUnits: price,
        tradeQuantityMinorUnits: qty,
        lastMinorUnits: price,
      });
      return Object.freeze({ ok: true, observations: Object.freeze([observation]) });
    },

    async fetchOhlcvBar(
      ctx: CryptoVenueAdapterFetchContext & { readonly timeframe: '1h' },
    ): Promise<CryptoVenueAdapterResult> {
      if (!certification.ok) {
        return fail('AAF07_NOT_CERTIFIED', `Kraken adapter blocked: ${certification.verdict.blockers.join('; ')}`);
      }
      const instrument = resolveAaf09Instrument(ctx.instrumentId);
      if (!instrument) return fail('INVALID_INSTRUMENT', `unknown instrument ${ctx.instrumentId}`);

      const url = `${baseUrl}/OHLC?pair=${instrument.krakenPair}&interval=60`;
      const response = await fetchFn(url);
      if (!response.ok) {
        return fail('PROVIDER_HTTP_ERROR', `Kraken OHLC HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { readonly error: readonly string[]; readonly result: KrakenOhlcResult };
      if (payload.error?.length) {
        return fail('PROVIDER_ERROR', payload.error.join(', '));
      }
      const rows = payload.result[instrument.krakenPair];
      if (!Array.isArray(rows) || rows.length === 0) {
        return fail('MALFORMED_PAYLOAD', 'Kraken OHLC missing rows');
      }
      const lastRow = rows[rows.length - 1] as readonly [number, string, string, string, string, string, string, number];
      const eventTime = krakenSecondsToUtc(lastRow[0]);
      const observation = buildNormalizedObservation({
        instrument,
        providerId: KRAKEN_PROVIDER_ID,
        observationKind: 'ohlcv_bar',
        providerEventTime: eventTime,
        sunreyArrivalTime: ctx.nowUtc,
        sequenceId: String(payload.result.last ?? lastRow[0]),
        sourceHealth: 'HEALTHY',
        rawPayload: payload,
        barTimeframe: '1h',
        volumeMinorUnits: decimalStringToMinorUnits(lastRow[6]),
        ohlc: Object.freeze({
          open: decimalStringToMinorUnits(lastRow[1]),
          high: decimalStringToMinorUnits(lastRow[2]),
          low: decimalStringToMinorUnits(lastRow[3]),
          close: decimalStringToMinorUnits(lastRow[4]),
        }),
        lastMinorUnits: decimalStringToMinorUnits(lastRow[4]),
      });
      return Object.freeze({ ok: true, observations: Object.freeze([observation]) });
    },
  });
}

export function krakenHarnessNow(): UtcInstant {
  return asUtcInstant('2026-10-15T12:00:00.000Z');
}
