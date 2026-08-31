/**
 * ACCESS Wave 2 Prompt 31 — access discovery cache policies.
 */

export const ACCESS_DISCOVERY_CACHE_TTLS = Object.freeze({
  gbfs_station_metadata: Object.freeze({ ttlMs: 3_600_000, staleMs: 7_200_000 }),
  gbfs_vehicle_availability: Object.freeze({ ttlMs: 30_000, staleMs: 90_000 }),
  nps_parks: Object.freeze({ ttlMs: 86_400_000, staleMs: 172_800_000 }),
  ridb_inventory: Object.freeze({ ttlMs: 3_600_000, staleMs: 7_200_000 }),
});

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAtMs: number;
  readonly staleAtMs: number;
};

export class AccessDiscoveryDataCache {
  readonly #store = new Map<string, CacheEntry<unknown>>();
  readonly #nowMs: () => number;

  constructor(nowMs: () => number = () => Date.now()) {
    this.#nowMs = nowMs;
  }

  get<T>(key: string): { readonly value: T; readonly stale: boolean } | undefined {
    const entry = this.#store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    const now = this.#nowMs();
    if (now > entry.expiresAtMs) {
      this.#store.delete(key);
      return undefined;
    }
    return Object.freeze({ value: entry.value, stale: now > entry.staleAtMs });
  }

  set<T>(key: string, value: T, policy: keyof typeof ACCESS_DISCOVERY_CACHE_TTLS): void {
    const ttl = ACCESS_DISCOVERY_CACHE_TTLS[policy];
    const now = this.#nowMs();
    this.#store.set(
      key,
      Object.freeze({
        value,
        expiresAtMs: now + ttl.staleMs,
        staleAtMs: now + ttl.ttlMs,
      }),
    );
  }

  clear(): void {
    this.#store.clear();
  }
}
