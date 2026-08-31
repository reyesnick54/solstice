/**
 * Crypto market reference service — canonical read-only crypto evidence plane.
 *
 * Separated from Exchange execution state. Uses primary/secondary/fallback
 * provider chains without synthetic consensus pricing.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { createProviderDataQualityEvent } from '../../../provider-sdk/src/events.ts';
import { ALL_CRYPTO_MARKET_ADAPTERS } from './adapters/index.ts';
import { cryptoHistoryCacheCapability, cryptoMarketCachePolicy, CRYPTO_MARKET_CACHE_CAPABILITIES } from './cache-policies.ts';
import type { CryptoMarketReferenceProvider } from './provider.ts';
import { loadCryptoMarketCatalog, providerPriorityOf } from './registry.ts';
import type {
  CryptoAssetSearchQuery,
  CryptoHistoryInterval,
  CryptoMarketAssetMetadata,
  CryptoMarketHistoryCandle,
  CryptoMarketReferenceQuote,
  CryptoMarketReferenceResult,
} from './types.ts';
import { detectPriceOutlier } from './validation.ts';

export type CryptoMarketReferenceServiceOptions = {
  readonly nowUtc?: UtcInstant;
  readonly providers?: readonly CryptoMarketReferenceProvider[];
};

type CacheEntry<T> = { readonly value: T; readonly expiresAtMs: number; readonly providerId: string };

export class CryptoMarketReferenceService {
  readonly #providers: readonly CryptoMarketReferenceProvider[];
  readonly #memory = new Map<string, CacheEntry<unknown>>();
  readonly #lastQuotes = new Map<string, bigint>();

  constructor(options: CryptoMarketReferenceServiceOptions = {}) {
    if (options.providers) {
      this.#providers = Object.freeze([...options.providers]);
      return;
    }
    let catalogProviders: CryptoMarketReferenceProvider[] = [];
    try {
      const catalogMatches = loadCryptoMarketCatalog();
      catalogProviders = catalogMatches
        .filter((match) => match.entry.sunrey.launch_tier !== 'blocked_pending_review')
        .map((match) => ALL_CRYPTO_MARKET_ADAPTERS.find((adapter) => adapter.providerId === match.entry.provider_id))
        .filter((provider): provider is CryptoMarketReferenceProvider => provider !== undefined && !provider.blocked);
    } catch {
      catalogProviders = [];
    }
    this.#providers = Object.freeze(
      catalogProviders.length > 0
        ? catalogProviders
        : ALL_CRYPTO_MARKET_ADAPTERS.filter((provider) => !provider.blocked),
    );
  }

  listProviders(): readonly CryptoMarketReferenceProvider[] {
    return this.#providers;
  }

  async getQuote(assetId: string, nowUtc: UtcInstant): Promise<CryptoMarketReferenceResult<CryptoMarketReferenceQuote>> {
    const cacheKey = `quote:${assetId}`;
    const cached = this.#readCache<CryptoMarketReferenceQuote>(cacheKey, CRYPTO_MARKET_CACHE_CAPABILITIES.spotQuote);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.getQuote(assetId, nowUtc),
      (value, providerId) => {
        const outlier = detectPriceOutlier({
          previousPriceMinorUnits: this.#lastQuotes.get(assetId) ?? null,
          nextPriceMinorUnits: value.priceMinorUnits,
        });
        if (!outlier.ok) {
          void createProviderDataQualityEvent('ProviderDataOutlier', nowUtc, {
            providerId,
            capability: 'crypto_prices',
            dataset: assetId,
            observationId: value.observationId,
            requestId: null,
            rawPayloadHash: value.provenance.rawPayloadHash,
            freshnessStatus: value.freshness.status,
            validationStatus: 'valid',
            detail: outlier.message,
          });
        }
        this.#lastQuotes.set(assetId, value.priceMinorUnits);
        this.#writeCache(cacheKey, CRYPTO_MARKET_CACHE_CAPABILITIES.spotQuote, value, providerId);
      },
    );
  }

  async getQuotes(
    assetIds: readonly string[],
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly CryptoMarketReferenceQuote[]>> {
    const quotes: CryptoMarketReferenceQuote[] = [];
    let fromCache = true;
    let providerId: string | null = null;
    for (const assetId of assetIds) {
      const result = await this.getQuote(assetId, nowUtc);
      if (!result.ok) return result;
      if (!result.fromCache) fromCache = false;
      providerId = result.value.providerId;
      quotes.push(result.value);
    }
    return { ok: true, value: Object.freeze(quotes), fromCache, fallbackProviderId: providerId };
  }

  async getHistory(
    assetId: string,
    interval: CryptoHistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly CryptoMarketHistoryCandle[]>> {
    const capability = cryptoHistoryCacheCapability(interval);
    const cacheKey = `history:${assetId}:${interval}:${range.from}:${range.to}`;
    const cached = this.#readCache<readonly CryptoMarketHistoryCandle[]>(cacheKey, capability);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.getHistory(assetId, interval, range, nowUtc),
      (value, providerId) => this.#writeCache(cacheKey, capability, value, providerId),
    );
  }

  async searchAssets(
    query: CryptoAssetSearchQuery,
    nowUtc: UtcInstant,
  ): Promise<CryptoMarketReferenceResult<readonly CryptoMarketAssetMetadata[]>> {
    const cacheKey = `search:${query.query}:${query.network ?? ''}:${query.limit ?? 20}`;
    const cached = this.#readCache<readonly CryptoMarketAssetMetadata[]>(cacheKey, CRYPTO_MARKET_CACHE_CAPABILITIES.assetMetadata);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.searchAssets(query, nowUtc),
      (value, providerId) => this.#writeCache(cacheKey, CRYPTO_MARKET_CACHE_CAPABILITIES.assetMetadata, value, providerId),
    );
  }

  async getAssetMetadata(assetId: string, nowUtc: UtcInstant): Promise<CryptoMarketReferenceResult<CryptoMarketAssetMetadata>> {
    const cacheKey = `asset:${assetId}`;
    const cached = this.#readCache<CryptoMarketAssetMetadata>(cacheKey, CRYPTO_MARKET_CACHE_CAPABILITIES.assetMetadata);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.getAssetMetadata(assetId, nowUtc),
      (value, providerId) => this.#writeCache(cacheKey, CRYPTO_MARKET_CACHE_CAPABILITIES.assetMetadata, value, providerId),
    );
  }

  executionSeparationProof(): Readonly<Record<string, boolean>> {
    return Object.freeze({
      referenceOnly: true,
      mutatesExchangeOrderBook: false,
      mutatesLedger: false,
      issuesExecutionAuthority: false,
      mutatesSunReyIssuance: false,
      mutatesMoonReyIssuance: false,
      agentCanTradeDirectly: false,
      externalCryptoIsContextOnly: true,
    });
  }

  #sortedProviders(): readonly CryptoMarketReferenceProvider[] {
    const order = { primary: 0, secondary: 1, fallback: 2 } as const;
    return Object.freeze([...this.#providers].sort((a, b) => order[a.priority] - order[b.priority]));
  }

  async #withFallback<T>(
    call: (provider: CryptoMarketReferenceProvider) => Promise<CryptoMarketReferenceResult<T>>,
    onSuccess?: (value: T, providerId: string) => void,
  ): Promise<CryptoMarketReferenceResult<T>> {
    const providers = this.#sortedProviders();
    let lastError: CryptoMarketReferenceResult<T> | null = null;
    for (const provider of providers) {
      const result = await call(provider);
      if (result.ok) {
        onSuccess?.(result.value, provider.providerId);
        return {
          ok: true,
          value: result.value,
          fromCache: result.fromCache,
          fallbackProviderId: result.fallbackProviderId ?? (provider.priority !== 'primary' ? provider.providerId : null),
        };
      }
      lastError = result;
    }
    return lastError ?? { ok: false, code: 'NO_PROVIDERS', message: 'no crypto market providers configured', providerId: null };
  }

  #readCache<T>(key: string, capability: string): CacheEntry<T> | null {
    const policy = cryptoMarketCachePolicy(capability);
    const entry = this.#memory.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      this.#memory.delete(key);
      return null;
    }
    void policy;
    return entry;
  }

  #writeCache<T>(key: string, capability: string, value: T, providerId: string): void {
    const policy = cryptoMarketCachePolicy(capability);
    this.#memory.set(
      key,
      Object.freeze({
        value,
        providerId,
        expiresAtMs: Date.now() + policy.freshTtlMs,
      }),
    );
  }
}

export function createCryptoMarketReferenceService(
  options: CryptoMarketReferenceServiceOptions = {},
): CryptoMarketReferenceService {
  return new CryptoMarketReferenceService(options);
}

export { providerPriorityOf };
