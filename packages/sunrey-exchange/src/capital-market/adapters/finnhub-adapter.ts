/**
 * Finnhub capital market adapter.
 *
 * Live external transport only. No fixture fallback at runtime.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import { authenticationError, canonicalJsonStringify, hashRawPayload } from '@solstice/provider-sdk';
import { resolveCapitalMarketEntitlement } from '../entitlement.ts';
import { CapitalMarketHttpClient, type CapitalMarketHttpClientOptions } from '../http/client.ts';
import { FINNHUB_ENDPOINT } from '../http/endpoints.ts';
import { resolveCapitalMarketInstrument } from '../instrument-registry.ts';
import type { CapitalMarketProvider } from '../provider.ts';
import type { CapitalMarketObservation, CapitalMarketProviderHealth, CapitalMarketResult } from '../types.ts';
import { quarantineIfInvalid } from '../validation.ts';
import {
  decimalToMinorUnits,
  finnhubSourceTimestamp,
  validateFinnhubQuotePayload,
  type FinnhubQuotePayload,
} from './parsers.ts';

export const FINNHUB_CREDENTIAL_ENV_VAR = 'FINNHUB_API_KEY' as const;

export type FinnhubCapitalMarketAdapterOptions = CapitalMarketHttpClientOptions & {
  readonly credentialEnvVar?: string;
};

function fail<T>(code: string, message: string): CapitalMarketResult<T> {
  return Object.freeze({ ok: false, code, message, providerId: 'finnhub' });
}

export class FinnhubCapitalMarketAdapter implements CapitalMarketProvider {
  readonly providerId = 'finnhub';
  readonly productionAuthorized = false as const;
  readonly credentialEnvVar: string;
  readonly #http: CapitalMarketHttpClient;
  #lastSuccess: UtcInstant | null = null;
  #rateLimited = false;
  #circuitOpen = false;
  #authenticated = false;

  constructor(options: FinnhubCapitalMarketAdapterOptions = {}) {
    this.credentialEnvVar = options.credentialEnvVar ?? FINNHUB_CREDENTIAL_ENV_VAR;
    this.#http = new CapitalMarketHttpClient({
      ...options,
      authStrategy: {
        kind: 'api_key_query',
        paramName: 'token',
        secretRef: {
          scheme: 'secret',
          provider: 'env',
          path: this.credentialEnvVar,
          href: `secret://env/${this.credentialEnvVar}`,
        },
      },
      authResolver: {
        resolverId: 'capital-market.env-auth',
        async resolve(strategy, context) {
          if (strategy.kind !== 'api_key_query') {
            return Object.freeze({ headers: Object.freeze({}), queryParams: Object.freeze({}) });
          }
          const value = process.env[strategy.secretRef.path]?.trim();
          if (!value) {
            return authenticationError(context.providerId, context.requestId, 401);
          }
          return Object.freeze({
            headers: Object.freeze({}),
            queryParams: Object.freeze({ [strategy.paramName]: value }),
          });
        },
      },
    });
  }

  credentialConfigured(): boolean {
    const value = process.env[this.credentialEnvVar]?.trim();
    return Boolean(value);
  }

  health(nowUtc: UtcInstant): CapitalMarketProviderHealth {
    const credentialConfigured = this.credentialConfigured();
    return Object.freeze({
      providerId: this.providerId,
      status: !credentialConfigured
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
      authenticated: this.#authenticated,
      credentialConfigured,
      lastSuccessAt: this.#lastSuccess,
      message: !credentialConfigured
        ? 'credential not configured'
        : this.#circuitOpen
          ? 'circuit open after repeated failures'
          : this.#rateLimited
            ? 'rate limited by provider'
            : null,
    });
  }

  async getQuote(instrumentId: string, nowUtc: UtcInstant): Promise<CapitalMarketResult<CapitalMarketObservation>> {
    if (!this.credentialConfigured()) {
      return fail('NOT_CONFIGURED', 'FINNHUB_API_KEY is not configured');
    }

    const instrument = resolveCapitalMarketInstrument(instrumentId);
    if (!instrument) {
      return fail('UNKNOWN_INSTRUMENT', `unknown instrument ${instrumentId}`);
    }

    const providerSymbol = instrument.providerSymbols.finnhub;
    if (!providerSymbol) {
      return fail('UNKNOWN_INSTRUMENT', `no finnhub mapping for ${instrumentId}`);
    }

    const response = await this.#http.getJson<FinnhubQuotePayload>(FINNHUB_ENDPOINT, '/quote', {
      symbol: providerSymbol,
    });

    if (!response.ok) {
      this.#rateLimited = response.code === 'RATE_LIMITED';
      this.#circuitOpen = response.code === 'TIMEOUT' || response.code === 'NETWORK_ERROR';
      this.#authenticated = response.code !== 'AUTHENTICATION_FAILED' && response.code !== 'NOT_CONFIGURED';
      return fail(response.code, response.message);
    }

    if (!validateFinnhubQuotePayload(response.data)) {
      return fail('INVALID_PAYLOAD', 'unexpected finnhub response shape');
    }

    const rawPayload = canonicalJsonStringify(response.data);
    const observation = this.#normalizeQuote({
      instrument,
      payload: response.data,
      rawPayload,
      nowUtc,
      providerSymbol,
    });
    const validated = quarantineIfInvalid(observation);
    if (!validated.ok) {
      return fail(validated.code, validated.message);
    }

    this.#lastSuccess = nowUtc;
    this.#rateLimited = false;
    this.#circuitOpen = false;
    this.#authenticated = true;
    return Object.freeze({ ok: true, value: observation, fromCache: false });
  }

  #normalizeQuote(input: {
    readonly instrument: ReturnType<typeof resolveCapitalMarketInstrument> & object;
    readonly payload: FinnhubQuotePayload;
    readonly rawPayload: string;
    readonly nowUtc: UtcInstant;
    readonly providerSymbol: string;
  }): CapitalMarketObservation {
    const sourceTimestampRaw = finnhubSourceTimestamp(input.payload);
    const sourceTimestamp = sourceTimestampRaw ? asUtcInstant(sourceTimestampRaw) : input.nowUtc;
    const entitlement = resolveCapitalMarketEntitlement({
      providerId: this.providerId,
      providerDeclaredRealtime: true,
      feedTier: 'free_tier',
      delayedMinutes: null,
    });

    return Object.freeze({
      schema: 'sunrey.capital-market.v1',
      authority: 'REFERENCE_ONLY',
      observationType: 'quote',
      instrument: Object.freeze({
        instrumentId: input.instrument.instrumentId,
        symbol: input.instrument.symbol,
        vendorSymbol: input.providerSymbol,
        assetClass: input.instrument.assetClass,
        venue: input.instrument.venue,
        currency: input.instrument.currency,
        isin: input.instrument.isin,
        figi: input.instrument.figi,
        providerNativeId: input.providerSymbol,
      }),
      bidMinorUnits: null,
      askMinorUnits: null,
      lastMinorUnits: decimalToMinorUnits(input.payload.c),
      openMinorUnits: decimalToMinorUnits(input.payload.o),
      highMinorUnits: decimalToMinorUnits(input.payload.h),
      lowMinorUnits: decimalToMinorUnits(input.payload.l),
      previousCloseMinorUnits: decimalToMinorUnits(input.payload.pc),
      volumeUnits: null,
      priceScale: 2,
      currency: input.instrument.currency,
      sessionStatus: 'UNKNOWN',
      providerId: this.providerId,
      sourceTimestamp,
      arrivalTimestamp: input.nowUtc,
      availabilityTimestamp: input.nowUtc,
      entitlement,
      sequenceNumber: null,
      provenance: Object.freeze({
        providerId: this.providerId,
        authorityClass: 'reference_data',
        sourceUrl: `https://finnhub.io/api/v1/quote?symbol=${input.providerSymbol}`,
        rawPayloadHash: hashRawPayload(input.rawPayload).digest,
        observationId: randomUUID(),
        capability: 'equity_quotes',
      }),
    });
  }
}

export function createFinnhubCapitalMarketAdapter(
  options?: FinnhubCapitalMarketAdapterOptions,
): FinnhubCapitalMarketAdapter {
  return new FinnhubCapitalMarketAdapter(options);
}
