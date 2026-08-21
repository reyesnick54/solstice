import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PlatformApiError } from './errors.ts';
import {
  IDEMPOTENCY_SQL,
  MemoryIdempotencyRepository,
  PostgresIdempotencyRepository,
  requestFingerprint,
  type SqlClient,
} from './idempotency.ts';

describe('idempotency foundation', () => {
  it('replays a completed request and conflicts on fingerprint mismatch', async () => {
    const store = new MemoryIdempotencyRepository();
    const fingerprint = requestFingerprint({ method: 'POST', path: '/api/v1/_test/idempotent', body: '{"nonce":"a"}' });
    const first = await store.begin({
      scopeKey: 'user:u1:/api/v1/_test/idempotent',
      idempotencyKey: 'idem-1234',
      fingerprint,
      nowIso: '2026-08-21T10:00:00.000Z',
      expiresAt: '2026-08-22T10:00:00.000Z',
    });
    assert.equal(first.outcome, 'EXECUTE');
    await store.complete({
      scopeKey: 'user:u1:/api/v1/_test/idempotent',
      idempotencyKey: 'idem-1234',
      fingerprint,
      statusCode: 200,
      responseBody: '{"accepted":true}',
      nowIso: '2026-08-21T10:00:01.000Z',
    });
    const replay = await store.begin({
      scopeKey: 'user:u1:/api/v1/_test/idempotent',
      idempotencyKey: 'idem-1234',
      fingerprint,
      nowIso: '2026-08-21T10:00:02.000Z',
      expiresAt: '2026-08-22T10:00:00.000Z',
    });
    assert.equal(replay.outcome, 'REPLAY');
    if (replay.outcome === 'REPLAY') {
      assert.equal(replay.record.responseBody, '{"accepted":true}');
    }
    await assert.rejects(
      () =>
        store.begin({
          scopeKey: 'user:u1:/api/v1/_test/idempotent',
          idempotencyKey: 'idem-1234',
          fingerprint: requestFingerprint({ method: 'POST', path: '/api/v1/_test/idempotent', body: '{"nonce":"b"}' }),
          nowIso: '2026-08-21T10:00:03.000Z',
          expiresAt: '2026-08-22T10:00:00.000Z',
        }),
      (error: unknown) => error instanceof PlatformApiError && error.code === 'IDEMPOTENCY_CONFLICT',
    );
  });

  it('detects in-progress concurrency on the same key', async () => {
    const store = new MemoryIdempotencyRepository();
    const fingerprint = requestFingerprint({ method: 'POST', path: '/x', body: '{}' });
    await store.begin({
      scopeKey: 'anon',
      idempotencyKey: 'idem-conc-1',
      fingerprint,
      nowIso: '2026-08-21T10:00:00.000Z',
      expiresAt: '2026-08-22T10:00:00.000Z',
    });
    const second = await store.begin({
      scopeKey: 'anon',
      idempotencyKey: 'idem-conc-1',
      fingerprint,
      nowIso: '2026-08-21T10:00:01.000Z',
      expiresAt: '2026-08-22T10:00:00.000Z',
    });
    assert.equal(second.outcome, 'IN_PROGRESS');
  });

  it('PostgreSQL adapter uses insert-if-absent and reports conflicts', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const sql: SqlClient = {
      async query<T extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ) {
        if (text === IDEMPOTENCY_SQL.expire) {
          const key = `${values[0]}\0${values[1]}`;
          const existing = rows.get(key);
          if (existing && String(existing.expires_at) <= String(values[2])) {
            rows.delete(key);
          }
          return { rows: [] };
        }
        if (text === IDEMPOTENCY_SQL.begin) {
          const key = `${values[0]}\0${values[1]}`;
          if (rows.has(key)) {
            return { rows: [] };
          }
          const row = {
            scope_key: values[0],
            idempotency_key: values[1],
            fingerprint: values[2],
            state: 'IN_PROGRESS',
            status_code: null,
            response_body: null,
            created_at: values[3],
            expires_at: values[4],
          };
          rows.set(key, row);
          return { rows: [row as unknown as T] };
        }
        if (text === IDEMPOTENCY_SQL.select) {
          const existing = rows.get(`${values[0]}\0${values[1]}`);
          return { rows: existing ? [existing as T] : [] };
        }
        if (text === IDEMPOTENCY_SQL.complete) {
          const existing = rows.get(`${values[0]}\0${values[1]}`);
          if (existing) {
            existing.state = 'COMPLETED';
            existing.status_code = values[3];
            existing.response_body = values[4];
          }
          return { rows: [] };
        }
        throw new Error(`unexpected SQL: ${text}`);
      },
    };
    const store = new PostgresIdempotencyRepository(sql);
    const fingerprint = 'abc';
    const first = await store.begin({
      scopeKey: 's',
      idempotencyKey: 'k-12345678',
      fingerprint,
      nowIso: '2026-08-21T10:00:00.000Z',
      expiresAt: '2026-08-22T10:00:00.000Z',
    });
    assert.equal(first.outcome, 'EXECUTE');
    assert.equal(store.productionIntended, true);
    await store.complete({
      scopeKey: 's',
      idempotencyKey: 'k-12345678',
      fingerprint,
      statusCode: 200,
      responseBody: '{"ok":true}',
      nowIso: '2026-08-21T10:00:01.000Z',
    });
    const replay = await store.begin({
      scopeKey: 's',
      idempotencyKey: 'k-12345678',
      fingerprint,
      nowIso: '2026-08-21T10:00:02.000Z',
      expiresAt: '2026-08-22T10:00:00.000Z',
    });
    assert.equal(replay.outcome, 'REPLAY');
  });
});
