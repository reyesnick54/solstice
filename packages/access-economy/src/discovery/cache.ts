/**
 * ACCESS Wave 2 Prompt 31 — discovery cache with capability-specific TTLs.
 */

export const ACCESS_DISCOVERY_CACHE_POLICIES = Object.freeze({
  station_metadata: Object.freeze({ ttlMs: 3_600_000, staleMs: 7_200_000 }),
  vehicle_availability: Object.freeze({ ttlMs: 30_000, staleMs: 90_000 }),
  events: Object.freeze({ ttlMs: 1_800_000, staleMs: 3_600_000 }),
  parks: Object.freeze({ ttlMs: 86_400_000, staleMs: 172_800_000 }),
  charger_locations: Object.freeze({ ttlMs: 1_800_000, staleMs: 3_600_000 }),
  transit_departures: Object.freeze({ ttlMs: 30_000, staleMs: 90_000 }),
  recreation_inventory: Object.freeze({ ttlMs: 3_600_000, staleMs: 7_200_000 }),
  search_results: Object.freeze({ ttlMs: 60_000, staleMs: 180_000 }),
});

export type DiscoveryCachePolicy = keyof typeof ACCESS_DISCOVERY_CACHE_POLICIES;

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAtMs: number;
  readonly staleAtMs: number;
};

export class AccessDiscoveryCache {
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

  set<T>(key: string, value: T, policy: DiscoveryCachePolicy): void {
    const ttl = ACCESS_DISCOVERY_CACHE_POLICIES[policy];
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
