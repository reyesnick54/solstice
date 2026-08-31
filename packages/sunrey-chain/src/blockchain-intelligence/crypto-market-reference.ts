/**
 * Crypto market reference observations from catalog providers.
 */

import type { CoinGeckoFixture } from './adapters/fixture-adapters.ts';
import { BlockchainIntelligenceCache } from './cache.ts';
import { BLOCKCHAIN_QUERY_LIMITS } from './limits.ts';
import type { CryptoMarketQuote, ProviderHealthSnapshot, ProviderObservationEnvelope } from './types.ts';

export type CryptoMarketReferenceServiceOptions = {
  readonly primary: CoinGeckoFixture;
  readonly cache?: BlockchainIntelligenceCache;
};

export class CryptoMarketReferenceService {
  readonly #primary: CoinGeckoFixture;
  readonly #cache: BlockchainIntelligenceCache;

  constructor(options: CryptoMarketReferenceServiceOptions) {
    this.#primary = options.primary;
    this.#cache = options.cache ?? new BlockchainIntelligenceCache();
  }

  providerHealth(): readonly ProviderHealthSnapshot[] {
    return Object.freeze([this.#primary.health()]);
  }

  marketQuotes(): readonly ProviderObservationEnvelope<CryptoMarketQuote>[] {
    const key = 'crypto:market_quotes';
    const cached = this.#cache.get<readonly ProviderObservationEnvelope<CryptoMarketQuote>[]>(key);
    if (cached && !cached.stale) return cached.value;

    return this.#cache.singleFlight(key, () => {
      if (!this.#primary.health().healthy) {
        if (cached) return cached.value;
        throw new Error('crypto_market_primary_unavailable');
      }
      const quotes = this.#primary.getMarketQuotes();
      this.#cache.set(key, quotes, BLOCKCHAIN_QUERY_LIMITS.cacheTtlMs, BLOCKCHAIN_QUERY_LIMITS.staleTtlMs);
      return quotes;
    });
  }
}
