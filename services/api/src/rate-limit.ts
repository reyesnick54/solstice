import { PlatformApiError } from './errors.ts';
import type { SqlClient } from './idempotency.ts';

export const RATE_LIMIT_DIMENSIONS = ['ip', 'user', 'session', 'device', 'client', 'endpointClass'] as const;
export type RateLimitDimension = (typeof RATE_LIMIT_DIMENSIONS)[number];

export type RateLimitPolicy = {
  readonly name: string;
  readonly dimensions: readonly RateLimitDimension[];
  readonly perMinute: number;
};

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
  readonly dimension: RateLimitDimension;
  readonly key: string;
};

export type RateLimitRepository = {
  readonly kind: 'postgres' | 'memory' | 'injected';
  consume(input: {
    readonly key: string;
    readonly perMinute: number;
    readonly nowMs: number;
  }): Promise<RateLimitDecision>;
};

export type RateLimitKeys = {
  readonly ip?: string;
  readonly user?: string;
  readonly session?: string;
  readonly device?: string;
  readonly client?: string;
  readonly endpointClass: string;
};

export class MemoryRateLimitRepository implements RateLimitRepository {
  readonly kind = 'memory' as const;
  private readonly buckets = new Map<string, { resetAt: number; count: number }>();

  async consume(input: {
    readonly key: string;
    readonly perMinute: number;
    readonly nowMs: number;
  }): Promise<RateLimitDecision> {
    const existing = this.buckets.get(input.key);
    if (!existing || existing.resetAt <= input.nowMs) {
      this.buckets.set(input.key, { resetAt: input.nowMs + 60_000, count: 1 });
      return {
        allowed: true,
        remaining: input.perMinute - 1,
        retryAfterMs: 0,
        dimension: dimensionFromKey(input.key),
        key: input.key,
      };
    }
    if (existing.count >= input.perMinute) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: existing.resetAt - input.nowMs,
        dimension: dimensionFromKey(input.key),
        key: input.key,
      };
    }
    existing.count += 1;
    return {
      allowed: true,
      remaining: input.perMinute - existing.count,
      retryAfterMs: 0,
      dimension: dimensionFromKey(input.key),
      key: input.key,
    };
  }
}

const UPSERT_SQL = `
INSERT INTO platform_api.rate_limit_bucket (bucket_key, window_start, count, expires_at)
VALUES ($1, $2::timestamptz, 1, $3::timestamptz)
ON CONFLICT (bucket_key) DO UPDATE SET
  count = CASE
    WHEN platform_api.rate_limit_bucket.expires_at <= EXCLUDED.window_start THEN 1
    ELSE platform_api.rate_limit_bucket.count + 1
  END,
  window_start = CASE
    WHEN platform_api.rate_limit_bucket.expires_at <= EXCLUDED.window_start THEN EXCLUDED.window_start
    ELSE platform_api.rate_limit_bucket.window_start
  END,
  expires_at = CASE
    WHEN platform_api.rate_limit_bucket.expires_at <= EXCLUDED.window_start THEN EXCLUDED.expires_at
    ELSE platform_api.rate_limit_bucket.expires_at
  END
RETURNING count, expires_at
`.trim();

type RateRow = {
  readonly count: number;
  readonly expires_at: string;
};

export class PostgresRateLimitRepository implements RateLimitRepository {
  readonly kind = 'postgres' as const;
  private readonly sql: SqlClient;

  constructor(sql: SqlClient) {
    this.sql = sql;
  }

  async consume(input: {
    readonly key: string;
    readonly perMinute: number;
    readonly nowMs: number;
  }): Promise<RateLimitDecision> {
    const nowIso = new Date(input.nowMs).toISOString();
    const expiresIso = new Date(input.nowMs + 60_000).toISOString();
    const result = await this.sql.query<RateRow>(UPSERT_SQL, [input.key, nowIso, expiresIso]);
    const row = result.rows[0];
    const count = row?.count ?? 1;
    const expiresAt = row ? Date.parse(row.expires_at) : input.nowMs + 60_000;
    if (count > input.perMinute) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, expiresAt - input.nowMs),
        dimension: dimensionFromKey(input.key),
        key: input.key,
      };
    }
    return {
      allowed: true,
      remaining: input.perMinute - count,
      retryAfterMs: 0,
      dimension: dimensionFromKey(input.key),
      key: input.key,
    };
  }
}

export const RATE_LIMIT_SQL = Object.freeze({
  upsert: UPSERT_SQL,
});

function dimensionFromKey(key: string): RateLimitDimension {
  const prefix = key.split(':')[0];
  if (prefix && (RATE_LIMIT_DIMENSIONS as readonly string[]).includes(prefix)) {
    return prefix as RateLimitDimension;
  }
  return 'endpointClass';
}

export function defaultPolicies(perMinute: number): readonly RateLimitPolicy[] {
  return Object.freeze([
    Object.freeze({ name: 'default', dimensions: ['ip', 'endpointClass'] as const, perMinute }),
    Object.freeze({ name: 'authenticated', dimensions: ['user'] as const, perMinute: perMinute * 2 }),
  ]);
}

export function policyForEndpoint(endpointClass: string, perMinute: number): RateLimitPolicy {
  if (endpointClass === 'sensitive') {
    return Object.freeze({
      name: 'sensitive',
      dimensions: ['ip', 'user', 'session', 'device', 'client', 'endpointClass'] as const,
      perMinute: Math.max(5, Math.floor(perMinute / 4)),
    });
  }
  return Object.freeze({
    name: 'standard',
    dimensions: ['ip', 'endpointClass'] as const,
    perMinute,
  });
}

export async function enforceRateLimit(input: {
  readonly repository: RateLimitRepository;
  readonly policy: RateLimitPolicy;
  readonly keys: RateLimitKeys;
  readonly nowMs: number;
}): Promise<RateLimitDecision> {
  let tightest: RateLimitDecision = {
    allowed: true,
    remaining: input.policy.perMinute,
    retryAfterMs: 0,
    dimension: 'endpointClass',
    key: `endpointClass:${input.keys.endpointClass}`,
  };
  for (const dimension of input.policy.dimensions) {
    const value = input.keys[dimension];
    if (!value) {
      continue;
    }
    const decision = await input.repository.consume({
      key: `${dimension}:${value}`,
      perMinute: input.policy.perMinute,
      nowMs: input.nowMs,
    });
    if (!decision.allowed) {
      throw new PlatformApiError({
        code: 'RATE_LIMITED',
        message: 'rate limit exceeded',
        category: 'RATE_LIMIT',
        retryable: true,
        httpStatus: 429,
        metadata: {
          retryAfterMs: String(decision.retryAfterMs),
          dimension: decision.dimension,
        },
      });
    }
    if (decision.remaining < tightest.remaining) {
      tightest = decision;
    }
  }
  return tightest;
}
