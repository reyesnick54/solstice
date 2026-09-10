/**
 * Fixture-backed crypto market reference adapters for simulation and test scenarios.
 */

import { resolveCryptoAsset, searchRegisteredCryptoAssets } from '../assets.ts';
import type { CryptoMarketReferenceProvider } from '../provider.ts';
import type {
  CryptoAssetSearchQuery,
  CryptoHistoryInterval,
  CryptoMarketCapability,
  CryptoMarketReferenceResult,
} from '../types.ts';
import type { UtcInstant } from '@solstice/domain';
import { buildFixtureHistory, buildFixtureMetadata, normalizeFixtureQuote } from './normalize.ts';

export type FixtureAdapterConfig = {
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

export function createFixtureCryptoMarketAdapter(config: FixtureAdapterConfig): CryptoMarketReferenceProvider {
  return Object.freeze({
    providerId: config.providerId,
    capabilities: Object.freeze([...config.capabilities]),
    priority: config.priority,
    productionAuthorized: false as const,
    liveCapable: false as const,
    liveProviderConnected: false as const,
    blocked: config.blocked ?? false,

    health(nowUtc) {
      void nowUtc;
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

    supportsCapability(capability) {
      return (config.capabilities as readonly string[]).includes(capability);
    },

    async getQuote(assetId, nowUtc) {
      if (config.blocked) return fail('PROVIDER_BLOCKED', `provider ${config.providerId} is blocked`, config.providerId);
      if (config.circuitOpen) return fail('CIRCUIT_OPEN', `circuit open for ${config.providerId}`, config.providerId);
      if (config.simulateTimeout) return fail('PROVIDER_TIMEOUT', `provider ${config.providerId} timed out`, config.providerId);
      if (config.simulateRateLimit) return fail('RATE_LIMITED', `provider ${config.providerId} rate limited`, config.providerId);
      if (!resolveCryptoAsset(assetId)) {
        return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, config.providerId);
      }
      const normalized = normalizeFixtureQuote(config.providerId, assetId, nowUtc);
      if (!normalized.ok) {
        return fail(normalized.validation.code, normalized.validation.message, config.providerId);
      }
      const quote = config.stale
        ? Object.freeze({ ...normalized.quote, freshness: Object.freeze({ status: 'stale' as const, ageMs: 180_000n, assessedAt: nowUtc }) })
        : normalized.quote;
      return Object.freeze({ ok: true, value: quote, fromCache: false, fallbackProviderId: null });
    },

    async getQuotes(assetIds, nowUtc) {
      const quotes = [];
      for (const assetId of assetIds) {
        const result = await this.getQuote(assetId, nowUtc);
        if (!result.ok) return result;
        quotes.push(result.value);
      }
      return Object.freeze({ ok: true, value: Object.freeze(quotes), fromCache: false, fallbackProviderId: null });
    },

    async getHistory(assetId, interval, range, nowUtc) {
      if (config.blocked) return fail('PROVIDER_BLOCKED', `provider ${config.providerId} is blocked`, config.providerId);
      const asset = resolveCryptoAsset(assetId);
      if (!asset) return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, config.providerId);
      if (!this.supportsCapability('crypto_market_history')) {
        return fail('CAPABILITY_UNSUPPORTED', 'historical data not supported', config.providerId);
      }
      return Object.freeze({
        ok: true,
        value: buildFixtureHistory(asset, config.providerId, interval, range.from, range.to, nowUtc),
        fromCache: false,
        fallbackProviderId: null,
      });
    },

    async searchAssets(query, nowUtc) {
      void nowUtc;
      const assets = searchRegisteredCryptoAssets(query.query, query.limit ?? 20);
      return Object.freeze({
        ok: true,
        value: Object.freeze(assets.map((asset) => buildFixtureMetadata(asset, config.providerId, nowUtc))),
        fromCache: false,
        fallbackProviderId: null,
      });
    },

    async getAssetMetadata(assetId, nowUtc) {
      const asset = resolveCryptoAsset(assetId);
      if (!asset) return fail('UNKNOWN_ASSET', `unknown asset ${assetId}`, config.providerId);
      return Object.freeze({
        ok: true,
        value: buildFixtureMetadata(asset, config.providerId, nowUtc),
        fromCache: false,
        fallbackProviderId: null,
      });
    },
  });
}
