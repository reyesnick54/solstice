/**
 * CoinGecko reference aggregate adapter — explicitly not venue market data.
 */

import { requireAaf07Certification } from '../../aaf07/certification.ts';
import { COINGECKO_REFERENCE_PROVIDER_ID } from '../../aaf07/profiles.ts';
import { resolveAaf09Instrument } from '../instruments.ts';
import { buildNormalizedObservation, decimalStringToMinorUnits, krakenSecondsToUtc } from '../normalization.ts';
import type { CryptoReferenceAdapter, CryptoVenueAdapterFetchContext, CryptoVenueAdapterResult } from './types.ts';

export type CoingeckoFetchFn = (url: string) => Promise<Response>;

export type CoingeckoReferenceAdapterOptions = {
  readonly fetchFn?: CoingeckoFetchFn;
  readonly baseUrl?: string;
};

function fail(code: string, message: string): CryptoVenueAdapterResult {
  return Object.freeze({ ok: false, code, message });
}

export function createCoingeckoReferenceAdapter(
  options: CoingeckoReferenceAdapterOptions = {},
): CryptoReferenceAdapter {
  const certification = requireAaf07Certification(COINGECKO_REFERENCE_PROVIDER_ID);
  const fetchFn = options.fetchFn ?? (async (url: string) => fetch(url));
  const baseUrl = options.baseUrl ?? 'https://api.coingecko.com/api/v3';

  return Object.freeze({
    providerId: COINGECKO_REFERENCE_PROVIDER_ID,
    aaf07Certified: certification.ok,

    async fetchReferenceQuote(ctx: CryptoVenueAdapterFetchContext): Promise<CryptoVenueAdapterResult> {
      if (!certification.ok) {
        return fail('AAF07_NOT_CERTIFIED', certification.verdict.blockers.join('; '));
      }
      const instrument = resolveAaf09Instrument(ctx.instrumentId);
      if (!instrument) return fail('INVALID_INSTRUMENT', `unknown instrument ${ctx.instrumentId}`);

      const vs = instrument.quoteCurrency.toLowerCase();
      const url = `${baseUrl}/simple/price?ids=${instrument.coingeckoId}&vs_currencies=${vs}&include_last_updated_at=true`;
      const response = await fetchFn(url);
      if (!response.ok) {
        return fail('PROVIDER_HTTP_ERROR', `CoinGecko HTTP ${response.status}`);
      }
      const payload = (await response.json()) as Record<
        string,
        Record<string, number> & { readonly last_updated_at?: number }
      >;
      const row = payload[instrument.coingeckoId];
      if (!row) return fail('MALFORMED_PAYLOAD', 'CoinGecko missing asset row');
      const priceKey = vs;
      const price = row[priceKey];
      if (typeof price !== 'number') {
        return fail('MALFORMED_PAYLOAD', `CoinGecko missing ${priceKey} price`);
      }
      const updatedAt = row.last_updated_at ?? Math.floor(Date.parse(ctx.nowUtc) / 1000);
      const eventTime = krakenSecondsToUtc(updatedAt);
      const minor = decimalStringToMinorUnits(price.toFixed(8));

      const observation = buildNormalizedObservation({
        instrument,
        providerId: COINGECKO_REFERENCE_PROVIDER_ID,
        observationKind: 'reference_quote',
        providerEventTime: eventTime,
        sunreyArrivalTime: ctx.nowUtc,
        sequenceId: null,
        sourceHealth: 'HEALTHY',
        rawPayload: payload,
        lastMinorUnits: minor,
        upstreamSourceRef: `coingecko:aggregate:${instrument.coingeckoId}:${vs}`,
      });
      return Object.freeze({ ok: true, observations: Object.freeze([observation]) });
    },
  });
}
