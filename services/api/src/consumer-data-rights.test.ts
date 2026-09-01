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
    dataRights: world.dataRights,
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

describe('Consumer BFF consent and data rights', () => {
  it('lists permissions without implicit monetization opt-in', async () => {
    const world = createSandboxWorld();
    const listed = await call(world, 'GET', '/api/v1/data/permissions', 'basic_verified');
    assert.equal(listed.status, 200);
    const body = listed.body as {
      implicitMonetizationOptIn: boolean;
      purposes: { purposeId: string; necessity: string; granted: boolean; requiredForBasicAccount: boolean }[];
    };
    assert.equal(body.implicitMonetizationOptIn, false);
    const licensing = body.purposes.find((row) => row.purposeId === 'data-licensing');
    assert.ok(licensing);
    assert.equal(licensing.necessity, 'OPTIONAL_COMPENSATED');
    assert.equal(licensing.granted, false);
    assert.equal(licensing.requiredForBasicAccount, false);
  });

  it('grants a bundle, isolates users, and revokes immediately', async () => {
    const world = createSandboxWorld();
    const granted = await call(world, 'POST', '/api/v1/data/consents', 'basic_verified', {
      bundleId: 'AGENT_SPENDING_DATA',
      expiresAt: '2027-08-23T12:00:00.000Z',
      idempotencyKey: 'bff-agent',
    });
    assert.equal(granted.status, 201);
    const grant = granted.body as { consentId: string; dataCategories: string[]; purposeId: string };
    assert.equal(grant.purposeId, 'agent-assistance');
    assert.deepEqual(grant.dataCategories, ['TRANSACTION_DATA', 'PURCHASE_HISTORY']);
    const other = await call(world, 'GET', '/api/v1/data/consents', 'exchange');
    assert.equal(other.status, 200);
    assert.equal((other.body as { items: unknown[] }).items.length, 0);
    const revoked = await call(world, 'POST', `/api/v1/data/consents/${grant.consentId}/revoke`, 'basic_verified', {
      reason: 'stop agent spending',
      idempotencyKey: 'bff-revoke',
    });
    assert.equal(revoked.status, 200);
    assert.equal((revoked.body as { revocation: { historicalProcessingErased: boolean } }).revocation.historicalProcessingErased, false);
  });

  it('enrolls and withdraws HIN without closing financial services', async () => {
    const world = createSandboxWorld();
    const before = await call(world, 'GET', '/api/v1/hin/participation', 'basic_verified');
    assert.equal(before.status, 200);
    assert.equal((before.body as { state: string }).state, 'NOT_ENROLLED');
    const enrolled = await call(world, 'POST', '/api/v1/hin/participation/enroll', 'basic_verified', {
      expiresAt: '2027-08-23T12:00:00.000Z',
      idempotencyKey: 'bff-hin',
    });
    assert.equal(enrolled.status, 201);
    assert.equal((enrolled.body as { state: string; financialServicesRemainOpen: boolean }).state, 'ENROLLED');
    const withdrawn = await call(world, 'POST', '/api/v1/hin/participation/withdraw', 'basic_verified', {});
    assert.equal(withdrawn.status, 200);
    const body = withdrawn.body as { state: string; financialServicesRemainOpen: boolean };
    assert.equal(body.state, 'WITHDRAWN');
    assert.equal(body.financialServicesRemainOpen, true);
  });

  it('submits a rights request and records access history without raw values', async () => {
    const world = createSandboxWorld();
    const submitted = await call(world, 'POST', '/api/v1/data/rights/requests', 'basic_verified', {
      type: 'EXPORT',
      idempotencyKey: 'bff-export',
    });
    assert.equal(submitted.status, 201);
    assert.equal((submitted.body as { type: string }).type, 'EXPORT');
    world.dataRights.mayAccessData({
      actor: {
        actorId: world.personas.basic_verified.actorId,
        subjectId: world.runtime.identity.service.resolveActorContext(world.personas.basic_verified.actorId).ok
          ? (world.runtime.identity.service.resolveActorContext(world.personas.basic_verified.actorId) as { value: { subjectId: string } }).value.subjectId
          : world.personas.basic_verified.identityId,
      },
      subjectId: world.runtime.identity.service.resolveActorContext(world.personas.basic_verified.actorId).ok
        ? (world.runtime.identity.service.resolveActorContext(world.personas.basic_verified.actorId) as { value: { subjectId: string } }).value.subjectId
        : world.personas.basic_verified.identityId,
      category: 'TRANSACTION_DATA',
      purposeId: 'financial-analysis',
      requestedOperation: 'READ',
      actorKind: 'FIRST_PARTY_SERVICE',
      recordId: 'pda_ref',
    });
    const history = await call(world, 'GET', '/api/v1/data/access-history', 'basic_verified');
    assert.equal(history.status, 200);
    const text = JSON.stringify(history.body);
    assert.equal(text.includes('rawValueLogged":false') || text.includes('"rawValueLogged": false'), true);
    assert.equal(text.includes('salary'), false);
  });
});
