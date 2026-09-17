import { createHash } from 'node:crypto';
import type { GrokResearchResult } from './types.ts';

export type PublicResearchCacheEntry = {
  readonly cacheKey: string;
  readonly result: GrokResearchResult;
  readonly cachedAt: string;
  readonly expiresAt: string;
  readonly customerScoped: false;
};

export class PublicResearchCache {
  private readonly entries = new Map<string, PublicResearchCacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 3600_000) {
    this.ttlMs = ttlMs;
  }

  cacheKey(question: string, publicContext: Readonly<Record<string, unknown>>): string {
    const normalized = JSON.stringify({ question, publicContext });
    return createHash('sha256').update(normalized).digest('hex');
  }

  get(key: string, nowMs: number): GrokResearchResult | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.parse(entry.expiresAt) <= nowMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.result;
  }

  put(input: {
    readonly key: string;
    readonly result: GrokResearchResult;
    readonly nowMs: number;
    readonly allowCustomerScoped?: boolean;
  }): void {
    if (input.result.privacyClass !== 'PUBLIC') {
      return;
    }
    if (!input.allowCustomerScoped && input.result.narrativeSummary?.includes('PRIVATE')) {
      return;
    }
    const cachedAt = new Date(input.nowMs).toISOString();
    const expiresAt = new Date(input.nowMs + this.ttlMs).toISOString();
    this.entries.set(input.key, Object.freeze({
      cacheKey: input.key,
      result: input.result,
      cachedAt,
      expiresAt,
      customerScoped: false,
    }));
  }

  hasCustomerPrivateEntry(customerId: string): boolean {
    for (const entry of this.entries.values()) {
      if (entry.result.customerId === customerId && entry.result.privacyClass !== 'PUBLIC') {
        return true;
      }
    }
    return false;
  }

  snapshot(): readonly PublicResearchCacheEntry[] {
    return Object.freeze([...this.entries.values()]);
  }
}
