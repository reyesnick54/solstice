import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../packages/config/src/clock.ts';
import { asJurisdiction } from '../../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { AuthenticationService } from '../../../packages/identity/src/authentication-service.ts';
import { SimulatedIdentityAdapter } from '../../../packages/identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../../../packages/security/src/simulation.ts';

import { createPlatformApi } from './app.ts';

const silent = (): void => undefined;
const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');
const PASSWORD = 'correct-horse-battery-staple';

function authService(): AuthenticationService {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const adapter = new SimulatedIdentityAdapter({ clock, keys });
  return new AuthenticationService({
    identity: adapter.service,
    clock,
    keys,
  });
}

async function request(
  url: string,
  init: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  } = {},
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  return { status: response.status, body: JSON.parse(await response.text()) };
}

describe('platform API authentication mount', () => {
  it('registers, logs in, and serves /api/v1/me from a validated session', async () => {
    const authentication = authService();
    const api = await createPlatformApi({
      config: { port: 0 },
      authentication,
      logSink: silent,
    });
    try {
      const registered = await request(`${api.url}/api/v1/auth/register`, {
        method: 'POST',
        body: {
          email: 'mount@example.com',
          password: PASSWORD,
          homeJurisdiction: asJurisdiction('GB'),
          termsVersion: 'tos-api',
        },
      });
      assert.equal(registered.status, 201);
      assert.equal((registered.body as { kyc_completed: boolean }).kyc_completed, false);

      const rejected = await request(`${api.url}/api/v1/auth/login`, {
        method: 'POST',
        body: {
          email: 'mount@example.com',
          password: PASSWORD,
          userId: 'client-chosen',
        },
      });
      assert.equal(rejected.status, 400);
      assert.equal((rejected.body as { error: { code: string } }).error.code, 'VALIDATION_FAILED');

      const login = await request(`${api.url}/api/v1/auth/login`, {
        method: 'POST',
        body: { email: 'mount@example.com', password: PASSWORD, deviceRef: 'api-device' },
      });
      assert.equal(login.status, 200);
      const tokens = login.body as { access_token: string; execution_authority: boolean };
      assert.equal(tokens.execution_authority, false);

      const me = await request(`${api.url}/api/v1/me`, {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      assert.equal(me.status, 200);
      assert.equal((me.body as { source: string }).source, 'validated_session');
      assert.ok((me.body as { userId: string }).userId);
    } finally {
      await api.close();
    }
  });
});
