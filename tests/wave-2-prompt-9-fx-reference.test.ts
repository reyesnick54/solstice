// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleConsumerBff } from '../services/api/src/consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';

function auth(persona: Parameters<typeof sandboxToken>[0]) {
  return `Bearer ${sandboxToken(persona)}`;
}

function get(world: ReturnType<typeof createSandboxWorld>, path: string, persona: Parameters<typeof sandboxToken>[0], query: Record<string, string> = {}) {
  return handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments, agent: world.agent },
    {
      method: 'GET',
      path,
      query,
      body: {},
      authorization: auth(persona),
    },
  );
}

function post(world: ReturnType<typeof createSandboxWorld>, path: string, persona: Parameters<typeof sandboxToken>[0], body: Record<string, unknown>) {
  return handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments, agent: world.agent },
    {
      method: 'POST',
      path,
      query: {},
      body,
      authorization: auth(persona),
    },
  );
}

describe('wave 2 prompt 9 fx reference bff', () => {
  it('serves normalized FX reference endpoints without exposing provider secrets', () => {
    const world = createSandboxWorld();
    const providers = get(world, '/api/v1/fx/reference', 'multi_currency').body as {
      authority: string;
      items: { providerId: string }[];
    };
    assert.equal(providers.authority, 'FX_REFERENCE_ONLY_NOT_EXECUTION');
    assert.ok(providers.items.length >= 7);

    const rate = get(world, '/api/v1/fx/reference/USD/SAR', 'multi_currency').body as {
      ok: boolean;
      authority: string;
      providerId: string;
      executionAuthority: boolean;
    };
    assert.equal(rate.ok, true);
    assert.equal(rate.authority, 'FX_REFERENCE_ONLY_NOT_EXECUTION');
    assert.equal(rate.executionAuthority, false);
    assert.ok(rate.providerId);

    const history = get(world, '/api/v1/fx/reference/USD/SAR/history', 'multi_currency', { date: '2026-08-01' }).body as {
      ok: boolean;
      date: string;
    };
    assert.equal(history.ok, true);
    assert.equal(history.date, '2026-08-01');
  });

  it('leaves execution FX paths unchanged', () => {
    const world = createSandboxWorld();
    const currencies = get(world, '/api/v1/fx/currencies', 'multi_currency');
    assert.equal(currencies.status, 200);
    const body = currencies.body as { items: { code: string }[]; liveEnabled: boolean };
    assert.ok(body.items.some((row) => row.code === 'USD'));
    assert.equal(body.liveEnabled, false);
  });
});
