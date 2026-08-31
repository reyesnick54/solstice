/**
 * In-memory cache with single-flight for Wave 3 blockchain intelligence.
 */

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAtMs: number;
  readonly staleAtMs: number;
};

export class BlockchainIntelligenceCache {
  readonly #store = new Map<string, CacheEntry<unknown>>();
  readonly #inFlight = new Map<string, unknown>();
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

  set<T>(key: string, value: T, ttlMs: number, staleAfterMs: number): void {
    const now = this.#nowMs();
    this.#store.set(
      key,
      Object.freeze({
        value,
        expiresAtMs: now + ttlMs,
        staleAtMs: now + staleAfterMs,
      }),
    );
  }

  singleFlight<T>(key: string, fn: () => T): T {
    if (this.#inFlight.has(key)) {
      return this.#inFlight.get(key) as T;
    }
    const value = fn();
    this.#inFlight.delete(key);
    return value;
  }

  clear(): void {
    this.#store.clear();
    this.#inFlight.clear();
  }
}
