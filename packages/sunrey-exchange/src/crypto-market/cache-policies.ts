/**
 * Capability-specific cache policies for crypto market reference data.
 */

import type { CachePolicy } from '../../../sunrey-chain/src/provider-runtime/data-delivery/types.ts';
import { DEFAULT_CACHE_POLICY } from '../../../sunrey-chain/src/provider-runtime/data-delivery/policies.ts';
import type { CryptoHistoryInterval } from './types.ts';

export const CRYPTO_MARKET_CACHE_CAPABILITIES = Object.freeze({
  spotQuote: 'crypto.market.spot_quote',
  marketCap: 'crypto.market.market_cap',
  assetMetadata: 'crypto.market.asset_metadata',
  historyDaily: 'crypto.market.history.daily',
  historyIntraday: 'crypto.market.history.intraday',
  globalStats: 'crypto.market.global_stats',
});

const CRYPTO_MARKET_POLICIES: Readonly<Record<string, Partial<CachePolicy>>> = Object.freeze({
  [CRYPTO_MARKET_CACHE_CAPABILITIES.spotQuote]: {
    freshTtlMs: 30_000,
    staleWindowMs: 120_000,
    hardExpireMs: 300_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 128,
    maxRawPayloadBytes: 8_192,
  },
  [CRYPTO_MARKET_CACHE_CAPABILITIES.marketCap]: {
    freshTtlMs: 60_000,
    staleWindowMs: 300_000,
    hardExpireMs: 900_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 64,
    maxRawPayloadBytes: 8_192,
  },
  [CRYPTO_MARKET_CACHE_CAPABILITIES.assetMetadata]: {
    freshTtlMs: 86_400_000,
    staleWindowMs: 604_800_000,
    hardExpireMs: 2_592_000_000,
    persistNormalized: true,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 32,
    maxRawPayloadBytes: 16_384,
  },
  [CRYPTO_MARKET_CACHE_CAPABILITIES.historyDaily]: {
    freshTtlMs: 3_600_000,
    staleWindowMs: 86_400_000,
    hardExpireMs: 604_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 365,
    maxRawPayloadBytes: 32_768,
  },
  [CRYPTO_MARKET_CACHE_CAPABILITIES.historyIntraday]: {
    freshTtlMs: 300_000,
    staleWindowMs: 900_000,
    hardExpireMs: 3_600_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 96,
    maxRawPayloadBytes: 32_768,
  },
  [CRYPTO_MARKET_CACHE_CAPABILITIES.globalStats]: {
    freshTtlMs: 120_000,
    staleWindowMs: 600_000,
    hardExpireMs: 1_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 32,
    maxRawPayloadBytes: 4_096,
  },
});

export function cryptoMarketCachePolicy(capability: string): CachePolicy {
  const override = CRYPTO_MARKET_POLICIES[capability];
  if (!override) {
    return DEFAULT_CACHE_POLICY;
  }
  return Object.freeze({ ...DEFAULT_CACHE_POLICY, ...override });
}

export function cryptoHistoryCacheCapability(interval: CryptoHistoryInterval): string {
  if (interval === '1d' || interval === '4h') {
    return CRYPTO_MARKET_CACHE_CAPABILITIES.historyDaily;
  }
  return CRYPTO_MARKET_CACHE_CAPABILITIES.historyIntraday;
}

/** Key assets for limited scheduled refresh (configurable, not hard-coded symbols in service). */
export const KEY_CRYPTO_ASSET_IDS = Object.freeze([
  'CRYPTO:BTC:bitcoin:native:USD',
  'CRYPTO:ETH:ethereum:native:USD',
  'CRYPTO:SOL:solana:native:USD',
]);
