import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';

import { InMemorySecretProvider, secretRef } from '../../security/src/secrets.ts';
import {
  SecretBackedProviderAuthResolver,
  createFetchProviderTransport,
  createProviderTransportConfig,
  createRedactionCatalog,
  headersAreSafeToLog,
  redactHeaderRecord,
  redactUrlForLog,
  type FetchLike,
  type ProviderAuthStrategy,
  type HttpProviderRequestContext,
} from './index.ts';

const PROVIDER_ID = 'fixture.provider';
const SERVICE_VERSION = '0.1.0-test';

function baseConfig(overrides?: {
  readonly baseUrl?: string;
  readonly allowHttp?: boolean;
  readonly allowLoopbackInTest?: boolean;
  readonly environment?: 'development' | 'test' | 'preview' | 'production';
}) {
  return createProviderTransportConfig({
    serviceVersion: SERVICE_VERSION,
    environment: overrides?.environment ?? 'test',
    endpoint: {
      providerId: PROVIDER_ID,
      baseUrl: overrides?.baseUrl ?? 'https://api.fixture-provider.test',
      allowHttp: overrides?.allowHttp,
      allowLoopbackInTest: overrides?.allowLoopbackInTest,
    },
  });
}

function secrets() {
  return new InMemorySecretProvider('fixture', {
    'api-key': 'super-secret-api-key-value',
    'bearer-token': 'super-secret-bearer-token-value',
    username: 'fixture-user',
    password: 'fixture-password-value',
  });
}

function resolver(secretProvider = secrets()) {
  return new SecretBackedProviderAuthResolver({ secrets: secretProvider });
}

function transport(
  authStrategy: ProviderAuthStrategy,
  fetchFn: FetchLike,
  config = baseConfig(),
) {
  return createFetchProviderTransport({
    config,
    authResolver: resolver(),
    authStrategy,
    fetchFn,
  });
}

function request(overrides?: Partial<HttpProviderRequestContext>): HttpProviderRequestContext {
  return {
    providerId: PROVIDER_ID,
    requestId: 'req-001',
    method: 'GET',
    path: '/v1/resource',
    ...overrides,
  };
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
): FetchLike {
  return (input, init) => Promise.resolve(handler(String(input), init));
}

