import { createHash } from 'node:crypto';

import { PlatformApiError } from './errors.ts';

export type IdempotencyState = 'IN_PROGRESS' | 'COMPLETED';

export type IdempotencyRecord = {
  readonly scopeKey: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly state: IdempotencyState;
  readonly statusCode: number | null;
  readonly responseBody: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
};

export type BeginIdempotencyResult =
  | { readonly outcome: 'EXECUTE' }
  | { readonly outcome: 'REPLAY'; readonly record: IdempotencyRecord }
  | { readonly outcome: 'IN_PROGRESS' };

export type IdempotencyRepository = {
  readonly kind: 'postgres' | 'memory' | 'injected';
  readonly productionIntended: boolean;
  begin(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly fingerprint: string;
    readonly nowIso: string;
    readonly expiresAt: string;
  }): Promise<BeginIdempotencyResult>;
  complete(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly fingerprint: string;
    readonly statusCode: number;
    readonly responseBody: string;
    readonly nowIso: string;
  }): Promise<void>;
};

export type SqlClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[] }>;
};

export function requestFingerprint(input: {
  readonly method: string;
  readonly path: string;
  readonly body: string;
}): string {
  return createHash('sha256')
    .update(`${input.method.toUpperCase()}\n${input.path}\n${input.body}`)
    .digest('hex');
}

export function identityScopeKey(input: {
  readonly userId: string | null;
  readonly clientId: string | null;
  readonly ip: string | null;
  readonly route: string;
}): string {
  const identity = input.userId ?? `anon:${input.clientId ?? 'none'}:${input.ip ?? 'unknown'}`;
  return `${identity}:${input.route}`;
}

export function requireIdempotencyKey(header: string | undefined): string {
  const key = header?.trim() ?? '';
  if (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new PlatformApiError({
      code: 'VALIDATION_FAILED',
      message: 'Idempotency-Key is required and must be 8-128 URL-safe characters',
      category: 'VALIDATION',
      retryable: false,
      httpStatus: 400,
      fieldErrors: [{ field: 'header.idempotency-key', code: 'REQUIRED', message: 'valid Idempotency-Key required' }],
    });
  }
  return key;
}

/**
 * In-process store for tests and local composition only.
 * Not the intended production implementation.
 */
export class MemoryIdempotencyRepository implements IdempotencyRepository {
  readonly kind = 'memory' as const;
  readonly productionIntended = false;
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly now: () => string;

  constructor(now: () => string = () => new Date().toISOString()) {
    this.now = now;
  }

  private id(scopeKey: string, idempotencyKey: string): string {
    return `${scopeKey}\0${idempotencyKey}`;
  }

  async begin(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly fingerprint: string;
    readonly nowIso: string;
    readonly expiresAt: string;
  }): Promise<BeginIdempotencyResult> {
    const key = this.id(input.scopeKey, input.idempotencyKey);
    const existing = this.records.get(key);
    if (existing && existing.expiresAt > input.nowIso) {
      if (existing.fingerprint !== input.fingerprint) {
        throw new PlatformApiError({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'idempotency key reused with a different request fingerprint',
          category: 'CONFLICT',
          retryable: false,
          httpStatus: 409,
        });
      }
      if (existing.state === 'COMPLETED' && existing.responseBody !== null && existing.statusCode !== null) {
        return { outcome: 'REPLAY', record: existing };
      }
      return { outcome: 'IN_PROGRESS' };
    }
    this.records.set(
      key,
      Object.freeze({
        scopeKey: input.scopeKey,
        idempotencyKey: input.idempotencyKey,
        fingerprint: input.fingerprint,
        state: 'IN_PROGRESS',
        statusCode: null,
        responseBody: null,
        createdAt: input.nowIso,
        expiresAt: input.expiresAt,
      }),
    );
    return { outcome: 'EXECUTE' };
  }

  async complete(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly fingerprint: string;
    readonly statusCode: number;
    readonly responseBody: string;
    readonly nowIso: string;
  }): Promise<void> {
    const key = this.id(input.scopeKey, input.idempotencyKey);
    const existing = this.records.get(key);
    if (!existing) {
      return;
    }
    this.records.set(
      key,
      Object.freeze({
        ...existing,
        fingerprint: input.fingerprint,
        state: 'COMPLETED',
        statusCode: input.statusCode,
        responseBody: input.responseBody,
      }),
    );
    void this.now;
  }
}

