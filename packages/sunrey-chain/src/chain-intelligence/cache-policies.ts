/**
 * Capability-specific cache policies for external chain intelligence.
 */

import type { CachePolicy } from '../provider-runtime/data-delivery/types.ts';
import { DEFAULT_CACHE_POLICY } from '../provider-runtime/data-delivery/policies.ts';

export const CHAIN_INTELLIGENCE_CACHE_CAPABILITIES = Object.freeze({
  latestBlock: 'chain.intelligence.latest_block',
  confirmedBlock: 'chain.intelligence.confirmed_block',
  transactionUnconfirmed: 'chain.intelligence.transaction.unconfirmed',
  transactionConfirmed: 'chain.intelligence.transaction.confirmed',
  feeEstimate: 'chain.intelligence.fee_estimate',
  mempoolStatus: 'chain.intelligence.mempool',
  networkMetrics: 'chain.intelligence.network_metrics',
  networkMetadata: 'chain.intelligence.network_metadata',
  addressLookup: 'chain.intelligence.address_lookup',
});

const POLICIES: Readonly<Record<string, Partial<CachePolicy>>> = Object.freeze({
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.latestBlock]: {
    freshTtlMs: 30_000,
    staleWindowMs: 120_000,
    hardExpireMs: 300_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 16,
    maxRawPayloadBytes: 16_384,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.confirmedBlock]: {
    freshTtlMs: 3_600_000,
    staleWindowMs: 86_400_000,
    hardExpireMs: 604_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 128,
    maxRawPayloadBytes: 32_768,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.transactionUnconfirmed]: {
    freshTtlMs: 15_000,
    staleWindowMs: 60_000,
    hardExpireMs: 180_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 8,
    maxRawPayloadBytes: 8_192,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.transactionConfirmed]: {
    freshTtlMs: 3_600_000,
    staleWindowMs: 86_400_000,
    hardExpireMs: 604_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 64,
    maxRawPayloadBytes: 16_384,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.feeEstimate]: {
    freshTtlMs: 60_000,
    staleWindowMs: 180_000,
    hardExpireMs: 600_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 32,
    maxRawPayloadBytes: 4_096,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.mempoolStatus]: {
    freshTtlMs: 30_000,
    staleWindowMs: 120_000,
    hardExpireMs: 300_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 32,
    maxRawPayloadBytes: 8_192,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.networkMetrics]: {
    freshTtlMs: 300_000,
    staleWindowMs: 900_000,
    hardExpireMs: 3_600_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 48,
    maxRawPayloadBytes: 8_192,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.networkMetadata]: {
    freshTtlMs: 86_400_000,
    staleWindowMs: 604_800_000,
    hardExpireMs: 2_592_000_000,
    persistNormalized: true,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 8,
    maxRawPayloadBytes: 4_096,
  },
  [CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.addressLookup]: {
    freshTtlMs: 120_000,
    staleWindowMs: 600_000,
    hardExpireMs: 1_800_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 4,
    maxRawPayloadBytes: 4_096,
  },
});

export function chainIntelligenceCachePolicy(capability: string): CachePolicy {
  const override = POLICIES[capability];
  if (!override) {
    return DEFAULT_CACHE_POLICY;
  }
  return Object.freeze({ ...DEFAULT_CACHE_POLICY, ...override });
}

export function transactionCacheCapability(confirmationCount: number, minFinal: number): string {
  return confirmationCount >= minFinal
    ? CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.transactionConfirmed
    : CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.transactionUnconfirmed;
}

export function blockCacheCapability(confirmationStatus: string): string {
  return confirmationStatus === 'FINAL' || confirmationStatus === 'LIKELY_FINAL'
    ? CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.confirmedBlock
    : CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.latestBlock;
}
