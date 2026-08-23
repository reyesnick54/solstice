import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { createSandboxRightsMarketplace } from '../../../packages/information-market/src/rights-marketplace/index.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';
import type { BffPrincipal } from './consumer/ports.ts';
import { sandboxToken } from './consumer/sandbox-personas.ts';

const NOW = asUtcInstant('2026-08-23T08:00:00.000Z');

function principal(customerId: string, persona: 'basic_verified' | 'exchange'): BffPrincipal {
  return Object.freeze({
    actorId: `actor_${persona}`,
    customerId,
    identityId: `idn_${persona}`,
    sessionId: `ses_${persona}`,
    jurisdiction: 'GB',
    verification: 'VERIFIED',
    customerStatus: 'ACTIVE',
    identityStatus: 'ACTIVE',
    capabilities: Object.freeze([]),
    risk: 'LOW',
    restricted: false,
    sandboxPersona: persona,
    deviceSummary: Object.freeze({ deviceId: null, trustState: null }),
  });
}

function hinRuntime(): ConsumerBffRuntime {
  const basic = principal('cust_sandbox_basic', 'basic_verified');
  const other = principal('cust_sandbox_exchange', 'exchange');
  const sessions = new Map([
    [sandboxToken('basic_verified'), basic],
    [sandboxToken('exchange'), other],
  ]);
  return {
    bff: {} as ConsumerBffRuntime['bff'],
    sessions,
    hin: createSandboxRightsMarketplace(new FrozenClock(NOW), basic.customerId),
  };
}

function call(runtime: ConsumerBffRuntime, method: string, path: string, persona: 'basic_verified' | 'exchange') {
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
    const runtime = hinRuntime();
    const listed = call(runtime, 'GET', '/api/v1/hin/rights', 'basic_verified');
    assert.equal(listed.status, 200);
    const body = listed.body as { items: { ownershipTransferred: boolean; usageRightOnly: boolean }[]; productionActivated: boolean };
    assert.equal(body.productionActivated, false);
    assert.ok(body.items.length > 0);
    assert.equal(body.items[0]?.ownershipTransferred, false);
    assert.equal(body.items[0]?.usageRightOnly, true);
  });

  it('shows active licenses and does not guarantee earnings', () => {
    const runtime = hinRuntime();
    const licenses = call(runtime, 'GET', '/api/v1/hin/licenses', 'basic_verified');
    assert.equal(licenses.status, 200);
    const earnings = call(runtime, 'GET', '/api/v1/hin/earnings', 'basic_verified');
    assert.equal(earnings.status, 200);
    const body = earnings.body as { guaranteed: boolean; compensationGuaranteed: boolean };
    assert.equal(body.guaranteed, false);
    assert.equal(body.compensationGuaranteed, false);
    const activity = call(runtime, 'GET', '/api/v1/hin/earnings/activity', 'basic_verified');
    assert.equal(activity.status, 200);
  });

  it('denies cross-user rights and hides licensee controls', () => {
    const runtime = hinRuntime();
    const other = call(runtime, 'GET', '/api/v1/hin/rights', 'exchange');
    assert.equal(other.status, 200);
    const body = other.body as { items: unknown[] };
    assert.equal(body.items.length, 0);
    const licensee = call(runtime, 'GET', '/api/v1/hin/licensee/credentials', 'basic_verified');
    assert.equal(licensee.status, 404);
  });

  it('pauses HIN participation', () => {
    const runtime = hinRuntime();
    const paused = call(runtime, 'POST', '/api/v1/hin/participation/pause', 'basic_verified');
    assert.equal(paused.status, 200);
    const participation = call(runtime, 'GET', '/api/v1/hin/participation', 'basic_verified');
    const body = participation.body as { status: string; compensationGuaranteed: boolean };
    assert.equal(body.status, 'PAUSED');
    assert.equal(body.compensationGuaranteed, false);
  });
});
