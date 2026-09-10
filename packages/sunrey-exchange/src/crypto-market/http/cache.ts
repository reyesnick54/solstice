/**
 * In-memory response cache for crypto market HTTP adapters.
 */

import type { UtcInstant } from '@solstice/domain';
import { CRYPTO_MARKET_CACHE_CAPABILITIES, cryptoMarketCachePolicy } from '../cache-policies.ts';

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAtMs: number;
  readonly retrievedAtUtc: UtcInstant;
};

const store = new Map<string, CacheEntry<unknown>>();

export function readCryptoMarketHttpCache<T>(key: string): {
  readonly value: T;
  readonly retrievedAtUtc: UtcInstant;
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

export function writeCryptoMarketHttpCache<T>(
  key: string,
  value: T,
  capability: string,
  retrievedAtUtc: UtcInstant,
): void {
  const policy = cryptoMarketCachePolicy(capability);
  store.set(key, {
    value,
    expiresAtMs: Date.now() + policy.freshTtlMs,
    retrievedAtUtc,
  });
}

export function clearCryptoMarketHttpCache(): void {
  store.clear();
}

export { CRYPTO_MARKET_CACHE_CAPABILITIES };
