import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';

async function call(
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
    agent: world.agent,
  };
  return await handleConsumerBff(runtime, {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: `Bearer ${sandboxToken(persona)}`,
    requestId: `req_${method}_${path}`,
  });
}

describe('Consumer BFF cards productization', () => {
  it('lists a sandbox virtual card without PCI-sensitive fields', async () => {
    const world = createSandboxWorld();
    const listed = await call(world, 'GET', '/api/v1/cards', 'basic_verified');
    assert.equal(listed.status, 200);
    const body = listed.body as { items: { last4: string; status: string; type: string }[]; productionIssuing: boolean };
    assert.equal(body.productionIssuing, false);
    assert.ok(body.items.length >= 1);
    assert.equal(body.items[0]?.last4, '0000');
    assert.equal(body.items[0]?.type, 'DEBIT');
    assert.equal(JSON.stringify(body).includes('pan'), false);
    assert.equal(JSON.stringify(body).includes('cvv'), false);
  });

  it('returns card detail with funding available balance and wallet status', async () => {
    const world = createSandboxWorld();
    const detail = await call(world, 'GET', '/api/v1/cards/card_sandbox_basic_virtual', 'basic_verified');
    assert.equal(detail.status, 200);
    const body = detail.body as {
      card: { status: string; last4: string };
      available: { minorUnits: string };
      wallet: { certification: string; productionReady: boolean };
    };
    assert.equal(body.card.status, 'ACTIVE');
    assert.ok(BigInt(body.available.minorUnits) > 0n);
    assert.equal(body.wallet.certification, 'NOT_CERTIFIED');
    assert.equal(body.wallet.productionReady, false);
  });

  it('freezes and unfreezes through the BFF', async () => {
    const world = createSandboxWorld();
    const frozen = await call(world, 'POST', '/api/v1/cards/card_sandbox_basic_virtual/freeze', 'basic_verified');
    assert.equal(frozen.status, 200);
    assert.equal((frozen.body as { status: string }).status, 'FROZEN');
    const unfrozen = await call(world, 'POST', '/api/v1/cards/card_sandbox_basic_virtual/unfreeze', 'basic_verified');
    assert.equal(unfrozen.status, 200);
    assert.equal((unfrozen.body as { status: string }).status, 'ACTIVE');
  });

  it('patches spending controls on the server', async () => {
    const world = createSandboxWorld();
    const patched = await call(world, 'PATCH', '/api/v1/cards/card_sandbox_basic_virtual/controls', 'basic_verified', {
      internationalTransactions: false,
      transactionLimitMinor: '2500',
    });
    assert.equal(patched.status, 200);
    const controls = (patched.body as { controls: { internationalTransactions: boolean; transactionLimitMinor: string } })
      .controls;
    assert.equal(controls.internationalTransactions, false);
    assert.equal(controls.transactionLimitMinor, '2500');
  });

  it('refuses cross-user card access', async () => {
    const world = createSandboxWorld();
    const other = await call(world, 'GET', '/api/v1/cards/card_sandbox_basic_virtual', 'investment');
    assert.equal(other.status, 403);
    assert.equal((other.body as { errorCode: string }).errorCode, 'RESOURCE_NOT_OWNED');
  });

  it('issues a simulated virtual card for the authenticated owner', async () => {
    const world = createSandboxWorld();
    const issued = await call(world, 'POST', '/api/v1/cards', 'basic_verified', {
      fundingAccountId: 'acct_sandbox_basic_usd',
      form: 'VIRTUAL',
      cardId: 'card_sandbox_issued_virtual',
      idempotencyKey: 'issue_basic_2',
    });
    assert.equal(issued.status, 201);
    assert.equal((issued.body as { status: string; last4: string }).status, 'ACTIVE');
    assert.equal((issued.body as { last4: string }).last4, '0000');
  });

  it('requires step-up for sensitive card actions without high assurance', async () => {
    const world = createSandboxWorld();
    const pending = await call(world, 'POST', '/api/v1/cards/card_sandbox_basic_virtual/freeze', 'kyc_pending');
    assert.ok(pending.status === 403 || pending.status === 401);
  });
});
