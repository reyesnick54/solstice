/**
 * Per-provider / per-source rate limits.
 *
 * Operational control only. Does not affect blockchain consensus.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { ProductionOracleRejection } from './types.ts';
import type { ConnectorClock } from './runtime-types.ts';

export type RateLimitPolicy = {
  readonly requestsPerInterval: number;
  readonly intervalMs: number;
  readonly burst: number;
  readonly cooldownMs: number;
};

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = Object.freeze({
  requestsPerInterval: 4,
  intervalMs: 1_000,
  burst: 2,
  cooldownMs: 250,
});

type Bucket = {
  tokens: number;
  lastRefillMs: bigint;
  cooldownUntilMs: bigint;
};

export class ConnectorRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly policy: RateLimitPolicy;
  private readonly clock: ConnectorClock;

  constructor(policy: RateLimitPolicy, clock: ConnectorClock) {
    this.policy = policy;
    this.clock = clock;
  }

  acquire(providerId: string, sourceId: string, retryAfterMs?: number): Result<true, ProductionOracleRejection> {
    const key = `${providerId}:${sourceId}`;
    const now = this.clock.nowMs();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.policy.burst + this.policy.requestsPerInterval,
      lastRefillMs: now,
      cooldownUntilMs: 0n,
    };
    if (now < bucket.cooldownUntilMs) {
      this.buckets.set(key, bucket);
      return err({ code: 'RATE_LIMITED', detail: `source ${sourceId} is in cooldown` });
    }
    const elapsed = Number(now - bucket.lastRefillMs);
    if (elapsed >= this.policy.intervalMs) {
      const intervals = Math.floor(elapsed / this.policy.intervalMs);
      bucket.tokens = Math.min(
        this.policy.burst + this.policy.requestsPerInterval,
        bucket.tokens + intervals * this.policy.requestsPerInterval,
      );
      bucket.lastRefillMs = now;
    }
    if (bucket.tokens <= 0) {
      bucket.cooldownUntilMs = now + BigInt(retryAfterMs ?? this.policy.cooldownMs);
      this.buckets.set(key, bucket);
      return err({ code: 'RATE_LIMITED', detail: `source ${sourceId} exceeded requests per interval` });
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return ok(true);
  }

  applyRetryAfter(providerId: string, sourceId: string, retryAfterSeconds: number): void {
    const key = `${providerId}:${sourceId}`;
    const now = this.clock.nowMs();
    const current = this.buckets.get(key);
    const cooldownUntilMs = now + BigInt(Math.max(0, retryAfterSeconds) * 1_000);
    this.buckets.set(key, {
      tokens: current?.tokens ?? 0,
      lastRefillMs: current?.lastRefillMs ?? now,
      cooldownUntilMs,
    });
  }
}
