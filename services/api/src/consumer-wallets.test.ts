import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';

function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  body?: Record<string, unknown>,
) {
  const runtime: ConsumerBffRuntime = {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    wallets: world.wallets,
  };
  return handleConsumerBff(runtime, {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: `Bearer ${sandboxToken(persona)}`,
    requestId: `req_${method}_${path}`,
  });
}

describe('Consumer BFF wallets productization', () => {
  it('lists owned wallets without signing material', () => {
    const world = createSandboxWorld();
    const listed = call(world, 'GET', '/api/v1/wallets', 'basic_verified');
    assert.equal(listed.status, 200);
    const body = listed.body as { items: { walletId: string; assetId: string }[]; productionSigningAuthorized: boolean };
    assert.equal(body.productionSigningAuthorized, false);
    assert.ok(body.items.some((row) => row.walletId === 'wal_sandbox_basic_sunrey'));
    assert.ok(body.items.some((row) => row.assetId === 'MOONREY_COIN'));
    assert.equal(JSON.stringify(body).includes('privateKey'), false);
    assert.equal(JSON.stringify(body).includes('signingKey'), false);
  });

  it('denies cross-user wallet access', () => {
    const world = createSandboxWorld();
    const denied = call(world, 'GET', '/api/v1/wallets/wal_sandbox_basic_sunrey', 'exchange');
    assert.equal(denied.status, 403);
  });

  it('returns a deposit address bound to the wallet asset', () => {
    const world = createSandboxWorld();
    const address = call(world, 'GET', '/api/v1/wallets/wal_sandbox_basic_sunrey/deposit-address', 'basic_verified');
    assert.equal(address.status, 200);
    const body = address.body as { address: string; assetId: string; qrPayload: string };
    assert.equal(body.address.startsWith('sr1'), true);
    assert.equal(body.assetId, 'SUNREY_COIN');
    assert.equal(body.qrPayload, body.address);
  });

  it('quotes and executes a withdrawal only after step-up', () => {
    const world = createSandboxWorld();
    const quoted = call(world, 'POST', '/api/v1/wallets/wal_sandbox_basic_sunrey/withdrawal-quote', 'basic_verified', {
      destination: 'sr1peerxxxxxxxx',
      amountMinorUnits: '100000',
    });
    assert.equal(quoted.status, 200);
    const quote = quoted.body as { quoteId: string; estimate: boolean };
    assert.equal(quote.estimate, true);
    const refused = call(world, 'POST', '/api/v1/wallets/wal_sandbox_basic_sunrey/withdrawals', 'basic_verified', {
      quoteId: quote.quoteId,
    });
    assert.equal(refused.status, 401);
    const executed = call(world, 'POST', '/api/v1/wallets/wal_sandbox_basic_sunrey/withdrawals', 'basic_verified', {
      quoteId: quote.quoteId,
      stepUpSatisfied: true,
    });
    assert.equal(executed.status, 201);
    const withdrawal = executed.body as { finality: string; productionSigningAuthorized: boolean };
    assert.equal(withdrawal.finality, 'FINALIZED');
    assert.equal(withdrawal.productionSigningAuthorized, false);
  });

  it('lets an Agent create a proposal without broadcasting', () => {
    const world = createSandboxWorld();
    const proposal = call(world, 'POST', '/api/v1/wallets/wal_sandbox_agent_sunrey/withdrawals', 'agent_enabled', {
      destination: 'sr1peerxxxxxxxx',
      amountMinorUnits: '50000',
      originatedFromAgent: true,
    });
    assert.equal(proposal.status, 201);
    const body = proposal.body as { status: string; txRef: string | null; originatedFromAgent: boolean };
    assert.equal(body.status, 'PROPOSED');
    assert.equal(body.txRef, null);
    assert.equal(body.originatedFromAgent, true);
  });

  it('aggregates SunRey Coin asset detail for Lovable', () => {
    const world = createSandboxWorld();
    const detail = call(world, 'GET', '/api/v1/assets/SUNREY_COIN', 'basic_verified');
    assert.equal(detail.status, 200);
    const body = detail.body as {
      displayName: string;
      eligibility: { depositAvailable: boolean; withdrawalAvailable: boolean; exchangeAvailable: boolean };
      wallet: { walletId: string } | null;
    };
    assert.equal(body.displayName, 'SunRey Coin');
    assert.equal(body.eligibility.depositAvailable, true);
    assert.ok(body.wallet);
  });
});
