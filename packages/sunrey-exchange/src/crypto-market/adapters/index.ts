/**
 * Fixture-backed crypto market reference adapters.
 *
 * Uses ProviderTransport simulation pattern. No live HTTP in simulation.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { resolveCryptoAsset, searchRegisteredCryptoAssets } from '../assets.ts';
import type { CryptoMarketReferenceProvider } from '../provider.ts';
import type {
  CryptoAssetSearchQuery,
  CryptoHistoryInterval,
  CryptoMarketCapability,
  CryptoMarketReferenceQuote,
  CryptoMarketReferenceResult,
} from '../types.ts';
import { buildFixtureHistory, buildFixtureMetadata, normalizeFixtureQuote } from './normalize.ts';

type AdapterConfig = {
  readonly providerId: string;
  readonly precedence: number;
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly capabilities: readonly CryptoMarketCapability[];
  readonly blocked?: boolean;
  readonly simulateTimeout?: boolean;
  readonly simulateRateLimit?: boolean;
  readonly circuitOpen?: boolean;
  readonly stale?: boolean;
};

function fail<T>(code: string, message: string, providerId: string): CryptoMarketReferenceResult<T> {
  return Object.freeze({ ok: false, code, message, providerId });
}

export function createFixtureCryptoMarketAdapter(config: AdapterConfig): CryptoMarketReferenceProvider {
  const getQuote = async (assetId: string, nowUtc: UtcInstant): Promise<CryptoMarketReferenceResult<CryptoMarketReferenceQuote>> => {
    if (config.blocked) return fail('PROVIDER_BLOCKED', `provider ${config.providerId} is blocked`, config.providerId);
    if (config.circuitOpen) return fail('CIRCUIT_OPEN', `circuit open for ${config.providerId}`, config.providerId);
    if (config.simulateTimeout) return fail('PROVIDER_TIMEOUT', `provider ${config.providerId} timed out`, config.providerId);
    if (config.simulateRateLimit) return fail('RATE_LIMITED', `provider ${config.providerId} rate limited`, config.providerId);
    if (!resolveCryptoAsset(assetId)) {
      return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, config.providerId);
    }
    const normalized = normalizeFixtureQuote(config.providerId, assetId, nowUtc);
    if (!normalized.ok) {
      const validation = normalized.validation;
      if (!validation.ok) {
        return fail(validation.code, validation.message, config.providerId);
      }
      return fail('VALIDATION_FAILED', 'quote validation failed', config.providerId);
    }
    const quote = config.stale
      ? Object.freeze({ ...normalized.quote, freshness: Object.freeze({ status: 'stale' as const, ageMs: 180_000n, assessedAt: nowUtc }) })
      : normalized.quote;
    return Object.freeze({ ok: true, value: quote, fromCache: false, fallbackProviderId: null });
  };

  const supportsCapability = (capability: CryptoMarketCapability): boolean =>
    (config.capabilities as readonly string[]).includes(capability);

  const provider: CryptoMarketReferenceProvider = {
    providerId: config.providerId,
    capabilities: Object.freeze([...config.capabilities]),
    priority: config.priority,
    productionAuthorized: false as const,
    liveProviderConnected: false as const,
    blocked: config.blocked ?? false,

    health(nowUtc: UtcInstant) {
      return Object.freeze({
        providerId: config.providerId,
        status: config.circuitOpen || config.blocked ? 'unavailable' : config.simulateRateLimit ? 'degraded' : 'healthy',
        circuitState: config.circuitOpen ? 'OPEN' : 'CLOSED',
        rateLimited: config.simulateRateLimit ?? false,
        lastSuccessAt: config.circuitOpen || config.blocked ? null : nowUtc,
        message: config.blocked ? 'provider blocked pending review' : config.simulateRateLimit ? 'rate limited' : null,
        blocked: config.blocked ?? false,
      });
    },

    supportsCapability,

    getQuote,

    async getQuotes(assetIds: readonly string[], nowUtc: UtcInstant) {
      const quotes = [];
      for (const assetId of assetIds) {
        const result = await getQuote(assetId, nowUtc);
        if (!result.ok) return result;
        quotes.push(result.value);
      }
      return Object.freeze({ ok: true, value: Object.freeze(quotes), fromCache: false, fallbackProviderId: null });
    },

    async getHistory(
      assetId: string,
      interval: CryptoHistoryInterval,
      range: { readonly from: UtcInstant; readonly to: UtcInstant },
      nowUtc: UtcInstant,
    ) {
      if (config.blocked) return fail('PROVIDER_BLOCKED', `provider ${config.providerId} is blocked`, config.providerId);
      const asset = resolveCryptoAsset(assetId);
      if (!asset) return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, config.providerId);
      if (!supportsCapability('crypto_market_history')) {
        return fail('CAPABILITY_UNSUPPORTED', 'historical data not supported', config.providerId);
      }
      return Object.freeze({
        ok: true,
        value: buildFixtureHistory(asset, config.providerId, interval, range.from, range.to, nowUtc),
        fromCache: false,
        fallbackProviderId: null,
      });
    },

    async searchAssets(query: CryptoAssetSearchQuery, nowUtc: UtcInstant) {
      const assets = searchRegisteredCryptoAssets(query.query, query.limit ?? 20);
      return Object.freeze({
        ok: true,
        value: Object.freeze(assets.map((asset) => buildFixtureMetadata(asset, config.providerId, nowUtc))),
        fromCache: false,
        fallbackProviderId: null,
      });
    },

    async getAssetMetadata(assetId: string, nowUtc: UtcInstant) {
      const asset = resolveCryptoAsset(assetId);
      if (!asset) return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, config.providerId);
      return Object.freeze({
        ok: true,
        value: buildFixtureMetadata(asset, config.providerId, nowUtc),
        fromCache: false,
        fallbackProviderId: null,
      });
    },
  };

  return Object.freeze(provider);
}

export const COINGECKO_ADAPTER = createFixtureCryptoMarketAdapter({
  providerId: 'coingecko',
  precedence: 10,
  priority: 'primary',
  capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history', 'crypto_metadata'],
});

export const COINCAP_ADAPTER = createFixtureCryptoMarketAdapter({
  providerId: 'coincap',
  precedence: 20,
  priority: 'secondary',
  capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history'],
});

export const COINPAPRIKA_ADAPTER = createFixtureCryptoMarketAdapter({
  providerId: 'coinpaprika',
  precedence: 30,
  priority: 'secondary',
  capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history', 'crypto_metadata'],
});

export const COINLORE_ADAPTER = createFixtureCryptoMarketAdapter({
  providerId: 'coinlore',
  precedence: 40,
  priority: 'fallback',
  capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap'],
});

export const CRYPTOCOMPARE_ADAPTER = createFixtureCryptoMarketAdapter({
  providerId: 'cryptocompare',
  precedence: 25,
  priority: 'secondary',
  capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_history', 'crypto_exchange_reference'],
});

export const COINMARKETCAP_ADAPTER = createFixtureCryptoMarketAdapter({
  providerId: 'coinmarketcap',
  precedence: 99,
  priority: 'fallback',
  capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_metadata'],
  blocked: true,
});

export const ALL_CRYPTO_MARKET_ADAPTERS: readonly CryptoMarketReferenceProvider[] = Object.freeze([
  COINGECKO_ADAPTER,
  COINCAP_ADAPTER,
  COINPAPRIKA_ADAPTER,
  CRYPTOCOMPARE_ADAPTER,
  COINLORE_ADAPTER,
]);

export function createFailingCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 90,
    priority: 'fallback',
    capabilities: ['crypto_prices'],
    simulateTimeout: true,
  });
}

export function createRateLimitedCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 91,
    priority: 'fallback',
    capabilities: ['crypto_prices'],
    simulateRateLimit: true,
  });
}

export function createCircuitOpenCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 92,
    priority: 'fallback',
    capabilities: ['crypto_prices'],
    circuitOpen: true,
  });
}

export function createStaleCryptoAdapter(providerId: string): CryptoMarketReferenceProvider {
  return createFixtureCryptoMarketAdapter({
    providerId,
    precedence: 93,
    priority: 'primary',
    capabilities: ['crypto_prices', 'crypto_market_data'],
    stale: true,
  });
}
