import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPlatformApi } from './app.ts';
import type { Authenticator } from './context.ts';
import { MemoryIdempotencyRepository } from './idempotency.ts';
import { MemoryRateLimitRepository } from './rate-limit.ts';

const silent = (): void => undefined;

async function request(
  url: string,
  init: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  } = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    ...(init.headers ? { headers: init.headers } : {}),
    ...(init.body !== undefined ? { body: init.body } : {}),
  });
  const text = await response.text();
  const body = text.length === 0 ? null : JSON.parse(text);
  return { status: response.status, headers: response.headers, body };
}

describe('platform API server', () => {
  it('boots, serves health/ready/version, then shuts down gracefully', async () => {
    const logs: string[] = [];
    const api = await createPlatformApi({
      config: { port: 0, featureFlags: { testRoutes: true } },
      logSink: (line) => logs.push(line),
    });
    try {
      const health = await request(`${api.url}/health`);
      assert.equal(health.status, 200);
      assert.equal((health.body as { ok: boolean }).ok, true);
      assert.equal((health.body as { productionReady: boolean }).productionReady, false);

      const ready = await request(`${api.url}/ready`);
      assert.equal(ready.status, 200);
      assert.equal((ready.body as { ready: boolean }).ready, true);
      assert.equal((ready.body as { productionReady: boolean }).productionReady, false);
      assert.equal((ready.body as { productionActive: boolean }).productionActive, false);

      const version = await request(`${api.url}/api/v1/version`);
      assert.equal(version.status, 200);
      assert.equal((version.body as { apiVersion: string }).apiVersion, 'v1');
      assert.equal((version.body as { PRODUCTION_ACTIVE: boolean }).PRODUCTION_ACTIVE, false);
      assert.equal(version.headers.get('x-sunrey-api-version'), 'v1');
      assert.ok(((version.body as { namespaces: string[] }).namespaces).includes('/api/v1/accounts'));
    } finally {
      await api.close();
    }
    assert.equal(logs.some((line) => line.includes('http_request')), true);
  });

  it('assigns request and correlation IDs and echoes safe incoming IDs', async () => {
    const api = await createPlatformApi({ config: { port: 0 }, logSink: silent });
    try {
      const generated = await request(`${api.url}/health`);
      assert.match(generated.headers.get('x-request-id') ?? '', /[A-Za-z0-9-]/);
      const echoed = await request(`${api.url}/health`, {
        headers: { 'x-request-id': 'client-req-123456', 'x-correlation-id': 'corr-abc-123456' },
      });
      assert.equal(echoed.headers.get('x-request-id'), 'client-req-123456');
      assert.equal(echoed.headers.get('x-correlation-id'), 'corr-abc-123456');
    } finally {
      await api.close();
    }
  });

  it('returns the canonical error envelope and rejects unknown versions', async () => {
    const api = await createPlatformApi({ config: { port: 0 }, logSink: silent });
    try {
      const missing = await request(`${api.url}/api/v1/does-not-exist`);
      assert.equal(missing.status, 404);
      const error = (missing.body as { error: { code: string; requestId: string; category: string } }).error;
      assert.equal(error.code, 'NOT_FOUND');
      assert.equal(error.category, 'NOT_FOUND');
      assert.ok(error.requestId.length > 0);

      const version = await request(`${api.url}/api/v2/version`);
      assert.equal(version.status, 404);
      assert.equal((version.body as { error: { code: string } }).error.code, 'UNKNOWN_API_VERSION');
    } finally {
      await api.close();
    }
  });

  it('validates mutation bodies before succeeding', async () => {
    const api = await createPlatformApi({ config: { port: 0, featureFlags: { testRoutes: true } }, logSink: silent });
    try {
      const invalid = await request(`${api.url}/api/v1/_test/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(invalid.status, 400);
      assert.equal((invalid.body as { error: { code: string } }).error.code, 'VALIDATION_FAILED');
      const valid = await request(`${api.url}/api/v1/_test/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'ok', count: 2 }),
      });
      assert.equal(valid.status, 200);
    } finally {
      await api.close();
    }
  });

  it('enforces idempotency replay and conflict on the HTTP path', async () => {
    const api = await createPlatformApi({
      config: { port: 0, featureFlags: { testRoutes: true } },
      idempotency: new MemoryIdempotencyRepository(),
      logSink: silent,
    });
    try {
      const headers = {
        'content-type': 'application/json',
        'idempotency-key': 'idem-http-1234',
      };
      const first = await request(`${api.url}/api/v1/_test/idempotent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ nonce: 'one' }),
      });
      assert.equal(first.status, 200);
      assert.equal(first.headers.get('x-sunrey-idempotency'), 'executed');
      const replay = await request(`${api.url}/api/v1/_test/idempotent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ nonce: 'one' }),
      });
      assert.equal(replay.status, 200);
      assert.equal(replay.headers.get('x-sunrey-idempotency'), 'replay');
      const conflict = await request(`${api.url}/api/v1/_test/idempotent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ nonce: 'two' }),
      });
      assert.equal(conflict.status, 409);
      assert.equal((conflict.body as { error: { code: string } }).error.code, 'IDEMPOTENCY_CONFLICT');
    } finally {
      await api.close();
    }
  });

  it('rate-limits repeated requests and applies CORS', async () => {
    const api = await createPlatformApi({
      config: {
        port: 0,
        rateLimitPerMinute: 2,
        allowedOrigins: ['https://app.sunrey.example'],
      },
      rateLimit: new MemoryRateLimitRepository(),
      logSink: silent,
    });
    try {
      const ok = await request(`${api.url}/health`, {
        headers: { origin: 'https://app.sunrey.example' },
      });
      assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.sunrey.example');
      await request(`${api.url}/health`);
      const limited = await request(`${api.url}/health`);
      assert.equal(limited.status, 429);
      assert.equal((limited.body as { error: { code: string } }).error.code, 'RATE_LIMITED');

      const denied = await request(`${api.url}/health`, {
        headers: { origin: 'https://evil.example' },
      });
      assert.equal(denied.status, 403);
    } finally {
      await api.close();
    }
  });

  it('does not trust client identity headers and keeps /me unauthenticated', async () => {
    const api = await createPlatformApi({ config: { port: 0 }, logSink: silent });
    try {
      const me = await request(`${api.url}/api/v1/me`, {
        headers: { 'x-user-id': 'attacker', authorization: 'Bearer anything' },
      });
      assert.equal(me.status, 401);
      assert.equal((me.body as { error: { code: string } }).error.code, 'AUTHENTICATION_REQUIRED');
    } finally {
      await api.close();
    }
  });

  it('returns /me only after a validated authenticator principal', async () => {
    const authenticator: Authenticator = {
      async authenticate() {
        return { userId: 'idn_1', sessionId: 'ses_1', deviceId: 'dev_1' };
      },
    };
    const api = await createPlatformApi({ config: { port: 0 }, authenticator, logSink: silent });
    try {
      const me = await request(`${api.url}/api/v1/me`);
      assert.equal(me.status, 200);
      assert.equal((me.body as { userId: string; source: string }).userId, 'idn_1');
      assert.equal((me.body as { source: string }).source, 'validated_session');
    } finally {
      await api.close();
    }
  });

  it('readiness fails when a required persistence probe is down', async () => {
    const api = await createPlatformApi({
      config: {
        port: 0,
        databaseConfigured: true,
        featureFlags: { requirePersistenceForReady: true },
      },
      persistenceProbe: async () => false,
      logSink: silent,
    });
    try {
      const ready = await request(`${api.url}/ready`);
      assert.equal(ready.status, 503);
      assert.equal((ready.body as { ready: boolean }).ready, false);
      assert.equal((ready.body as { productionReady: boolean }).productionReady, false);
      const health = await request(`${api.url}/health`);
      assert.equal(health.status, 200);
    } finally {
      await api.close();
    }
  });

  it('rejects startup when production-tier configuration is invalid', async () => {
    await assert.rejects(
      () =>
        createPlatformApi({
          config: {
            deploymentTier: 'production',
            allowedOrigins: ['*'],
            allowWildcardCors: true,
            idempotencyBackend: 'injected',
          },
        }),
    );
  });
});
