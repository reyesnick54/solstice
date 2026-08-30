/**
 * Capability-specific cache policies. No single global TTL.
 */

import type { CachePolicy, RawPayloadRetention } from './types.ts';
import { RAW_RETENTION_TTL_MS } from './types.ts';

export const DEFAULT_CACHE_POLICY: CachePolicy = Object.freeze({
  freshTtlMs: 300_000,
  staleWindowMs: 600_000,
  hardExpireMs: 3_600_000,
  persistNormalized: false,
  rawPayloadRetention: 'none',
  maxHistoryEntries: 32,
  maxRawPayloadBytes: 16_384,
});

const POLICY_BY_CAPABILITY_PREFIX: Readonly<Record<string, Partial<CachePolicy>>> = Object.freeze({
  'fx.reference': {
    freshTtlMs: 30_000,
    staleWindowMs: 60_000,
    hardExpireMs: 300_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 96,
    maxRawPayloadBytes: 8_192,
  },
  'weather.current': {
    freshTtlMs: 300_000,
    staleWindowMs: 900_000,
    hardExpireMs: 3_600_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 24,
    maxRawPayloadBytes: 16_384,
  },
  'weather.forecast': {
    freshTtlMs: 600_000,
    staleWindowMs: 1_800_000,
    hardExpireMs: 7_200_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 12,
    maxRawPayloadBytes: 32_768,
  },
  'aviation.position': {
    freshTtlMs: 15_000,
    staleWindowMs: 60_000,
    hardExpireMs: 300_000,
    persistNormalized: false,
    rawPayloadRetention: 'none',
    maxHistoryEntries: 8,
    maxRawPayloadBytes: 8_192,
  },
  'macro.gdp': {
    freshTtlMs: 86_400_000,
    staleWindowMs: 172_800_000,
    hardExpireMs: 604_800_000,
    persistNormalized: true,
    rawPayloadRetention: 'audit_required',
    maxHistoryEntries: 120,
    maxRawPayloadBytes: 16_384,
  },
  'macro.indicator.monthly': {
    freshTtlMs: 2_592_000_000,
    staleWindowMs: 5_184_000_000,
    hardExpireMs: 10_368_000_000,
    persistNormalized: true,
    rawPayloadRetention: 'audit_required',
    maxHistoryEntries: 60,
    maxRawPayloadBytes: 16_384,
  },
  'energy.price': {
    freshTtlMs: 300_000,
    staleWindowMs: 600_000,
    hardExpireMs: 3_600_000,
    persistNormalized: true,
    rawPayloadRetention: 'short_term',
    maxHistoryEntries: 48,
    maxRawPayloadBytes: 16_384,
  },
});

export function resolveCachePolicy(capability: string): CachePolicy {
  const exact = POLICY_BY_CAPABILITY_PREFIX[capability];
  if (exact) {
    return Object.freeze({ ...DEFAULT_CACHE_POLICY, ...exact });
  }
  const prefix = Object.keys(POLICY_BY_CAPABILITY_PREFIX).find((key) => capability.startsWith(`${key}.`));
  if (prefix) {
    return Object.freeze({ ...DEFAULT_CACHE_POLICY, ...POLICY_BY_CAPABILITY_PREFIX[prefix] });
  }
  return DEFAULT_CACHE_POLICY;
}

export function rawPayloadAllowed(retention: RawPayloadRetention): boolean {
  return retention !== 'none';
}

export function rawPayloadExpired(
  retention: RawPayloadRetention,
  persistedAtUtc: string,
  nowMs: number,
): boolean {
  const ttl = RAW_RETENTION_TTL_MS[retention];
  if (ttl === null) {
    return false;
  }
  if (ttl === 0) {
    return true;
  }
  return nowMs - Date.parse(persistedAtUtc) > ttl;
}
