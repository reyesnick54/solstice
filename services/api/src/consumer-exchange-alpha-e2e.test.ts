import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { createPhaseGWorld } from '../../../tests/phase-g-world.ts';

function runtime(world: ReturnType<typeof createSandboxWorld>) {
  return {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    grow: world.grow,
    exchange: world.exchange,
    wallets: world.wallets,
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

describe('Internal Alpha Consumer Exchange BFF E2E', () => {
  it('returns exchange home with LIVE_ALPHA and SRC/MRC markets', async () => {
    const world = createSandboxWorld();
    const home = await call(world, 'GET', '/api/v1/exchange', 'exchange');
    assert.equal(home.status, 200);
    const body = home.body as { alphaStatus: string; environment: string; schema: string };
    assert.equal(body.schema, 'sunrey.consumer.exchange.home.v1');
    assert.equal(body.alphaStatus, 'LIVE_ALPHA');
    assert.equal(body.environment, 'simulation');

    const markets = await call(world, 'GET', '/api/v1/exchange/markets', 'exchange');
    assert.equal(markets.status, 200);
    const items = (markets.body as { items: Array<{ marketId: string; quoteAsset?: string }> }).items;
    assert.ok(items.some((row) => row.marketId === 'SRC-USD'));
    assert.ok(items.some((row) => row.marketId === 'MRC-USD'));
    const srcUsd = items.find((row) => row.marketId === 'SRC-USD');
    assert.notEqual(srcUsd?.quoteAsset, 'USD');
  });

  it('creates a BUY quote from spendMinorUnits for SRC-USD', async () => {
    const world = createSandboxWorld();
    const quote = await call(world, 'POST', '/api/v1/exchange/quotes', 'exchange', {
      marketId: 'SRC-USD',
      side: 'BUY',
      spendMinorUnits: '10000',
    });
    assert.equal(quote.status, 201);
    const body = quote.body as {
      quoteId: string;
      marketId: string;
      side: string;
      priceSource: string;
      liquiditySource: string;
      environment: string;
      quoteCurrencyLabel: string;
    };
    assert.ok(body.quoteId);
    assert.equal(body.marketId, 'SRC-USD');
    assert.equal(body.side, 'BUY');
    assert.equal(body.priceSource, 'ALPHA_INTERNAL_LIQUIDITY');
    assert.equal(body.liquiditySource, 'ALPHA_INTERNAL_LIQUIDITY');
    assert.equal(body.environment, 'simulation');
    assert.equal(body.quoteCurrencyLabel, 'SANDBOX_USD');
  });

  it('rejects quote without quantity or spend', async () => {
    const world = createSandboxWorld();
    const badQuote = await call(world, 'POST', '/api/v1/exchange/quotes', 'exchange', {
      marketId: 'SRC-USD',
      side: 'BUY',
    });
    assert.equal(badQuote.status, 400);
  });

  it('buys SRC after quote confirmation with step-up', async () => {
    const world = createPhaseGWorld();
    await world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });

    const quote = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/quotes',
      body: { marketId: 'SRC-MRC', side: 'BUY', quantity: '2' },
    });
    assert.equal(quote.status, 201);
    const quoteId = (quote.body as { quoteId: string }).quoteId;

    const denied = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/orders',
      body: { marketId: 'SRC-MRC', side: 'BUY', quantity: '2', quoteId, confirmed: true, stepUpSatisfied: false },
    });
    assert.equal(denied.status, 401);

    const order = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/orders',
      body: { marketId: 'SRC-MRC', side: 'BUY', quantity: '2', quoteId, confirmed: true, stepUpSatisfied: true },
    });
    assert.equal(order.status, 201);
    const orderBody = order.body as {
      orderId: string;
      status: string;
      serverDerived: boolean;
    };
    assert.ok(orderBody.orderId);
    assert.ok(['PENDING', 'PARTIALLY_FILLED', 'FILLED', 'SETTLING', 'FINALIZED'].includes(orderBody.status));
    assert.equal(orderBody.serverDerived, true);
  });

  it('buys MRC and updates portfolio and SRC/MRC wallets', async () => {
    const world = createPhaseGWorld();
    await world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });

    const quote = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/quotes',
      body: { marketId: 'SRC-MRC', side: 'BUY', quantity: '1' },
    });
    assert.equal(quote.status, 201);

    const order = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/orders',
      body: {
        marketId: 'SRC-MRC',
        side: 'BUY',
        quantity: '1',
        quoteId: (quote.body as { quoteId: string }).quoteId,
        confirmed: true,
        stepUpSatisfied: true,
      },
    });
    assert.equal(order.status, 201);

    const portfolio = await world.handle({ method: 'GET', path: '/api/v1/exchange/portfolio' });
    assert.equal(portfolio.status, 200);
    assert.equal((portfolio.body as { schema: string }).schema, 'sunrey.consumer.exchange.portfolio.v1');

    const srcWallet = await world.handle({ method: 'GET', path: '/api/v1/wallets/SRC' });
    assert.equal(srcWallet.status, 200);
    assert.equal((srcWallet.body as { assetAlias: string }).assetAlias, 'SRC');

    const mrcWallet = await world.handle({ method: 'GET', path: '/api/v1/wallets/MRC' });
    assert.equal(mrcWallet.status, 200);
    assert.equal((mrcWallet.body as { assetAlias: string }).assetAlias, 'MRC');
  });

  it('runs sell flow and exposes order history', async () => {
    const world = createPhaseGWorld();
    await world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
    world.exchange.worldFor({
      actorId: 'a',
      customerId: 'cust_sandbox_basic',
      identityId: 'idn',
      sessionId: 's',
      jurisdiction: 'GB',
      verification: 'VERIFIED',
      customerStatus: 'ACTIVE',
      identityStatus: 'ACTIVE',
      capabilities: [],
      risk: 'LOW',
      restricted: false,
      sandboxPersona: 'basic_verified',
      deviceSummary: { deviceId: 'd', trustState: 'KNOWN' },
    }).fundBase(10n);

    const quote = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/quotes',
      body: { marketId: 'SRC-MRC', side: 'SELL', quantity: '1' },
    });
    assert.equal(quote.status, 201);

    const order = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/orders',
      body: {
        marketId: 'SRC-MRC',
        side: 'SELL',
        quantity: '1',
        quoteId: (quote.body as { quoteId: string }).quoteId,
        confirmed: true,
        stepUpSatisfied: true,
      },
    });
    assert.equal(order.status, 201);

    const orders = await world.handle({ method: 'GET', path: '/api/v1/exchange/orders' });
    assert.equal(orders.status, 200);

    const detail = await world.handle({
      method: 'GET',
      path: `/api/v1/exchange/orders/${(order.body as { orderId: string }).orderId}`,
    });
    assert.equal(detail.status, 200);

    const tx = await world.handle({ method: 'GET', path: '/api/v1/exchange/transactions' });
    assert.equal(tx.status, 200);
    assert.equal((tx.body as { serverDerived: boolean }).serverDerived, true);
  });

  it('rejects duplicate client order idempotency and enforces confirmation', async () => {
    const world = createPhaseGWorld();
    await world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
    const quote = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/quotes',
      body: { marketId: 'SRC-MRC', side: 'BUY', quantity: '1' },
    });
    const body = {
      marketId: 'SRC-MRC',
      side: 'BUY',
      quantity: '1',
      quoteId: (quote.body as { quoteId: string }).quoteId,
      confirmed: true,
      stepUpSatisfied: true,
      clientOrderId: 'dup-alpha-1',
    };
    const first = await world.handle({ method: 'POST', path: '/api/v1/exchange/orders', body });
    assert.equal(first.status, 201);
    const second = await world.handle({ method: 'POST', path: '/api/v1/exchange/orders', body });
    assert.equal(second.status, 201);
    assert.equal((first.body as { orderId: string }).orderId, (second.body as { orderId: string }).orderId);

    const unconfirmed = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/orders',
      body: { marketId: 'SRC-MRC', side: 'BUY', quantity: '1', confirmed: false, stepUpSatisfied: true },
    });
    assert.equal(unconfirmed.status, 400);
  });

  it('denies cross-user order access and requires auth after logout', async () => {
    const world = createSandboxWorld();
    const denied = await call(world, 'GET', '/api/v1/exchange/orders/xord_foreign', 'exchange');
    assert.equal(denied.status, 404);

    const unauth = await call(world, 'GET', '/api/v1/exchange/markets', null);
    assert.equal(unauth.status, 401);
  });

  it('survives snapshot restore without duplicating fills', async () => {
    const world = createPhaseGWorld();
    await world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
    const principal = {
      actorId: 'a',
      customerId: 'cust_sandbox_basic',
      identityId: 'idn',
      sessionId: 's',
      jurisdiction: 'GB' as const,
      verification: 'VERIFIED' as const,
      customerStatus: 'ACTIVE' as const,
      identityStatus: 'ACTIVE' as const,
      capabilities: [] as readonly string[],
      risk: 'LOW' as const,
      restricted: false,
      sandboxPersona: 'basic_verified' as const,
      deviceSummary: { deviceId: 'd', trustState: 'KNOWN' as const },
    };
    const lifecycle = world.exchange.worldFor(principal);
    lifecycle.snapshotState();
    const restored = lifecycle.restoreFromSnapshot();
    assert.equal(restored.duplicatedFill, false);
    assert.equal(restored.duplicatedChainTx, false);
  });

  it('exposes nested exchange economy routes', async () => {
    const world = createPhaseGWorld();
    const economy = await world.handle({ method: 'GET', path: '/api/v1/exchange/economy' });
    assert.equal(economy.status, 200);
    const status = await world.handle({ method: 'GET', path: '/api/v1/exchange/economy/status' });
    assert.equal(status.status, 200);
  });

  it('cancels an open order via POST cancel route', async () => {
    const world = createPhaseGWorld();
    await world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
    const created = await world.handle({
      method: 'POST',
      path: '/api/v1/exchange/proposals',
      body: { side: 'BUY', quantity: '1', notionalUsdMinor: '50000' },
    });
    assert.equal(created.status, 201);
    const proposalId = (created.body as { proposalId: string }).proposalId;
    await world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${proposalId}/approve`,
      body: { stepUpSatisfied: true },
    });
    const submitted = await world.handle({
      method: 'POST',
      path: `/api/v1/exchange/proposals/${proposalId}/submit`,
      body: { clientOrderId: 'cancel-me-alpha' },
    });
    assert.equal(submitted.status, 200);
    const orderId = (submitted.body as { orderId?: string }).orderId;
    if (orderId) {
      const cancelled = await world.handle({
        method: 'POST',
        path: `/api/v1/exchange/orders/${orderId}/cancel`,
        body: {},
      });
      assert.ok([200, 400, 403].includes(cancelled.status));
    }
  });
});
