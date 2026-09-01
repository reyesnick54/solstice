/**
 * In-memory response cache for opportunity HTTP adapters.
 */

import type { ProviderExecutionProvenance } from '../../certification/types.ts';
import { deriveExecutionProvenance } from '../../certification/types.ts';
import { opportunityCachePolicy, OPPORTUNITY_CACHE_CAPABILITIES } from '../cache-policies.ts';

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAtMs: number;
  readonly retrievedAtUtc: string;
};

const store = new Map<string, CacheEntry<unknown>>();

export function readOpportunityHttpCache<T>(key: string): {
  readonly value: T;
  readonly retrievedAtUtc: string;
} | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAtMs) {
    store.delete(key);
    return null;
  }
  return Object.freeze({ value: entry.value, retrievedAtUtc: entry.retrievedAtUtc });
}

export function writeOpportunityHttpCache<T>(
  key: string,
  value: T,
  capability: keyof typeof OPPORTUNITY_CACHE_CAPABILITIES,
  retrievedAtUtc: string,
): void {
  const policy = opportunityCachePolicy(OPPORTUNITY_CACHE_CAPABILITIES[capability]);
  store.set(key, {
    value,
    expiresAtMs: Date.now() + policy.ttlMs,
    retrievedAtUtc,
  });
}

export function cacheProvenance(retrievedAtUtc: string): ProviderExecutionProvenance {
  return deriveExecutionProvenance({
    simulated: false,
    liveNetworkCallObserved: false,
    productionEndpointUsed: false,
    fromCache: true,
    httpStatus: null,
    latencyMs: null,
  });
}

export function clearOpportunityHttpCache(): void {
  store.clear();
}
