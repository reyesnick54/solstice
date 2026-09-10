import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';

function auth(persona: Parameters<typeof sandboxToken>[0]) {
  return `Bearer ${sandboxToken(persona)}`;
}

async function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  body: Record<string, unknown> = {},
  idempotencyKey?: string,
) {
  return await handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, payments: world.payments, agent: world.agent },
    {
      method,
      path,
      query: {},
      body,
      authorization: auth(persona),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  );
}

describe('Consumer BFF payments', () => {
  it('creates a recipient and denies cross-user reads', async () => {
    const world = createSandboxWorld();
    const created = await call(world, 'POST', '/api/v1/recipients', 'basic_verified', {
      accountId: 'acct_sandbox_basic_usd',
      destinationType: 'SUNREY_USER',
      destinationAccountId: 'acct_sandbox_invest_cash',
      displayName: 'Investment counterparty',
      currency: 'USD',
      country: 'GB',
    }, 'ben_bff_1');
    assert.equal(created.status, 200);
    const recipient = created.body as { id: string; destinationType: string };
    assert.equal(recipient.destinationType, 'SUNREY_USER');
    const denied = await call(world, 'GET', `/api/v1/recipients/${recipient.id}`, 'restricted');
    assert.equal(denied.status, 403);
  });

  it('quotes and completes an internal transfer', async () => {
    const world = createSandboxWorld();
    const quote = await call(world, 'POST', '/api/v1/payments/quote', 'basic_verified', {
      sourceAccountId: 'acct_sandbox_basic_usd',
      destinationAccountId: 'acct_sandbox_invest_cash',
      amountMinorUnits: '1500',
      currency: 'USD',
    });
    assert.equal(quote.status, 200);
    const quoted = quote.body as { quoteId: string; settlementTimePromise: null; productionMoneyMovement: false };
    assert.equal(quoted.settlementTimePromise, null);
    assert.equal(quoted.productionMoneyMovement, false);
    const paid = await call(world, 'POST', '/api/v1/payments', 'basic_verified', {
      sourceAccountId: 'acct_sandbox_basic_usd',
      destinationAccountId: 'acct_sandbox_invest_cash',
      amountMinorUnits: '1500',
      currency: 'USD',
      quoteId: quoted.quoteId,
      purpose: 'sandbox transfer',
    }, 'pay_bff_1');
    assert.equal(paid.status, 200);
    const payment = paid.body as { status: string; paymentType: string };
    assert.equal(payment.status, 'SETTLED');
    assert.equal(payment.paymentType, 'SUNREY_TO_SUNREY');
    const replay = await call(world, 'POST', '/api/v1/payments', 'basic_verified', {
      sourceAccountId: 'acct_sandbox_basic_usd',
      destinationAccountId: 'acct_sandbox_invest_cash',
      amountMinorUnits: '1500',
      currency: 'USD',
    }, 'pay_bff_1');
    assert.equal(replay.status, 200);
    const listed = await call(world, 'GET', '/api/v1/payments', 'basic_verified');
    assert.equal(listed.status, 200);
    assert.equal(((listed.body as { items: unknown[] }).items.length) >= 1, true);
    const fetched = await call(world, 'GET', `/api/v1/payments/${(paid.body as { paymentId: string }).paymentId}`, 'basic_verified');
    assert.equal(fetched.status, 200);
    assert.equal((fetched.body as { status: string }).status, 'SETTLED');
  });

  it('lists recipients after create', async () => {
    const world = createSandboxWorld();
    const created = await call(world, 'POST', '/api/v1/recipients', 'basic_verified', {
      accountId: 'acct_sandbox_basic_usd',
      destinationType: 'SUNREY_USER',
      destinationAccountId: 'acct_sandbox_invest_cash',
      displayName: 'Listed counterparty',
      currency: 'USD',
      country: 'GB',
    }, 'ben_bff_list');
    assert.equal(created.status, 200);
    const listed = await call(world, 'GET', '/api/v1/recipients', 'basic_verified');
    assert.equal(listed.status, 200);
    const items = (listed.body as { items: { id: string }[] }).items;
    assert.equal(items.some((row) => row.id === (created.body as { id: string }).id), true);
  });
});
