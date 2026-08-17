export const PUBLIC_REQUEST_LIMITS = Object.freeze({
  maximumBodyBytes: 16_384,
  maximumBatchSize: 16,
  maximumPageSize: 100,
  requestTimeoutMs: 10_000,
  rateLimitPerMinute: 60,
});

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, { readonly resetAt: number; count: number }>();
  private readonly perMinute: number;

  constructor(perMinute = PUBLIC_REQUEST_LIMITS.rateLimitPerMinute) {
    this.perMinute = perMinute;
  }

  consume(key: string, nowMs: number): RateLimitDecision {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= nowMs) {
      this.buckets.set(key, { resetAt: nowMs + 60_000, count: 1 });
      return { allowed: true, remaining: this.perMinute - 1, retryAfterMs: 0 };
    }
    if (existing.count >= this.perMinute) {
      return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - nowMs };
    }
    existing.count += 1;
    return { allowed: true, remaining: this.perMinute - existing.count, retryAfterMs: 0 };
  }
}
