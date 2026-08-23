import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';

function call(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
) {
  const runtime: ConsumerBffRuntime = {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    hin: world.hin,
  };
  return handleConsumerBff(runtime, {
    method,
    path,
    query: {},
    body: {},
    authorization: `Bearer ${sandboxToken(persona)}`,
    requestId: `req_${method}_${path}`,
  });
}

describe('Consumer BFF HIN rights marketplace', () => {
  it('lists subject-scoped information rights without ownership transfer', () => {
    const world = createSandboxWorld();
    const listed = call(world, 'GET', '/api/v1/hin/rights', 'basic_verified');
    assert.equal(listed.status, 200);
    const body = listed.body as { items: { ownershipTransferred: boolean; usageRightOnly: boolean }[]; productionActivated: boolean };
    assert.equal(body.productionActivated, false);
    assert.ok(body.items.length > 0);
    assert.equal(body.items[0]?.ownershipTransferred, false);
    assert.equal(body.items[0]?.usageRightOnly, true);
  });

  it('shows active licenses and does not guarantee earnings', () => {
    const world = createSandboxWorld();
    const licenses = call(world, 'GET', '/api/v1/hin/licenses', 'basic_verified');
    assert.equal(licenses.status, 200);
    const earnings = call(world, 'GET', '/api/v1/hin/earnings', 'basic_verified');
    assert.equal(earnings.status, 200);
    const body = earnings.body as { guaranteed: boolean; compensationGuaranteed: boolean };
    assert.equal(body.guaranteed, false);
    assert.equal(body.compensationGuaranteed, false);
    const activity = call(world, 'GET', '/api/v1/hin/earnings/activity', 'basic_verified');
    assert.equal(activity.status, 200);
  });

  it('denies cross-user rights and hides licensee controls', () => {
    const world = createSandboxWorld();
    const other = call(world, 'GET', '/api/v1/hin/rights', 'exchange');
    assert.equal(other.status, 200);
    const body = other.body as { items: unknown[] };
    assert.equal(body.items.length, 0);
    const licensee = call(world, 'GET', '/api/v1/hin/licensee/credentials', 'basic_verified');
    assert.equal(licensee.status, 404);
  });

  it('pauses HIN participation', () => {
    const world = createSandboxWorld();
    const paused = call(world, 'POST', '/api/v1/hin/participation/pause', 'basic_verified');
    assert.equal(paused.status, 200);
    const participation = call(world, 'GET', '/api/v1/hin/participation', 'basic_verified');
    const body = participation.body as { status: string; compensationGuaranteed: boolean };
    assert.equal(body.status, 'PAUSED');
    assert.equal(body.compensationGuaranteed, false);
  });
});
