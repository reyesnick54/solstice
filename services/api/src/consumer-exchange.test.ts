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
  return handleConsumerBff(runtime(world), {
    method,
    path,
    query: {},
    body,
    authorization: persona ? `Bearer ${sandboxToken(persona)}` : undefined,
  });
}

describe('Consumer BFF exchange productization', () => {
  it('lists canonical Alpha markets and order preview without guaranteeing price', async () => {
    const world = createSandboxWorld();
    const markets = await call(world, 'GET', '/api/v1/exchange/markets', 'exchange');
    assert.equal(markets.status, 200);
    const body = markets.body as { alphaStatus: string; items: readonly { marketId: string }[] };
    assert.equal(body.alphaStatus, 'LIVE_ALPHA');
    assert.ok(body.items.some((row) => row.marketId === 'SRC-USD'));
    const preview = call(world, 'POST', '/api/v1/exchange/preview', 'exchange', {
    const body = markets.body as {
      productionTradingEnabled: false;
      screens: readonly string[];
      items: readonly { instrument: string; marketId: string }[];
    };
    assert.equal(body.productionTradingEnabled, false);
    assert.ok(body.screens.includes('ORDER_PREVIEW'));
    assert.ok(body.items.some((item) => item.instrument === 'SRC-USD'));
    assert.ok(body.items.some((item) => item.instrument === 'MRC-USD'));
    assert.ok(body.items.some((item) => item.instrument === 'SRC-MRC'));
    const preview = await call(world, 'POST', '/api/v1/exchange/preview', 'exchange', {
      marketId: 'market:src-usd-alpha',
      instrument: 'SRC-USD',
      side: 'BUY',
      quantity: '1',
    });
    assert.equal(preview.status, 200);
  });

  it('refuses raw agent-style order submission without confirmation and step-up', () => {
    const world = createSandboxWorld();
    const raw = call(world, 'POST', '/api/v1/exchange/orders', 'exchange', {
      marketId: 'SRC-USD',
      side: 'BUY',
      quantity: '1',
    });
    assert.ok(raw.status === 400 || raw.status === 401 || raw.status === 403);
    const confirmed = call(world, 'POST', '/api/v1/exchange/orders', 'exchange', {
      marketId: 'SRC-MRC',
  it('refuses raw agent-style order submission without an approved proposal', async () => {
    const world = createSandboxWorld();
    const raw = await call(world, 'POST', '/api/v1/exchange/orders', 'exchange', {
      marketId: 'market:src-usd-alpha',
      side: 'BUY',
      quantity: '1',
    });
    assert.ok(raw.status === 400 || raw.status === 403);
    const proposed = await call(world, 'POST', '/api/v1/exchange/orders', 'exchange', {
      marketId: 'market:src-usd-alpha',
      side: 'BUY',
      quantity: '1',
      confirmed: true,
      stepUpSatisfied: true,
    });
    assert.equal(confirmed.status, 201);
    assert.equal((confirmed.body as { serverDerived: boolean }).serverDerived, true);
  });

  it('denies cross-user order reads', async () => {
    const world = createSandboxWorld();
    const denied = call(world, 'GET', '/api/v1/exchange/orders/xord_someone_else', 'exchange');
    assert.equal(denied.status, 404);
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
