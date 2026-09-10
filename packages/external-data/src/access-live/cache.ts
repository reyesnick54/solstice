/**
 * Bounded in-process TTL cache for live provider responses.
 */

export type CacheEntry<T> = {
  readonly value: T;
  readonly retrievedAt: string;
  readonly expiresAtMs: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function readLiveProviderCache<T>(key: string): CacheEntry<T> | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAtMs) {
    store.delete(key);
    return null;
  }
  return entry as CacheEntry<T>;
}

export function writeLiveProviderCache<T>(key: string, value: T, ttlSeconds: number, retrievedAt: string): void {
  store.set(
    key,
    Object.freeze({
      value,
      retrievedAt,
      expiresAtMs: Date.now() + ttlSeconds * 1000,
    }),
  );
}

export function clearLiveProviderCache(): void {
  store.clear();
}

export function cacheAgeSeconds(retrievedAt: string, nowMs = Date.now()): number {
  const retrievedMs = Date.parse(retrievedAt);
  if (!Number.isFinite(retrievedMs)) return 0;
  return Math.max(0, Math.floor((nowMs - retrievedMs) / 1000));
}
