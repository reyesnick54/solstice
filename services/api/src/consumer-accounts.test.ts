import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';

async function get(
  world: ReturnType<typeof createSandboxWorld>,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  query: Record<string, string> = {},
) {
  return await handleConsumerBff(
    { bff: world.bff, sessions: world.sessions, identity: world.runtime.identity.service, agent: world.agent },
    {
      method: 'GET',
      path,
      query,
      body: {},
      authorization: `Bearer ${sandboxToken(persona)}`,
    },
  );
}

describe('Consumer BFF accounts productization', () => {
  it('returns posted/pending/held/available and product lifecycle', () => {
    const world = createSandboxWorld();
    const res = await get(world, '/api/v1/accounts/acct_sandbox_basic_usd', 'basic_verified');
    assert.equal(res.status, 200);
    const body = res.body as {
      status: string;
      productType: string;
      productConfiguration: { liveBanking: boolean };
      balance: { value: { posted: { minorUnits: string }; available: { minorUnits: string }; held: { minorUnits: string } } };
    };
    assert.equal(body.status, 'ACTIVE');
    assert.equal(body.productType, 'CHECKING_PAYMENT');
    assert.equal(body.productConfiguration.liveBanking, false);
    assert.equal(body.balance.value.posted.minorUnits, '25000');
    assert.equal(body.balance.value.available.minorUnits, '25000');
    assert.equal(body.balance.value.held.minorUnits, '0');
  });

  it('reflects holds in available balance and pending activity', () => {
    const world = createSandboxWorld();
    const account = await get(world, '/api/v1/accounts/acct_sandbox_pending_usd', 'pending_activity');
    const body = account.body as { balance: { value: { posted: { minorUnits: string }; available: { minorUnits: string }; held: { minorUnits: string } } } };
    assert.equal(body.balance.value.posted.minorUnits, '15000');
    assert.equal(body.balance.value.held.minorUnits, '2500');
    assert.equal(body.balance.value.available.minorUnits, '12500');
    const activity = await get(world, '/api/v1/accounts/acct_sandbox_pending_usd/activity', 'pending_activity', {
      status: 'PENDING',
    });
    const items = (activity.body as { value: { items: { status: string; type: string }[] } }).value.items;
    assert.ok(items.some((item) => item.status === 'PENDING' && item.type === 'HOLD'));
  });

  it('keeps USD and SAR separate and marks home valuation unavailable', () => {
    const world = createSandboxWorld();
    const home = await get(world, '/api/v1/me/home', 'multi_currency', { valuationCurrency: 'USD' });
    const wealth = (home.body as { wealth: { state: string; valuation: { status: string; currencies: string[] } } }).wealth;
    assert.equal(wealth.state, 'MIXED_CURRENCY_WITHOUT_CONVERSION');
    assert.equal(wealth.valuation.status, 'UNAVAILABLE');
    assert.ok(wealth.valuation.currencies.includes('USD'));
    assert.ok(wealth.valuation.currencies.includes('SAR'));
  });

  it('filters activity by type and paginates', () => {
    const world = createSandboxWorld();
    const res = await get(world, '/api/v1/accounts/acct_sandbox_basic_usd/activity', 'basic_verified', {
      type: 'DEPOSIT',
      pageSize: '1',
    });
    assert.equal(res.status, 200);
    const page = (res.body as { value: { items: { type: string }[]; hasMore: boolean } }).value;
    assert.equal(page.items.every((item) => item.type === 'DEPOSIT'), true);
    const injected = await get(world, '/api/v1/accounts/acct_sandbox_basic_usd/activity', 'basic_verified', {
      type: 'DEPOSIT;DROP TABLE',
    });
    assert.equal(injected.status, 400);
  });

  it('returns statement opening and closing balances', () => {
    const world = createSandboxWorld();
    const res = await get(world, '/api/v1/accounts/acct_sandbox_basic_usd/statement', 'basic_verified', {
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-08-31T23:59:59.000Z',
    });
    assert.equal(res.status, 200);
    const statement = (res.body as { value: { opening: { minorUnits: string }; closing: { minorUnits: string } } }).value;
    assert.equal(statement.opening.minorUnits, '0');
    assert.equal(statement.closing.minorUnits, '25000');
  });

  it('surfaces restricted account restrictions and denies cross-user access', () => {
    const world = createSandboxWorld();
    const own = await get(world, '/api/v1/accounts/acct_sandbox_restricted_usd', 'restricted');
    assert.equal(own.status, 200);
    const restrictions = (own.body as { status: string; restrictions: string[] }).restrictions;
    assert.ok(restrictions.includes('COMPLIANCE_REVIEW'));
    const cross = await get(world, '/api/v1/accounts/acct_sandbox_basic_usd', 'restricted');
    assert.equal(cross.status, 403);
  });

  it('includes a zero-balance new account and multiple-account investment persona', () => {
    const world = createSandboxWorld();
    const zero = await get(world, '/api/v1/accounts/acct_sandbox_zero_usd', 'zero_balance');
    assert.equal((zero.body as { balance: { value: { posted: { minorUnits: string } } } }).balance.value.posted.minorUnits, '0');
    const many = await get(world, '/api/v1/accounts', 'investment');
    assert.ok((many.body as { items: unknown[] }).items.length >= 2);
    const bootstrap = await get(world, '/api/v1/me/bootstrap', 'basic_verified');
    assert.ok((bootstrap.body as { accounts: { value: unknown[] } }).accounts.value.length >= 1);
  });
});