const BEGIN_SQL = `
INSERT INTO platform_api.idempotency_record (
  scope_key, idempotency_key, fingerprint, state, status_code, response_body, created_at, expires_at
) VALUES ($1, $2, $3, 'IN_PROGRESS', NULL, NULL, $4::timestamptz, $5::timestamptz)
ON CONFLICT (scope_key, idempotency_key) DO NOTHING
RETURNING scope_key, idempotency_key, fingerprint, state, status_code, response_body, created_at, expires_at
`.trim();

const SELECT_SQL = `
SELECT scope_key, idempotency_key, fingerprint, state, status_code, response_body, created_at, expires_at
FROM platform_api.idempotency_record
WHERE scope_key = $1 AND idempotency_key = $2
`.trim();

const COMPLETE_SQL = `
UPDATE platform_api.idempotency_record
SET state = 'COMPLETED', status_code = $4, response_body = $5
WHERE scope_key = $1 AND idempotency_key = $2 AND fingerprint = $3
`.trim();

const EXPIRE_SQL = `
DELETE FROM platform_api.idempotency_record
WHERE scope_key = $1 AND idempotency_key = $2 AND expires_at <= $3::timestamptz
`.trim();

type IdempotencyRow = {
  readonly scope_key: string;
  readonly idempotency_key: string;
  readonly fingerprint: string;
  readonly state: IdempotencyState;
  readonly status_code: number | null;
  readonly response_body: string | null;
  readonly created_at: string;
  readonly expires_at: string;
};

function rowToRecord(row: IdempotencyRow): IdempotencyRecord {
  return Object.freeze({
    scopeKey: row.scope_key,
    idempotencyKey: row.idempotency_key,
    fingerprint: row.fingerprint,
    state: row.state,
    statusCode: row.status_code,
    responseBody: row.response_body,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  });
}

/**
 * PostgreSQL-backed idempotency store. This is the intended production
 * implementation. It uses insert-if-absent for concurrency safety.
 */
export class PostgresIdempotencyRepository implements IdempotencyRepository {
  readonly kind = 'postgres' as const;
  readonly productionIntended = true;
  private readonly sql: SqlClient;

  constructor(sql: SqlClient) {
    this.sql = sql;
  }

  async begin(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly fingerprint: string;
    readonly nowIso: string;
    readonly expiresAt: string;
  }): Promise<BeginIdempotencyResult> {
    await this.sql.query(EXPIRE_SQL, [input.scopeKey, input.idempotencyKey, input.nowIso]);
    const inserted = await this.sql.query<IdempotencyRow>(BEGIN_SQL, [
      input.scopeKey,
      input.idempotencyKey,
      input.fingerprint,
      input.nowIso,
      input.expiresAt,
    ]);
    if (inserted.rows[0]) {
      return { outcome: 'EXECUTE' };
    }
    const existing = await this.sql.query<IdempotencyRow>(SELECT_SQL, [input.scopeKey, input.idempotencyKey]);
    const row = existing.rows[0];
    if (!row) {
      return { outcome: 'EXECUTE' };
    }
    if (row.fingerprint !== input.fingerprint) {
      throw new PlatformApiError({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'idempotency key reused with a different request fingerprint',
        category: 'CONFLICT',
        retryable: false,
        httpStatus: 409,
      });
    }
    if (row.state === 'COMPLETED' && row.response_body !== null && row.status_code !== null) {
      return { outcome: 'REPLAY', record: rowToRecord(row) };
    }
    return { outcome: 'IN_PROGRESS' };
  }

  async complete(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly fingerprint: string;
    readonly statusCode: number;
    readonly responseBody: string;
    readonly nowIso: string;
  }): Promise<void> {
    await this.sql.query(COMPLETE_SQL, [
      input.scopeKey,
      input.idempotencyKey,
      input.fingerprint,
      input.statusCode,
      input.responseBody,
    ]);
    void input.nowIso;
  }
}

export const IDEMPOTENCY_SQL = Object.freeze({
  begin: BEGIN_SQL,
  select: SELECT_SQL,
  complete: COMPLETE_SQL,
  expire: EXPIRE_SQL,
});
