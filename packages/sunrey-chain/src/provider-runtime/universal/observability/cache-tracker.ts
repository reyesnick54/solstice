/**
 * In-memory cache freshness tracker for provider observations.
 */

import type { ProviderCacheFreshness } from './types.ts';

export type CacheEntry = {
  readonly providerId: string;
  readonly key: string;
  readonly valueDigest: string;
  readonly refreshedAtUtc: string;
  readonly staleAfterMs: number;
};

export class ProviderCacheTracker {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #defaultStaleAfterMs: number;

  constructor(defaultStaleAfterMs = 86_400_000) {
    this.#defaultStaleAfterMs = defaultStaleAfterMs;
  }

  put(input: {
    readonly providerId: string;
    readonly key: string;
    readonly valueDigest: string;
    readonly refreshedAtUtc: string;
    readonly staleAfterMs?: number;
  }): CacheEntry {
    const entry = Object.freeze({
      providerId: input.providerId,
      key: input.key,
      valueDigest: input.valueDigest,
      refreshedAtUtc: input.refreshedAtUtc,
      staleAfterMs: input.staleAfterMs ?? this.#defaultStaleAfterMs,
    });
    this.#entries.set(this.#key(input.providerId, input.key), entry);
    return entry;
  }

  get(providerId: string, key: string, nowUtc: string): ProviderCacheFreshness {
    const entry = this.#entries.get(this.#key(providerId, key));
    if (!entry) {
      return Object.freeze({
        lastRefreshedAt: null,
        staleAfterMs: this.#defaultStaleAfterMs,
        isStale: true,
        cacheState: 'none' as const,
      });
    }
    const ageMs = Date.parse(nowUtc) - Date.parse(entry.refreshedAtUtc);
    const isStale = !Number.isFinite(ageMs) || ageMs > entry.staleAfterMs;
    return Object.freeze({
      lastRefreshedAt: entry.refreshedAtUtc,
      staleAfterMs: entry.staleAfterMs,
      isStale,
      cacheState: isStale ? ('stale_served' as const) : ('hit' as const),
    });
  }

  invalidate(providerId: string, key?: string): void {
    if (key === undefined) {
      for (const mapKey of [...this.#entries.keys()]) {
        if (mapKey.startsWith(`${providerId}:`)) {
          this.#entries.delete(mapKey);
        }
      }
      return;
    }
    this.#entries.delete(this.#key(providerId, key));
  }

  miss(providerId: string): ProviderCacheFreshness {
    return Object.freeze({
      lastRefreshedAt: null,
      staleAfterMs: this.#defaultStaleAfterMs,
      isStale: true,
      cacheState: 'miss' as const,
    });
  }

  #key(providerId: string, key: string): string {
    return `${providerId}:${key}`;
  }
}
