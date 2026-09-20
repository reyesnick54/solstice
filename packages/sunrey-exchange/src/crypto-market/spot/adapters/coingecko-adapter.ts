/**
 * CoinGecko crypto spot market adapter for HELIOS M06.
 *
 * Live external transport only. No fixture fallback at runtime.
 * Optional COINGECKO_API_KEY for higher rate limits.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import { canonicalJsonStringify, hashRawPayload } from '@solstice/provider-sdk';
import { resolveCapitalMarketInstrument } from '../../../capital-market/instrument-registry.ts';
import type { CapitalMarketProvider } from '../../../capital-market/provider.ts';
import {
  periodEndForBar,
  type CapitalMarketHistoricalRange,
  type CapitalMarketTimeframe,
} from '../../../capital-market/timeframes.ts';
import type {
  CapitalMarketBar,
  CapitalMarketCapabilityReport,
  CapitalMarketObservation,
  CapitalMarketProviderHealth,
  CapitalMarketResult,
  CapitalMarketSessionObservation,
} from '../../../capital-market/types.ts';
import { quarantineIfInvalid } from '../../../capital-market/validation.ts';
import { CryptoMarketHttpClient, type CryptoMarketHttpClientOptions } from '../../http/client.ts';
import { LIVE_CRYPTO_MARKET_ENDPOINTS } from '../../http/endpoints.ts';
import { resolveCryptoSpotEntitlement } from '../entitlement.ts';
import {
  coingeckoDaysHintForTimeframe,
  isCryptoSpotTimeframe,
  periodEndForCryptoBar,
  type CryptoSpotTimeframe,
} from '../timeframes.ts';
import {
  decimalToMinorUnits,
  parseCoingeckoMarketChartBars,
  parseCoingeckoOhlcBars,
  validateCoingeckoMarketChartPayload,
  validateCoingeckoOhlcPayload,
  validateCoingeckoSimplePricePayload,
  type CoingeckoMarketChartPayload,
  type CoingeckoOhlcPayload,
  type CoingeckoSimplePricePayload,
} from './parsers.ts';

export const COINGECKO_CREDENTIAL_ENV_VAR = 'COINGECKO_API_KEY' as const;
export const COINGECKO_PROVIDER_ID = 'coingecko' as const;

export type CoingeckoCryptoSpotAdapterOptions = CryptoMarketHttpClientOptions & {
  readonly credentialEnvVar?: string;
  readonly maintenanceActive?: boolean;
};

function fail<T>(code: string, message: string): CapitalMarketResult<T> {
  return Object.freeze({ ok: false, code, message, providerId: COINGECKO_PROVIDER_ID });
}

function toCapitalTimeframe(timeframe: CapitalMarketTimeframe): CryptoSpotTimeframe | null {
  return isCryptoSpotTimeframe(timeframe) ? timeframe : null;
}

export class CoingeckoCryptoSpotAdapter implements CapitalMarketProvider {
  readonly providerId = COINGECKO_PROVIDER_ID;
  readonly productionAuthorized = false as const;
  readonly credentialEnvVar: string;
  readonly #http: CryptoMarketHttpClient;
  readonly #maintenanceActive: boolean;
  #lastSuccess: UtcInstant | null = null;
  #rateLimited = false;
  #circuitOpen = false;
  #authenticated = false;

  constructor(options: CoingeckoCryptoSpotAdapterOptions = {}) {
    this.credentialEnvVar = options.credentialEnvVar ?? COINGECKO_CREDENTIAL_ENV_VAR;
    this.#maintenanceActive = options.maintenanceActive ?? false;
    this.#http = new CryptoMarketHttpClient({
      ...options,
      mode: 'live',
      authStrategy: {
        kind: 'header',
        headerName: 'x-cg-demo-api-key',
        secretRef: {
          scheme: 'secret',
          provider: 'env',
          path: this.credentialEnvVar,
          href: `secret://env/${this.credentialEnvVar}`,
        },
      },
      authResolver: {
        resolverId: 'crypto-spot.env-auth',
        async resolve(strategy, context) {
          if (strategy.kind !== 'header') {
            return Object.freeze({ headers: Object.freeze({}), queryParams: Object.freeze({}) });
          }
          const value = process.env[strategy.secretRef.path]?.trim();
          if (!value) {
            return Object.freeze({ headers: Object.freeze({}), queryParams: Object.freeze({}) });
          }
          return Object.freeze({
            headers: Object.freeze({ [strategy.headerName]: value }),
            queryParams: Object.freeze({}),
          });
        },
      },
    });
  }

  credentialConfigured(): boolean {
    return true;
  }

  health(nowUtc: UtcInstant): CapitalMarketProviderHealth {
    const apiKeyConfigured = Boolean(process.env[this.credentialEnvVar]?.trim());
    return Object.freeze({
      providerId: this.providerId,
      status: this.#maintenanceActive
        ? 'unavailable'
        : this.#circuitOpen
          ? 'unavailable'
          : this.#rateLimited
            ? 'degraded'
            : this.#lastSuccess
              ? 'healthy'
              : 'degraded',
      circuitState: this.#circuitOpen ? 'OPEN' : 'CLOSED',
      rateLimited: this.#rateLimited,
      authenticated: this.#authenticated || apiKeyConfigured,
      credentialConfigured: true,
      lastSuccessAt: this.#lastSuccess,
      message: this.#maintenanceActive
        ? 'provider maintenance window active'
        : this.#circuitOpen
          ? 'circuit open after repeated failures'
          : this.#rateLimited
            ? 'rate limited by provider'
            : apiKeyConfigured
              ? null
              : 'public demo tier; optional COINGECKO_API_KEY improves rate limits',
    });
  }

  getCapabilities(nowUtc: UtcInstant): readonly CapitalMarketCapabilityReport[] {
    const maintenance = this.#maintenanceActive;
    const status = maintenance ? 'unavailable' : 'available';
    const message = maintenance ? 'maintenance window active' : null;
    return Object.freeze([
      Object.freeze({ capability: 'crypto_spot_quote', status, message }),
      Object.freeze({ capability: 'crypto_spot_ohlcv', status, message }),
      Object.freeze({ capability: 'crypto_spot_historical_bars', status, message }),
      Object.freeze({ capability: 'crypto_spot_venue_status', status, message }),
    ]);
  }

  async getQuote(instrumentId: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketObservation>> {
    if (this.#maintenanceActive) {
      return fail('PROVIDER_MAINTENANCE', 'coingecko maintenance window active');
    }

    const instrument = resolveCapitalMarketInstrument(instrumentId);
    if (!instrument) {
      return fail('UNKNOWN_INSTRUMENT', `unknown instrument ${instrumentId}`);
    }

    const coinId = instrument.providerSymbols.coingecko;
    if (!coinId) {
      return fail('UNKNOWN_INSTRUMENT', `no coingecko mapping for ${instrumentId}`);
    }

    const response = await this.#http.getJson<CoingeckoSimplePricePayload>(
      LIVE_CRYPTO_MARKET_ENDPOINTS.coingeckoQuote,
      '/simple/price',
      {
        ids: coinId,
        vs_currencies: 'usd',
        include_24hr_vol: 'true',
        include_last_updated_at: 'true',
      },
    );

    if (!response.ok) {
      this.#applyFailureState(response.code);
      return fail(response.code, response.message);
    }

    const simple = response.data as CoingeckoSimplePricePayload & {
      readonly [key: string]: { readonly usd?: number; readonly usd_24h_vol?: number; readonly last_updated_at?: number };
    };
    const price = validateCoingeckoSimplePricePayload(simple, coinId) ? simple[coinId]?.usd : undefined;
    const quoteVolumeUsd = simple[coinId]?.usd_24h_vol ?? null;

    if (typeof price !== 'number' || price <= 0) {
      return fail('INVALID_PAYLOAD', 'unexpected coingecko quote response shape');
    }

    const rawPayload = canonicalJsonStringify(response.data);
    const observation = this.#normalizeQuote({
      instrument,
      coinId,
      price,
      quoteVolumeUsd: typeof quoteVolumeUsd === 'number' ? quoteVolumeUsd : null,
      rawPayload,
      nowUtc,
    });
    const validated = quarantineIfInvalid(observation);
    if (!validated.ok) {
      return fail(validated.code, validated.message);
    }

    this.#markSuccess(nowUtc);
    return Object.freeze({ ok: true, value: observation, fromCache: false });
  }

  async getHistoricalBars(
    instrumentId: string,
    timeframe: CapitalMarketTimeframe,
    range: CapitalMarketHistoricalRange,
    nowUtc: UtcInstant,
  ): Promise<CapitalMarketResult<readonly CapitalMarketBar[]>> {
    if (this.#maintenanceActive) {
      return fail('PROVIDER_MAINTENANCE', 'coingecko maintenance window active');
    }

    const cryptoTf = toCapitalTimeframe(timeframe);
    if (!cryptoTf) {
      return fail('UNSUPPORTED_TIMEFRAME', `unsupported crypto timeframe ${timeframe}`);
    }

    const instrument = resolveCapitalMarketInstrument(instrumentId);
    if (!instrument) {
      return fail('UNKNOWN_INSTRUMENT', `unknown instrument ${instrumentId}`);
    }

    const coinId = instrument.providerSymbols.coingecko;
    if (!coinId) {
      return fail('UNKNOWN_INSTRUMENT', `no coingecko mapping for ${instrumentId}`);
    }

    const days = String(coingeckoDaysHintForTimeframe(cryptoTf));
    const useOhlc = cryptoTf === '4h' || cryptoTf === '1d';
    const endpoint = useOhlc ? LIVE_CRYPTO_MARKET_ENDPOINTS.coingeckoHistory : LIVE_CRYPTO_MARKET_ENDPOINTS.coingeckoHistory;
    const pathSuffix = useOhlc ? `/${coinId}/ohlc` : `/${coinId}/market_chart`;
    const query = useOhlc
      ? { vs_currency: 'usd', days }
      : { vs_currency: 'usd', days };

    const response = await this.#http.getJson<CoingeckoOhlcPayload | CoingeckoMarketChartPayload>(
      endpoint,
      pathSuffix,
      query,
    );

    if (!response.ok) {
      this.#applyFailureState(response.code);
      return fail(response.code, response.message);
    }

    const rawPayload = canonicalJsonStringify(response.data);
    const bars = useOhlc
      ? this.#normalizeOhlcBars({
          payload: response.data as CoingeckoOhlcPayload,
          rawPayload,
          instrument,
          coinId,
          timeframe: cryptoTf,
          nowUtc,
        })
      : this.#normalizeMarketChartBars({
          payload: response.data as CoingeckoMarketChartPayload,
          rawPayload,
          instrument,
          coinId,
          timeframe: cryptoTf,
          nowUtc,
        });

    if (bars.length === 0) {
      return fail('PROVIDER_CAPABILITY_UNAVAILABLE', `coingecko returned no bars for ${coinId} ${timeframe}`);
    }

    this.#markSuccess(nowUtc);
    return Object.freeze({ ok: true, value: bars, fromCache: false });
  }

  async getMarketStatus(
    exchange: string,
    nowUtc: UtcInstant,
  ): Promise<CapitalMarketResult<CapitalMarketSessionObservation>> {
    if (this.#maintenanceActive) {
      const rawPayload = canonicalJsonStringify({ maintenance: true, exchange });
      return Object.freeze({
        ok: true,
        value: Object.freeze({
          schema: 'sunrey.capital-market.v1',
          authority: 'REFERENCE_ONLY',
          observationType: 'session_status',
          exchange,
          sessionStatus: 'CLOSED',
          providerSession: 'maintenance',
          isOpen: false,
          timezone: 'UTC',
          holiday: null,
          providerId: this.providerId,
          sourceTimestamp: nowUtc,
          arrivalTimestamp: nowUtc,
          entitlement: resolveCryptoSpotEntitlement({
            apiKeyConfigured: Boolean(process.env[this.credentialEnvVar]?.trim()),
            providerDeclaredRealtime: true,
          }),
          provenance: Object.freeze({
            providerId: this.providerId,
            authorityClass: 'reference_data',
            sourceUrl: null,
            rawPayloadHash: hashRawPayload(rawPayload).digest,
            observationId: randomUUID(),
            capability: 'crypto_spot_venue_status',
          }),
        }),
        fromCache: false,
      });
    }

    const rawPayload = canonicalJsonStringify({ exchange, crypto24x7: true, open: true });
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        schema: 'sunrey.capital-market.v1',
        authority: 'REFERENCE_ONLY',
        observationType: 'session_status',
        exchange,
        sessionStatus: 'OPEN',
        providerSession: '24x7',
        isOpen: true,
        timezone: 'UTC',
        holiday: null,
        providerId: this.providerId,
        sourceTimestamp: nowUtc,
        arrivalTimestamp: nowUtc,
        entitlement: resolveCryptoSpotEntitlement({
          apiKeyConfigured: Boolean(process.env[this.credentialEnvVar]?.trim()),
          providerDeclaredRealtime: true,
        }),
        provenance: Object.freeze({
          providerId: this.providerId,
          authorityClass: 'reference_data',
          sourceUrl: null,
          rawPayloadHash: hashRawPayload(rawPayload).digest,
          observationId: randomUUID(),
          capability: 'crypto_spot_venue_status',
        }),
      }),
      fromCache: false,
    });
  }

  #normalizeQuote(input: {
    readonly instrument: NonNullable<ReturnType<typeof resolveCapitalMarketInstrument>>;
    readonly coinId: string;
    readonly price: number;
    readonly quoteVolumeUsd: number | null;
    readonly rawPayload: string;
    readonly nowUtc: UtcInstant;
  }): CapitalMarketObservation {
    const entitlement = resolveCryptoSpotEntitlement({
      apiKeyConfigured: Boolean(process.env[this.credentialEnvVar]?.trim()),
      providerDeclaredRealtime: true,
    });

    return Object.freeze({
      schema: 'sunrey.capital-market.v1',
      authority: 'REFERENCE_ONLY',
      observationType: 'quote',
      instrument: Object.freeze({
        instrumentId: input.instrument.instrumentId,
        symbol: input.instrument.symbol,
        vendorSymbol: input.coinId,
        assetClass: input.instrument.assetClass,
        venue: input.instrument.venue,
        currency: input.instrument.currency,
        isin: input.instrument.isin,
        figi: input.instrument.figi,
        providerNativeId: input.coinId,
      }),
      bidMinorUnits: null,
      askMinorUnits: null,
      lastMinorUnits: decimalToMinorUnits(input.price, input.instrument.currency === 'USD' ? 2 : 2),
      openMinorUnits: null,
      highMinorUnits: null,
      lowMinorUnits: null,
      previousCloseMinorUnits: null,
      volumeUnits:
        input.quoteVolumeUsd !== null
          ? decimalToMinorUnits(input.quoteVolumeUsd, 2)
          : null,
      priceScale: 2,
      currency: input.instrument.currency,
      sessionStatus: this.#maintenanceActive ? 'CLOSED' : 'OPEN',
      providerId: this.providerId,
      sourceTimestamp: input.nowUtc,
      arrivalTimestamp: input.nowUtc,
      availabilityTimestamp: input.nowUtc,
      entitlement,
      sequenceNumber: null,
      provenance: Object.freeze({
        providerId: this.providerId,
        authorityClass: 'reference_data',
        sourceUrl: `https://api.coingecko.com/api/v3/coins/${input.coinId}`,
        rawPayloadHash: hashRawPayload(input.rawPayload).digest,
        observationId: randomUUID(),
        capability: 'crypto_spot_quote',
      }),
    });
  }

  #normalizeOhlcBars(input: {
    readonly payload: CoingeckoOhlcPayload;
    readonly rawPayload: string;
    readonly instrument: NonNullable<ReturnType<typeof resolveCapitalMarketInstrument>>;
    readonly coinId: string;
    readonly timeframe: CryptoSpotTimeframe;
    readonly nowUtc: UtcInstant;
  }): readonly CapitalMarketBar[] {
    if (!validateCoingeckoOhlcPayload(input.payload)) {
      return Object.freeze([]);
    }
    const entitlement = resolveCryptoSpotEntitlement({
      apiKeyConfigured: Boolean(process.env[this.credentialEnvVar]?.trim()),
      providerDeclaredRealtime: false,
    });
    return Object.freeze(
      parseCoingeckoOhlcBars(input.payload, 2).map((row) => {
        const periodEnd = periodEndForCryptoBar(row.periodStart, input.timeframe);
        const barId = `${input.instrument.instrumentId}:${input.timeframe}:${row.periodStart}`;
        return Object.freeze({
          schema: 'sunrey.capital-market.v1' as const,
          authority: 'REFERENCE_ONLY' as const,
          barId,
          instrument: Object.freeze({
            instrumentId: input.instrument.instrumentId,
            symbol: input.instrument.symbol,
            vendorSymbol: input.coinId,
            assetClass: input.instrument.assetClass,
            venue: input.instrument.venue,
            currency: input.instrument.currency,
            isin: input.instrument.isin,
            figi: input.instrument.figi,
            providerNativeId: input.coinId,
          }),
          timeframe: input.timeframe,
          openMinorUnits: row.openMinorUnits,
          highMinorUnits: row.highMinorUnits,
          lowMinorUnits: row.lowMinorUnits,
          closeMinorUnits: row.closeMinorUnits,
          volumeUnits: null,
          priceScale: 2,
          currency: input.instrument.currency,
          periodStart: row.periodStart,
          periodEnd,
          providerId: this.providerId,
          sourceTimestamp: row.periodStart,
          arrivalTimestamp: input.nowUtc,
          entitlement,
          provenance: Object.freeze({
            providerId: this.providerId,
            authorityClass: 'reference_data',
            sourceUrl: `https://api.coingecko.com/api/v3/coins/${input.coinId}/ohlc`,
            rawPayloadHash: hashRawPayload(input.rawPayload).digest,
            observationId: randomUUID(),
            capability: 'crypto_spot_ohlcv',
          }),
        });
      }),
    );
  }

  #normalizeMarketChartBars(input: {
    readonly payload: CoingeckoMarketChartPayload;
    readonly rawPayload: string;
    readonly instrument: NonNullable<ReturnType<typeof resolveCapitalMarketInstrument>>;
    readonly coinId: string;
    readonly timeframe: CryptoSpotTimeframe;
    readonly nowUtc: UtcInstant;
  }): readonly CapitalMarketBar[] {
    if (!validateCoingeckoMarketChartPayload(input.payload)) {
      return Object.freeze([]);
    }
    const entitlement = resolveCryptoSpotEntitlement({
      apiKeyConfigured: Boolean(process.env[this.credentialEnvVar]?.trim()),
      providerDeclaredRealtime: false,
    });
    return Object.freeze(
      parseCoingeckoMarketChartBars(input.payload, 2).map((row) => {
        const periodEnd = periodEndForBar(row.periodStart, input.timeframe as CapitalMarketTimeframe);
        const barId = `${input.instrument.instrumentId}:${input.timeframe}:${row.periodStart}`;
        return Object.freeze({
          schema: 'sunrey.capital-market.v1' as const,
          authority: 'REFERENCE_ONLY' as const,
          barId,
          instrument: Object.freeze({
            instrumentId: input.instrument.instrumentId,
            symbol: input.instrument.symbol,
            vendorSymbol: input.coinId,
            assetClass: input.instrument.assetClass,
            venue: input.instrument.venue,
            currency: input.instrument.currency,
            isin: input.instrument.isin,
            figi: input.instrument.figi,
            providerNativeId: input.coinId,
          }),
          timeframe: input.timeframe as CapitalMarketTimeframe,
          openMinorUnits: row.closeMinorUnits,
          highMinorUnits: row.closeMinorUnits,
          lowMinorUnits: row.closeMinorUnits,
          closeMinorUnits: row.closeMinorUnits,
          volumeUnits: row.quoteVolumeMinorUnits,
          priceScale: 2,
          currency: input.instrument.currency,
          periodStart: row.periodStart,
          periodEnd,
          providerId: this.providerId,
          sourceTimestamp: row.periodStart,
          arrivalTimestamp: input.nowUtc,
          entitlement,
          provenance: Object.freeze({
            providerId: this.providerId,
            authorityClass: 'reference_data',
            sourceUrl: `https://api.coingecko.com/api/v3/coins/${input.coinId}/market_chart`,
            rawPayloadHash: hashRawPayload(input.rawPayload).digest,
            observationId: randomUUID(),
            capability: 'crypto_spot_ohlcv',
          }),
        });
      }),
    );
  }

  #applyFailureState(code: string): void {
    this.#rateLimited = code === 'RATE_LIMITED';
    this.#circuitOpen = code === 'TIMEOUT' || code === 'NETWORK_ERROR' || code === 'CIRCUIT_OPEN';
    this.#authenticated = code !== 'AUTHENTICATION_FAILED';
  }

  #markSuccess(nowUtc: UtcInstant): void {
    this.#lastSuccess = nowUtc;
    this.#rateLimited = false;
    this.#circuitOpen = false;
    this.#authenticated = true;
  }
}

export function createCoingeckoCryptoSpotAdapter(
  options?: CoingeckoCryptoSpotAdapterOptions,
): CoingeckoCryptoSpotAdapter {
  return new CoingeckoCryptoSpotAdapter(options);
}
