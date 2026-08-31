/**
 * Travel intelligence cache with capability-specific TTLs.
 */

import { TRAVEL_CAPABILITIES } from './types.ts';

export const TRAVEL_CACHE_TTLS = Object.freeze({
  [TRAVEL_CAPABILITIES.AIRCRAFT_POSITION]: Object.freeze({ ttlMs: 15_000, staleMs: 45_000 }),
  [TRAVEL_CAPABILITIES.AIRPORT_INFORMATION]: Object.freeze({ ttlMs: 86_400_000, staleMs: 172_800_000 }),
  [TRAVEL_CAPABILITIES.ENTRY_REQUIREMENTS]: Object.freeze({ ttlMs: 3_600_000, staleMs: 7_200_000 }),
  [TRAVEL_CAPABILITIES.TRANSIT_DEPARTURE]: Object.freeze({ ttlMs: 30_000, staleMs: 90_000 }),
  [TRAVEL_CAPABILITIES.TRANSIT_ROUTE]: Object.freeze({ ttlMs: 3_600_000, staleMs: 7_200_000 }),
  [TRAVEL_CAPABILITIES.EV_CHARGING]: Object.freeze({ ttlMs: 1_800_000, staleMs: 3_600_000 }),
  [TRAVEL_CAPABILITIES.FLIGHT_REFERENCE]: Object.freeze({ ttlMs: 300_000, staleMs: 600_000 }),
  [TRAVEL_CAPABILITIES.AIRCRAFT_REGISTRY]: Object.freeze({ ttlMs: 86_400_000, staleMs: 172_800_000 }),
  [TRAVEL_CAPABILITIES.PUBLIC_TRANSIT]: Object.freeze({ ttlMs: 300_000, staleMs: 600_000 }),
  [TRAVEL_CAPABILITIES.MOBILITY_STATUS]: Object.freeze({ ttlMs: 60_000, staleMs: 180_000 }),
});

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAtMs: number;
  readonly staleAtMs: number;
};

export class TravelIntelligenceCache {
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

  set<T>(key: string, value: T, capability: string): void {
    const policy = TRAVEL_CACHE_TTLS[capability as keyof typeof TRAVEL_CACHE_TTLS] ?? {
      ttlMs: 300_000,
      staleMs: 600_000,
    };
    const now = this.#nowMs();
    this.#store.set(
      key,
      Object.freeze({
        value,
        expiresAtMs: now + policy.ttlMs,
        staleAtMs: now + policy.staleMs,
      }),
    );
  }

  clear(): void {
    this.#store.clear();
  }
}
