/**
 * Market reference service — canonical read-only market evidence plane.
 *
 * Separated from Exchange execution state. Uses primary/secondary/fallback
 * provider chains without averaging prices.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { createMarketReferenceAdapterFactory } from './adapters/factory.ts';
import { SimulationMarketReferenceAdapter } from './adapters/simulation.ts';
import { historyCacheCapability, marketReferenceCachePolicy, MARKET_REFERENCE_CACHE_CAPABILITIES } from './cache-policies.ts';
import type { MarketReferenceProvider } from './provider.ts';
import { loadMarketReferenceCatalog } from './registry.ts';
import type {
  AssetSearchQuery,
  CommodityCode,
  CommodityPriceObservation,
  HistoryInterval,
  MarketHistoryCandle,
  MarketReferenceAssetMetadata,
  MarketReferenceQuote,
  MarketReferenceResult,
} from './types.ts';

export type MarketReferenceServiceOptions = {
  readonly nowUtc?: UtcInstant;
  readonly providers?: readonly MarketReferenceProvider[];
  readonly includeSimulationFallback?: boolean;
};

type CacheEntry<T> = { readonly value: T; readonly expiresAtMs: number; readonly providerId: string };

export class MarketReferenceService {
  readonly #providers: readonly MarketReferenceProvider[];
  readonly #memory = new Map<string, CacheEntry<unknown>>();

  constructor(options: MarketReferenceServiceOptions = {}) {
    const catalogMatches = loadMarketReferenceCatalog();
    const factory = createMarketReferenceAdapterFactory(catalogMatches);
    const catalogProviders = catalogMatches
      .map((match) => factory.createFromCatalog(match.entry))
      .filter((provider): provider is MarketReferenceProvider => provider !== null);
    const simulation =
      options.includeSimulationFallback === false ? [] : [factory.createSimulationFallback()];
    this.#providers = Object.freeze(
      options.providers ? [...options.providers] : [...catalogProviders, ...simulation],
    );
  }

  listProviders(): readonly MarketReferenceProvider[] {
    return this.#providers;
  }

  async getQuote(assetId: string, nowUtc: UtcInstant): Promise<MarketReferenceResult<MarketReferenceQuote>> {
    const cacheKey = `quote:${assetId}`;
    const cached = this.#readCache<MarketReferenceQuote>(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.quote);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback((provider) => provider.getQuote(assetId, nowUtc), (value, providerId) => {
      this.#writeCache(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.quote, value, providerId);
    });
  }

  async getQuotes(assetIds: readonly string[], nowUtc: UtcInstant): Promise<MarketReferenceResult<readonly MarketReferenceQuote[]>> {
    const quotes: MarketReferenceQuote[] = [];
    let fromCache = true;
    let providerId: string | null = null;
    for (const assetId of assetIds) {
      const result = await this.getQuote(assetId, nowUtc);
      if (!result.ok) {
        return result;
      }
      if (!result.fromCache) {
        fromCache = false;
      }
      providerId = result.value.providerId;
      quotes.push(result.value);
    }
    return { ok: true, value: Object.freeze(quotes), fromCache, fallbackProviderId: providerId };
  }

  async getHistory(
    assetId: string,
    interval: HistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<MarketReferenceResult<readonly MarketHistoryCandle[]>> {
    const capability = historyCacheCapability(interval);
    const cacheKey = `history:${assetId}:${interval}:${range.from}:${range.to}`;
    const cached = this.#readCache<readonly MarketHistoryCandle[]>(cacheKey, capability);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.getHistory(assetId, interval, range, nowUtc),
      (value, providerId) => this.#writeCache(cacheKey, capability, value, providerId),
    );
  }

  async getCommodityPrice(commodity: CommodityCode, nowUtc: UtcInstant): Promise<MarketReferenceResult<CommodityPriceObservation>> {
    const cacheKey = `commodity:${commodity}`;
    const cached = this.#readCache<CommodityPriceObservation>(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.commodityDaily);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.getCommodityPrice(commodity, nowUtc),
      (value, providerId) => this.#writeCache(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.commodityDaily, value, providerId),
    );
  }

  async getCommodityHistory(
    commodity: CommodityCode,
    interval: HistoryInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<MarketReferenceResult<readonly MarketHistoryCandle[]>> {
    return this.#withFallback((provider) => provider.getCommodityHistory(commodity, interval, range, nowUtc));
  }

  async searchAssets(query: AssetSearchQuery, nowUtc: UtcInstant): Promise<MarketReferenceResult<readonly MarketReferenceAssetMetadata[]>> {
    const cacheKey = `search:${query.query}:${query.assetClass ?? ''}:${query.venueId ?? ''}:${query.limit ?? 20}`;
    const cached = this.#readCache<readonly MarketReferenceAssetMetadata[]>(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.assetMetadata);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.searchAssets(query, nowUtc),
      (value, providerId) => this.#writeCache(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.assetMetadata, value, providerId),
    );
  }

  async getAssetMetadata(assetId: string, nowUtc: UtcInstant): Promise<MarketReferenceResult<MarketReferenceAssetMetadata>> {
    const cacheKey = `asset:${assetId}`;
    const cached = this.#readCache<MarketReferenceAssetMetadata>(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.assetMetadata);
    if (cached) {
      return { ok: true, value: cached.value, fromCache: true, fallbackProviderId: cached.providerId };
    }
    return this.#withFallback(
      (provider) => provider.getAssetMetadata(assetId, nowUtc),
      (value, providerId) => this.#writeCache(cacheKey, MARKET_REFERENCE_CACHE_CAPABILITIES.assetMetadata, value, providerId),
    );
  }

  executionSeparationProof(): Readonly<Record<string, boolean>> {
    return Object.freeze({
      referenceOnly: true,
      mutatesExchangeOrderBook: false,
      mutatesLedger: false,
      issuesExecutionAuthority: false,
      mutatesMoonReyIssuance: false,
      agentCanTradeDirectly: false,
    });
  }

  #sortedProviders(): readonly MarketReferenceProvider[] {
    const order = { primary: 0, secondary: 1, fallback: 2 } as const;
    return Object.freeze([...this.#providers].sort((a, b) => order[a.priority] - order[b.priority]));
  }

  async #withFallback<T>(
    call: (provider: MarketReferenceProvider) => Promise<MarketReferenceResult<T>>,
    onSuccess?: (value: T, providerId: string) => void,
  ): Promise<MarketReferenceResult<T>> {
    const providers = this.#sortedProviders();
    let lastError: MarketReferenceResult<T> | null = null;
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
    return lastError ?? { ok: false, code: 'NO_PROVIDERS', message: 'no market reference providers configured', providerId: null };
  }

  #readCache<T>(key: string, capability: string): CacheEntry<T> | null {
    const policy = marketReferenceCachePolicy(capability);
    const entry = this.#memory.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAtMs) {
      this.#memory.delete(key);
      return null;
    }
  void policy;
    return entry;
  }

  #writeCache<T>(key: string, capability: string, value: T, providerId: string): void {
    const policy = marketReferenceCachePolicy(capability);
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

export function createMarketReferenceService(options: MarketReferenceServiceOptions = {}): MarketReferenceService {
  return new MarketReferenceService(options);
}

export function defaultMarketReferenceNow(): UtcInstant {
  return asUtcInstant('2026-08-21T09:00:00.000Z');
}
