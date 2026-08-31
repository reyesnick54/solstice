/**
 * Health reference observation cache with TTL policies.
 */

import { cacheTtlFor } from './cache-policies.ts';

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAt: number;
  readonly capability: string;
};

export class HealthReferenceCache {
  readonly #store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): { readonly value: T; readonly stale: boolean } | null {
    const entry = this.#store.get(key);
    if (!entry) return null;
    const stale = Date.now() > entry.expiresAt;
    return { value: entry.value as T, stale };
  }

  set<T>(key: string, value: T, capability: string): void {
    const ttlMs = cacheTtlFor(capability) * 1000;
    this.#store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      capability,
    });
  }

  clear(): void {
    this.#store.clear();
  }

  size(): number {
    return this.#store.size;
  }
}
