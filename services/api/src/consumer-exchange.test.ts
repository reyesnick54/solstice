import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';

function runtime(world: ReturnType<typeof createSandboxWorld>) {
  return {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    grow: world.grow,
    exchange: world.exchange,
  };
}

async function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0] | null,
  body: Record<string, unknown> = {},
) {
  return await handleConsumerBff(runtime(world), {
    method,
    path,
    query: {},
    body,
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
  });
}

describe('Consumer BFF exchange productization', () => {
  it('lists markets and order preview without guaranteeing price', () => {
    const world = createSandboxWorld();
    const markets = await call(world, 'GET', '/api/v1/exchange/markets', 'exchange');
    assert.equal(markets.status, 200);
    const body = markets.body as { productionTradingEnabled: false; screens: readonly string[] };
    assert.equal(body.productionTradingEnabled, false);
    assert.ok(body.screens.includes('ORDER_PREVIEW'));
    const preview = await call(world, 'POST', '/api/v1/exchange/preview', 'exchange', {
      marketId: 'market:sunrey-coin-usd-simulation',
      instrument: 'SUNREY_COIN-USD',
      side: 'BUY',
      quantity: '1',
    });
    assert.equal(preview.status, 200);
    assert.equal((preview.body as { guaranteedExecutionPrice: false }).guaranteedExecutionPrice, false);
  });

  it('refuses raw agent-style order submission without an approved proposal', () => {
    const world = createSandboxWorld();
    const raw = await call(world, 'POST', '/api/v1/exchange/orders', 'exchange', {
      marketId: 'market:sunrey-coin-usd-simulation',
      side: 'BUY',
      quantity: '1',
    });
    assert.equal(raw.status, 400);
    const proposed = await call(world, 'POST', '/api/v1/exchange/orders', 'exchange', {
      marketId: 'market:sunrey-coin-usd-simulation',
      side: 'BUY',
      quantity: '1',
      proposalId: 'prop_approved',
    });
    assert.equal(proposed.status, 201);
    assert.equal((proposed.body as { requiresExecution: true }).requiresExecution, true);
  });

  it('denies cross-user order reads', () => {
    const world = createSandboxWorld();
    const denied = await call(world, 'GET', '/api/v1/exchange/orders/xord_someone_else', 'exchange');
    assert.equal(denied.status, 403);
  });

  it('streams non-privileged market events', async () => {
    const world = createSandboxWorld();
    const streamed = await handleConsumerBff(runtime(world), {
      method: 'GET',
      path: '/api/v1/exchange/stream',
      query: { after: '0' },
      body: {},
      authorization: `Bearer ${sandboxToken('exchange')}`,
      accept: 'text/event-stream',
    });
    assert.equal(streamed.status, 200);
    assert.match(String(streamed.headers['content-type']), /text\/event-stream/);
  });
});
