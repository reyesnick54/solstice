import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PlatformApiError } from './errors.ts';
import type { SqlClient } from './idempotency.ts';
import {
  enforceRateLimit,
  MemoryRateLimitRepository,
  policyForEndpoint,
  PostgresRateLimitRepository,
  RATE_LIMIT_SQL,
} from './rate-limit.ts';

describe('rate limit middleware', () => {
  it('allows traffic under the policy and then 429s', async () => {
    const repository = new MemoryRateLimitRepository();
    const policy = policyForEndpoint('public', 2);
    await enforceRateLimit({
      repository,
      policy,
      keys: { ip: '1.1.1.1', endpointClass: 'public' },
      nowMs: 1_000,
    });
    await enforceRateLimit({
      repository,
      policy,
      keys: { ip: '1.1.1.1', endpointClass: 'public' },
      nowMs: 1_100,
    });
    await assert.rejects(
      () =>
        enforceRateLimit({
          repository,
          policy,
          keys: { ip: '1.1.1.1', endpointClass: 'public' },
          nowMs: 1_200,
        }),
      (error: unknown) => error instanceof PlatformApiError && error.code === 'RATE_LIMITED',
    );
  });

  it('applies a tighter policy to sensitive endpoints', () => {
    const sensitive = policyForEndpoint('sensitive', 60);
    const standard = policyForEndpoint('public', 60);
    assert.equal(sensitive.perMinute < standard.perMinute, true);
    assert.equal(sensitive.dimensions.includes('user'), true);
    assert.equal(sensitive.dimensions.includes('device'), true);
  });

  it('PostgreSQL adapter increments a durable bucket', async () => {
    let count = 0;
    const sql: SqlClient = {
      async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string) {
        assert.equal(text, RATE_LIMIT_SQL.upsert);
        count += 1;
        return { rows: [{ count, expires_at: new Date(2_000).toISOString() } as unknown as T] };
      },
    };
    const repository = new PostgresRateLimitRepository(sql);
    const first = await repository.consume({ key: 'ip:2.2.2.2', perMinute: 2, nowMs: 1_000 });
    assert.equal(first.allowed, true);
    const second = await repository.consume({ key: 'ip:2.2.2.2', perMinute: 2, nowMs: 1_100 });
    assert.equal(second.allowed, true);
    const third = await repository.consume({ key: 'ip:2.2.2.2', perMinute: 2, nowMs: 1_200 });
    assert.equal(third.allowed, false);
  });
});
