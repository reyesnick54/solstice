/**
 * Live HTTP crypto market reference adapter with fixture simulation fallback.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { providerNativeId, resolveCryptoAsset, searchRegisteredCryptoAssets } from '../assets.ts';
import { CRYPTO_MARKET_CACHE_CAPABILITIES } from '../cache-policies.ts';
import { CryptoMarketHttpClient, type CryptoMarketHttpClientOptions } from '../http/client.ts';
import { LIVE_CRYPTO_MARKET_ENDPOINTS } from '../http/endpoints.ts';
import { readCryptoMarketHttpCache, writeCryptoMarketHttpCache } from '../http/cache.ts';
import type { CryptoMarketReferenceProvider } from '../provider.ts';
import type {
  CryptoAssetSearchQuery,
  CryptoHistoryInterval,
  CryptoMarketCapability,
  CryptoMarketReferenceResult,
} from '../types.ts';
import { buildFixtureHistory, buildFixtureMetadata, loadCryptoFixture, normalizeFixtureQuote, normalizeProviderQuote } from './normalize.ts';
import {
  parseCoingeckoHistory,
  validateCoingeckoPayload,
  validateCoincapPayload,
  validateCoinlorePayload,
  validateCoinpaprikaPayload,
  validateCryptocomparePayload,
} from './parsers.ts';
import { createFixtureCryptoMarketAdapter } from './fixture-adapter.ts';

export type LiveCryptoAdapterConfig = {
  readonly providerId: string;
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly capabilities: readonly CryptoMarketCapability[];
  readonly fixtureFile: string;
  readonly blocked?: boolean;
  readonly requiresApiKey?: boolean;
  readonly validate: (raw: unknown, symbol?: string) => boolean;
  readonly buildQuotePath: (providerAssetId: string) => string;
  readonly quoteQuery?: (providerAssetId: string, assetSymbol: string) => Readonly<Record<string, string>>;
  readonly buildHistoryPath?: (providerAssetId: string, interval: CryptoHistoryInterval) => string;
  readonly historyQuery?: (range: { readonly from: UtcInstant; readonly to: UtcInstant }) => Readonly<Record<string, string>>;
  readonly quoteEndpointKey: keyof typeof LIVE_CRYPTO_MARKET_ENDPOINTS;
  readonly historyEndpointKey?: keyof typeof LIVE_CRYPTO_MARKET_ENDPOINTS;
};

export type LiveCryptoAdapterOptions = CryptoMarketHttpClientOptions;

function fail<T>(code: string, message: string, providerId: string): CryptoMarketReferenceResult<T> {
  return Object.freeze({ ok: false, code, message, providerId });
}

export class LiveCryptoMarketAdapter implements CryptoMarketReferenceProvider {
  readonly providerId: string;
  readonly capabilities: readonly CryptoMarketCapability[];
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly productionAuthorized = false as const;
  readonly liveCapable: boolean;
  readonly blocked: boolean;
  readonly #config: LiveCryptoAdapterConfig;
  readonly #http: CryptoMarketHttpClient;
  readonly #fixture: CryptoMarketReferenceProvider;
  #lastLiveSuccess: UtcInstant | null = null;
  #circuitOpen = false;
  #rateLimited = false;

  constructor(config: LiveCryptoAdapterConfig, options: LiveCryptoAdapterOptions = {}) {
    this.providerId = config.providerId;
    this.capabilities = Object.freeze([...config.capabilities]);
    this.priority = config.priority;
    this.blocked = config.blocked ?? false;
    this.liveCapable = !config.blocked && !config.requiresApiKey;
    this.#config = config;
    this.#http = new CryptoMarketHttpClient(options);
    this.#fixture = createFixtureCryptoMarketAdapter({
      providerId: config.providerId,
      precedence: 10,
      priority: config.priority,
      capabilities: config.capabilities,
      blocked: config.blocked,
    });
  }

  get liveProviderConnected(): boolean {
    return this.#http.mode === 'live' && this.#lastLiveSuccess !== null;
  }

  health(nowUtc: UtcInstant) {
    return Object.freeze({
      providerId: this.providerId,
      status: this.blocked || this.#circuitOpen ? 'unavailable' : this.#rateLimited ? 'degraded' : 'healthy',
      circuitState: this.#circuitOpen ? 'OPEN' : 'CLOSED',
      rateLimited: this.#rateLimited,
      lastSuccessAt: this.#lastLiveSuccess,
      message: this.blocked
        ? 'provider blocked pending review'
        : this.#http.mode === 'simulation'
          ? 'simulation fixture transport'
          : null,
      blocked: this.blocked,
    });
  }

  supportsCapability(capability: CryptoMarketCapability): boolean {
    return (this.capabilities as readonly string[]).includes(capability);
  }

  async getQuote(assetId: string, nowUtc: UtcInstant): Promise<CryptoMarketReferenceResult<import('../types.ts').CryptoMarketReferenceQuote>> {
    if (this.blocked) return fail('PROVIDER_BLOCKED', `provider ${this.providerId} is blocked`, this.providerId);
    if (!resolveCryptoAsset(assetId)) return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, this.providerId);

    if (this.#http.mode === 'simulation') {
      return this.#fixture.getQuote(assetId, nowUtc);
    }

    const cacheKey = `${this.providerId}:quote:${assetId}`;
    const cached = readCryptoMarketHttpCache<import('../types.ts').CryptoMarketReferenceQuote>(cacheKey);
    if (cached) {
      return Object.freeze({
        ok: true,
        value: cached.value,
        fromCache: true,
        fallbackProviderId: null,
      });
    }

    const asset = resolveCryptoAsset(assetId)!;
    const providerAssetId = providerNativeId(asset, this.providerId);
    if (!providerAssetId) {
      return fail('UNKNOWN_ASSET', `no provider mapping for ${assetId}`, this.providerId);
    }

    if (this.#config.requiresApiKey && !process.env.CRYPTOCOMPARE_API_KEY) {
      return fail('MISSING_CREDENTIAL', `missing credential for ${this.providerId}`, this.providerId);
    }

    const endpoint = LIVE_CRYPTO_MARKET_ENDPOINTS[this.#config.quoteEndpointKey];
    const response = await this.#http.getJson<unknown>(
      endpoint,
      this.#config.buildQuotePath(providerAssetId),
      this.#config.quoteQuery?.(providerAssetId, asset.symbol),
    );
    if (!response.ok) {
      this.#rateLimited = response.code === 'RATE_LIMITED';
      this.#circuitOpen = response.code === 'CIRCUIT_OPEN' || response.code === 'TIMEOUT';
      return fail(response.code, response.message, this.providerId);
    }

    if (!this.#config.validate(response.data, asset.symbol)) {
      return fail('INVALID_PAYLOAD', 'unexpected provider response shape', this.providerId);
    }

    const normalized = normalizeProviderQuote(this.providerId, response.data, assetId, nowUtc);
    if (!normalized.ok) {
      return fail(normalized.validation.code, normalized.validation.message, this.providerId);
    }

    this.#lastLiveSuccess = nowUtc;
    this.#rateLimited = false;
    this.#circuitOpen = false;
    writeCryptoMarketHttpCache(cacheKey, normalized.quote, CRYPTO_MARKET_CACHE_CAPABILITIES.spotQuote, nowUtc);
    return Object.freeze({ ok: true, value: normalized.quote, fromCache: false, fallbackProviderId: null });
  }

  async getQuotes(
    assetIds: readonly string[],
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly import('../types.ts').CryptoMarketReferenceQuote[]>> {
    const quotes = [];
    for (const assetId of assetIds) {
      const result = await this.getQuote(assetId, nowUtc);
      if (!result.ok) return result;
      quotes.push(result.value);
    }
    return Object.freeze({ ok: true, value: Object.freeze(quotes), fromCache: false, fallbackProviderId: null });
  }

  async getHistory(
    assetId: string,
    interval: CryptoHistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly import('../types.ts').CryptoMarketHistoryCandle[]>> {
    if (this.blocked) return fail('PROVIDER_BLOCKED', `provider ${this.providerId} is blocked`, this.providerId);
    const asset = resolveCryptoAsset(assetId);
    if (!asset) return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, this.providerId);
    if (!this.supportsCapability('crypto_market_history')) {
      return fail('CAPABILITY_UNSUPPORTED', 'historical data not supported', this.providerId);
    }

    if (this.#http.mode === 'simulation') {
      return this.#fixture.getHistory(assetId, interval, range, nowUtc);
    }

    const providerAssetId = providerNativeId(asset, this.providerId);
    if (!providerAssetId || !this.#config.buildHistoryPath || !this.#config.historyEndpointKey) {
      const fixture = buildFixtureHistory(asset, this.providerId, interval, range.from, range.to, nowUtc);
      return Object.freeze({ ok: true, value: fixture, fromCache: false, fallbackProviderId: null });
    }

    const cacheKey = `${this.providerId}:history:${assetId}:${interval}:${range.from}:${range.to}`;
    const cached = readCryptoMarketHttpCache<readonly import('../types.ts').CryptoMarketHistoryCandle[]>(cacheKey);
    if (cached) {
      return Object.freeze({ ok: true, value: cached.value, fromCache: true, fallbackProviderId: null });
    }

    const endpoint = LIVE_CRYPTO_MARKET_ENDPOINTS[this.#config.historyEndpointKey];
    const response = await this.#http.getJson<unknown>(
      endpoint,
      this.#config.buildHistoryPath(providerAssetId, interval),
      this.#config.historyQuery?.(range),
    );
    if (!response.ok) {
      return fail(response.code, response.message, this.providerId);
    }

    let candles: readonly import('../types.ts').CryptoMarketHistoryCandle[];
    if (this.providerId === 'coingecko') {
      candles = parseCoingeckoHistory(response.data, asset, this.providerId, interval, nowUtc);
    } else {
      candles = buildFixtureHistory(asset, this.providerId, interval, range.from, range.to, nowUtc);
    }

    writeCryptoMarketHttpCache(
      cacheKey,
      candles,
      interval === '1d' ? CRYPTO_MARKET_CACHE_CAPABILITIES.historyDaily : CRYPTO_MARKET_CACHE_CAPABILITIES.historyIntraday,
      nowUtc,
    );
    return Object.freeze({ ok: true, value: candles, fromCache: false, fallbackProviderId: null });
  }

  async searchAssets(
    query: CryptoAssetSearchQuery,
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly import('../types.ts').CryptoMarketAssetMetadata[]>> {
    return this.#fixture.searchAssets(query, nowUtc);
  }

  async getAssetMetadata(
    assetId: string,
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<import('../types.ts').CryptoMarketAssetMetadata>> {
    const asset = resolveCryptoAsset(assetId);
    if (!asset) return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, this.providerId);
    return Object.freeze({
      ok: true,
      value: buildFixtureMetadata(asset, this.providerId, nowUtc),
      fromCache: false,
      fallbackProviderId: null,
    });
  }
}

export function createLiveCoingeckoAdapter(options?: LiveCryptoAdapterOptions): LiveCryptoMarketAdapter {
  return new LiveCryptoMarketAdapter(
    {
      providerId: 'coingecko',
      priority: 'primary',
      capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history', 'crypto_metadata'],
      fixtureFile: 'coingecko-btc.json',
      validate: validateCoingeckoPayload,
      quoteEndpointKey: 'coingeckoQuote',
      historyEndpointKey: 'coingeckoHistory',
      buildQuotePath: (id) => `/${id}`,
      buildHistoryPath: (id) => `/${id}/market_chart`,
      historyQuery: () => ({ vs_currency: 'usd', days: '30' }),
    },
    options,
  );
}

export function createLiveCoincapAdapter(options?: LiveCryptoAdapterOptions): LiveCryptoMarketAdapter {
  return new LiveCryptoMarketAdapter(
    {
      providerId: 'coincap',
      priority: 'secondary',
      capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history'],
      fixtureFile: 'coincap-btc.json',
      validate: validateCoincapPayload,
      quoteEndpointKey: 'coincapQuote',
      historyEndpointKey: 'coincapHistory',
      buildQuotePath: (id) => `/${id}`,
      buildHistoryPath: (id) => `/${id}/history`,
      historyQuery: () => ({ interval: 'd1' }),
    },
    options,
  );
}

export function createLiveCoinpaprikaAdapter(options?: LiveCryptoAdapterOptions): LiveCryptoMarketAdapter {
  return new LiveCryptoMarketAdapter(
    {
      providerId: 'coinpaprika',
      priority: 'secondary',
      capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history', 'crypto_metadata'],
      fixtureFile: 'coinpaprika-btc.json',
      validate: validateCoinpaprikaPayload,
      quoteEndpointKey: 'coinpaprikaQuote',
      historyEndpointKey: 'coinpaprikaHistory',
      buildQuotePath: (id) => `/${id}`,
      buildHistoryPath: (id) => `/${id}/historical`,
      historyQuery: (range) => ({ start: range.from, end: range.to, interval: '1d' }),
    },
    options,
  );
}

export function createLiveCoinloreAdapter(options?: LiveCryptoAdapterOptions): LiveCryptoMarketAdapter {
  return new LiveCryptoMarketAdapter(
    {
      providerId: 'coinlore',
      priority: 'fallback',
      capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap'],
      fixtureFile: 'coinlore-btc.json',
      validate: validateCoinlorePayload,
      quoteEndpointKey: 'coinloreQuote',
      buildQuotePath: () => '/',
      quoteQuery: (id) => ({ id }),
    },
    options,
  );
}

export function createLiveCryptocompareAdapter(options?: LiveCryptoAdapterOptions): LiveCryptoMarketAdapter {
  return new LiveCryptoMarketAdapter(
    {
      providerId: 'cryptocompare',
      priority: 'secondary',
      capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_history', 'crypto_exchange_reference'],
      fixtureFile: 'cryptocompare-btc.json',
      requiresApiKey: true,
      validate: (raw, symbol) => validateCryptocomparePayload(raw, symbol ?? 'BTC'),
      quoteEndpointKey: 'cryptocompareQuote',
      buildQuotePath: () => '',
      quoteQuery: (_id, symbol) => ({ fsyms: symbol, tsyms: 'USD' }),
    },
    options,
  );
}

export function loadCryptoFixtureForProvider(providerId: string): unknown {
  const files: Record<string, string> = {
    coingecko: 'coingecko-btc.json',
    coincap: 'coincap-btc.json',
    coinpaprika: 'coinpaprika-btc.json',
    coinlore: 'coinlore-btc.json',
    cryptocompare: 'cryptocompare-btc.json',
  };
  const file = files[providerId];
  if (!file) return null;
  return loadCryptoFixture(file);
}
