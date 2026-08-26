import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { startConsumerBff } from './consumer/http.ts';

function runtime() {
  const world = createSandboxWorld();
  return {
    world,
    runtime: {
      bff: world.bff,
      sessions: world.sessions,
      identity: world.runtime.identity.service,
      payments: world.payments,
      agent: world.agent,
      grow: world.grow,
    },
  };
}

describe('Consumer BFF HTTP adapter', () => {
  it('serves authenticated Home with no-store cache headers', async () => {
    const { runtime: consumerRuntime } = runtime();
    const server = await startConsumerBff({ runtime: consumerRuntime });
    try {
      const res = await fetch(`${server.url}/api/v1/me/home`, {
        headers: { authorization: `Bearer ${sandboxToken('basic_verified')}` },
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('cache-control') ?? '', /no-store/);
      assert.equal(res.headers.get('x-sunrey-surface'), 'CONSUMER_BFF');
      const body = (await res.json()) as { schema: string };
      assert.equal(body.schema, 'sunrey.consumer.home.v1');
    } finally {
      await server.close();
    }
  });

  it('keeps preview authentication disabled unless explicitly enabled', async () => {
    const { runtime: consumerRuntime } = runtime();
    const server = await startConsumerBff({ runtime: consumerRuntime });
    try {
      const res = await fetch(`${server.url}/api/v1/auth/preview/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'preview@sunrey.xyz', password: 'not-used' }),
      });
      assert.equal(res.status, 404);
    } finally {
      await server.close();
    }
  });

  it('issues a revocable simulation session through the preview auth bridge', async () => {
    const { runtime: consumerRuntime } = runtime();
    const server = await startConsumerBff({
      runtime: consumerRuntime,
      allowPreviewAuth: true,
      previewAuth: {
        email: 'preview@sunrey.xyz',
        password: 'preview-password-12345',
      },
    });
    try {
      const login = await fetch(`${server.url}/api/v1/auth/preview/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'preview@sunrey.xyz',
          password: 'preview-password-12345',
          personaId: 'basic_verified',
        }),
      });
      assert.equal(login.status, 200);
      assert.match(login.headers.get('cache-control') ?? '', /no-store/);
      const session = (await login.json()) as {
        schema: string;
        token: string;
        production: boolean;
        personaId: string;
      };
      assert.equal(session.schema, 'sunrey.preview.auth-session.v1');
      assert.equal(session.production, false);
      assert.equal(session.personaId, 'basic_verified');
      assert.match(session.token, /^ses_/);

      const authenticated = await fetch(`${server.url}/api/v1/auth/session`, {
        headers: { authorization: `Bearer ${session.token}` },
      });
      assert.equal(authenticated.status, 200);
      const authBody = (await authenticated.json()) as { authenticated: boolean; customerId: string };
      assert.equal(authBody.authenticated, true);
      assert.equal(authBody.customerId, 'cust_sandbox_basic');

      const bootstrap = await fetch(`${server.url}/api/v1/me/bootstrap`, {
        headers: { authorization: `Bearer ${session.token}` },
      });
      assert.equal(bootstrap.status, 200);

      const logout = await fetch(`${server.url}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${session.token}` },
      });
      assert.equal(logout.status, 200);

      const afterLogout = await fetch(`${server.url}/api/v1/me/bootstrap`, {
        headers: { authorization: `Bearer ${session.token}` },
      });
      assert.equal(afterLogout.status, 401);
    } finally {
      await server.close();
    }
  });

  it('rejects incorrect preview credentials without revealing which field failed', async () => {
    const { runtime: consumerRuntime } = runtime();
    const server = await startConsumerBff({
      runtime: consumerRuntime,
      allowPreviewAuth: true,
      previewAuth: {
        email: 'preview@sunrey.xyz',
        password: 'preview-password-12345',
      },
    });
    try {
      const res = await fetch(`${server.url}/api/v1/auth/preview/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'preview@sunrey.xyz', password: 'wrong-password' }),
      });
      assert.equal(res.status, 401);
      const body = (await res.json()) as { errorCode: string; message: string };
      assert.equal(body.errorCode, 'AUTH_REQUIRED');
      assert.equal(body.message, 'email or password is incorrect');
    } finally {
      await server.close();
    }
  });
});
