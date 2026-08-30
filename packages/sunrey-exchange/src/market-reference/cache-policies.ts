/**
 * Capability-specific cache policies for market reference data.
 */

import type { CachePolicy } from '../../../sunrey-chain/src/provider-runtime/data-delivery/types.ts';
import { DEFAULT_CACHE_POLICY } from '../../../sunrey-chain/src/provider-runtime/data-delivery/policies.ts';

export const MARKET_REFERENCE_CACHE_CAPABILITIES = Object.freeze({
  quote: 'market.reference.quote',
  historyDaily: 'market.reference.history.daily',
  historyIntraday: 'market.reference.history.intraday',
  commodityDaily: 'market.reference.commodity.daily',
  assetMetadata: 'market.reference.asset_metadata',
});

const MARKET_REFERENCE_POLICIES: Readonly<Record<string, Partial<CachePolicy>>> = Object.freeze({
  [MARKET_REFERENCE_CACHE_CAPABILITIES.quote]: {
    freshTtlMs: 30_000,
    staleWindowMs: 120_000,
    hardExpireMs: 600_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 64,
    maxRawPayloadBytes: 8_192,
  },
  [MARKET_REFERENCE_CACHE_CAPABILITIES.historyDaily]: {
    freshTtlMs: 3_600_000,
    staleWindowMs: 86_400_000,
    hardExpireMs: 604_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 365,
    maxRawPayloadBytes: 32_768,
  },
  [MARKET_REFERENCE_CACHE_CAPABILITIES.historyIntraday]: {
    freshTtlMs: 300_000,
    staleWindowMs: 900_000,
    hardExpireMs: 3_600_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 96,
    maxRawPayloadBytes: 32_768,
  },
  [MARKET_REFERENCE_CACHE_CAPABILITIES.commodityDaily]: {
    freshTtlMs: 3_600_000,
    staleWindowMs: 86_400_000,
    hardExpireMs: 604_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 120,
    maxRawPayloadBytes: 16_384,
  },
  [MARKET_REFERENCE_CACHE_CAPABILITIES.assetMetadata]: {
    freshTtlMs: 86_400_000,
    staleWindowMs: 604_800_000,
    hardExpireMs: 2_592_000_000,
    persistNormalized: true,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 32,
    maxRawPayloadBytes: 16_384,
  },
});

export function marketReferenceCachePolicy(capability: string): CachePolicy {
  const override = MARKET_REFERENCE_POLICIES[capability];
  if (!override) {
    return DEFAULT_CACHE_POLICY;
  }
  return Object.freeze({ ...DEFAULT_CACHE_POLICY, ...override });
}

export function historyCacheCapability(interval: string): string {
  if (interval === '1d' || interval === '1w' || interval === '1mo') {
    return MARKET_REFERENCE_CACHE_CAPABILITIES.historyDaily;
  }
  return MARKET_REFERENCE_CACHE_CAPABILITIES.historyIntraday;
}