describe('provider-sdk transport', () => {
  it('1. performs a no-auth request', async () => {
    const observed: Array<{ url: string; headers: Record<string, string> }> = [];
    const client = transport(
      { kind: 'none' },
      mockFetch((url, init) => {
        observed.push({
          url,
          headers: Object.fromEntries(
            Object.entries(init?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]),
          ),
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const result = await client.request(request());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.value.parsed, { ok: true });
      assert.equal(result.value.metadata.httpStatus, 200);
    }
    assert.equal(observed.length, 1);
    assert.equal(observed[0]?.url, 'https://api.fixture-provider.test/v1/resource');
    assert.match(observed[0]?.headers['user-agent'] ?? '', /^SunRey\//);
  });

  it('2. injects API-key header auth', async () => {
    let authHeader = '';
    const client = transport(
      {
        kind: 'api_key_header',
        headerName: 'X-API-Key',
        secretRef: secretRef('fixture', 'api-key'),
      },
      mockFetch((_url, init) => {
        authHeader = String((init?.headers as Record<string, string>)['x-api-key'] ?? '');
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    const result = await client.request(request());
    assert.equal(result.ok, true);
    assert.equal(authHeader, 'super-secret-api-key-value');
  });

  it('3. injects API-key query auth', async () => {
    let observedUrl = '';
    const client = transport(
      {
        kind: 'api_key_query',
        paramName: 'api_key',
        secretRef: secretRef('fixture', 'api-key'),
      },
      mockFetch((url) => {
        observedUrl = url;
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    const result = await client.request(request());
    assert.equal(result.ok, true);
    assert.match(observedUrl, /api_key=super-secret-api-key-value/);
  });

  it('4. injects bearer token auth', async () => {
    let authorization = '';
    const client = transport(
      {
        kind: 'bearer',
        secretRef: secretRef('fixture', 'bearer-token'),
      },
      mockFetch((_url, init) => {
        authorization = String((init?.headers as Record<string, string>).authorization ?? '');
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    const result = await client.request(request());
    assert.equal(result.ok, true);
    assert.equal(authorization, 'Bearer super-secret-bearer-token-value');
  });

  it('5. injects basic auth', async () => {
    let authorization = '';
    const client = transport(
      {
        kind: 'basic',
        usernameRef: secretRef('fixture', 'username'),
        passwordRef: secretRef('fixture', 'password'),
      },
      mockFetch((_url, init) => {
        authorization = String((init?.headers as Record<string, string>).authorization ?? '');
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    const result = await client.request(request());
    assert.equal(result.ok, true);
  const expected = `Basic ${Buffer.from('fixture-user:fixture-password-value').toString('base64')}`;
    assert.equal(authorization, expected);
  });

  it('6. redacts secrets from logs', () => {
    const catalog = createRedactionCatalog();
    const fakeBearer = `Bearer ${'x'.repeat(24)}`;
    const fakeApiKey = `k${'y'.repeat(24)}`;
    const headers = redactHeaderRecord(
      {
        Authorization: fakeBearer,
        'X-API-Key': fakeApiKey,
        Accept: 'application/json',
      },
      catalog,
    );
    assert.equal(headers.Authorization, '[REDACTED]');
    assert.equal(headers['X-API-Key'], '[REDACTED]');
    assert.equal(headers.Accept, 'application/json');
    assert.equal(
      redactUrlForLog('https://api.example.test/path?api_key=super-secret-api-key-value&page=1', catalog),
      'https://api.example.test/path?api_key=%5BREDACTED%5D&page=1',
    );
    assert.equal(headersAreSafeToLog(headers, catalog), true);
  });

  it('7. requires HTTPS for public provider endpoints', () => {
    assert.throws(
      () =>
        createProviderTransportConfig({
          serviceVersion: SERVICE_VERSION,
          environment: 'production',
          endpoint: {
            providerId: PROVIDER_ID,
            baseUrl: 'http://api.fixture-provider.test',
            allowHttp: true,
          },
        }),
      /HTTP is not permitted for production/,
    );
  });

  it('8. rejects localhost destinations', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch(() => new Response('{}', { status: 200 })),
      baseConfig({ baseUrl: 'https://127.0.0.1:443' }),
    );
    const result = await client.request(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderSecurityError');
      assert.match(result.error.message, /loopback|forbidden/i);
    }
  });

  it('9. rejects metadata endpoint destinations', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch(() => new Response('{}', { status: 200 })),
      baseConfig({ baseUrl: 'https://169.254.169.254' }),
    );
    const result = await client.request(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderSecurityError');
      assert.match(result.error.message, /metadata|link-local|forbidden/i);
    }
  });

  it('10. validates redirect targets against SSRF policy', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch(() =>
        Response.redirect('http://127.0.0.1/evil', 302),
      ),
    );
    const result = await client.request(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderSecurityError');
      assert.match(result.error.message, /hostname|forbidden|redirect/i);
    }
  });

  it('11. rejects oversized responses', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch(() => new Response('x'.repeat(100), { status: 200, headers: { 'content-type': 'text/plain' } })),
      createProviderTransportConfig({
        serviceVersion: SERVICE_VERSION,
        environment: 'test',
        endpoint: {
          providerId: PROVIDER_ID,
          baseUrl: 'https://api.fixture-provider.test',
          maximumResponseBytes: 16,
        },
      }),
    );
    const result = await client.request(request({ maximumResponseBytes: 16 }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderSecurityError');
      assert.match(result.error.message, /maximum size/i);
    }
  });

  it('12. maps timeout to ProviderTimeoutError', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            return;
          }
          if (signal.aborted) {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            return;
          }
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          });
        });
      }),
    );
    const result = await client.request(request({ timeoutMs: 20 }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderTimeoutError');
      assert.equal(result.error.retryable, true);
    }
  });

  it('13. normalizes 401 and 403 to ProviderAuthenticationError', async () => {
    for (const status of [401, 403]) {
      const client = transport(
        { kind: 'none' },
        mockFetch(() => new Response('denied', { status, headers: { 'content-type': 'text/plain' } })),
      );
      const result = await client.request(request());
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error.kind, 'ProviderAuthenticationError');
        assert.equal(result.error.httpStatus, status);
        assert.equal(result.error.retryable, false);
      }
    }
  });

  it('14. normalizes 429 to ProviderRateLimitError', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch(() => new Response('slow down', { status: 429, headers: { 'content-type': 'text/plain' } })),
    );
    const result = await client.request(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderRateLimitError');
      assert.equal(result.error.httpStatus, 429);
      assert.equal(result.error.retryable, true);
    }
  });

  it('15. normalizes 500 to ProviderServerError', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch(() => new Response('fail', { status: 500, headers: { 'content-type': 'text/plain' } })),
    );
    const result = await client.request(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderServerError');
      assert.equal(result.error.httpStatus, 500);
      assert.equal(result.error.retryable, true);
    }
  });

  it('16. rejects invalid JSON responses', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch(() => new Response('{not-json', { status: 200, headers: { 'content-type': 'application/json' } })),
    );
    const result = await client.request(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderInvalidResponseError');
      assert.match(result.error.message, /valid JSON/i);
    }
  });

  it('17. propagates correlation and request IDs', async () => {
    const client = transport(
      { kind: 'none' },
      mockFetch((_url, init) => {
        assert.equal((init?.headers as Record<string, string>)['x-request-id'], 'req-correlation');
        assert.equal((init?.headers as Record<string, string>)['x-correlation-id'], 'trace-correlation');
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'provider-req-99' } });
      }),
    );
    const result = await client.request(
      request({ requestId: 'req-correlation', traceId: 'trace-correlation' }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.metadata.requestId, 'req-correlation');
      assert.equal(result.value.metadata.traceId, 'trace-correlation');
      assert.equal(result.value.metadata.providerRequestId, 'provider-req-99');
    }
  });

  it('18. does not leak credentials in errors', async () => {
    const secretValue = 'super-secret-bearer-token-value';
    const client = transport(
      {
        kind: 'bearer',
        secretRef: secretRef('fixture', 'bearer-token'),
      },
      mockFetch(() => {
        throw new Error(`upstream failed with token ${secretValue}`);
      }),
    );
    const result = await client.request(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, 'ProviderNetworkError');
      assert.doesNotMatch(result.error.message, new RegExp(secretValue));
      assert.match(result.error.message, /\[REDACTED\]/);
      assert.doesNotMatch(JSON.stringify(result.error.toJSON()), new RegExp(secretValue));
    }
  });
});

describe('provider-sdk local mock server', () => {
  it('allows loopback in test when explicitly configured', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ source: 'local-mock' }));
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('failed to bind local mock server');
      }
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const client = createFetchProviderTransport({
        config: baseConfig({
          baseUrl,
          allowHttp: true,
          allowLoopbackInTest: true,
          environment: 'test',
        }),
        authResolver: resolver(),
        authStrategy: { kind: 'none' },
        fetchFn: fetch,
      });

      const result = await client.request(request({ path: '/' }));
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.deepEqual(result.value.parsed, { source: 'local-mock' });
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
