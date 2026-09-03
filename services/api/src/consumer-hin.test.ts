import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { createSandboxRightsMarketplace } from '../../../packages/information-market/src/rights-marketplace/index.ts';
import { CONSUMER_BFF_ROUTES, handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';
import { createHinContributionSurface } from './consumer/hin-adapter.ts';
import { CONSUMER_RESOURCE_CATALOG } from './consumer/resources.ts';
import type { ConsumerBff } from './consumer/orchestrator.ts';
import type { BffPrincipal } from './consumer/ports.ts';
import { sandboxToken } from './consumer/sandbox-personas.ts';
import type { SessionDirectory } from './consumer/session.ts';

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
    capabilities: Object.freeze(['VIEW_ACCOUNT']),
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

const TOKEN = 'sandbox.basic_verified';

function contributionPrincipal(): BffPrincipal {
  return {
    actorId: 'actor_basic',
    customerId: 'cust_basic',
    identityId: 'idn_basic',
    sessionId: 'sess_basic',
    jurisdiction: 'GB',
    verification: 'VERIFIED',
    customerStatus: 'ACTIVE',
    identityStatus: 'VERIFIED',
    capabilities: ['VIEW_ACCOUNT'],
    risk: 'LOW',
    restricted: false,
    sandboxPersona: 'basic_verified',
    deviceSummary: { deviceId: 'dev_basic', trustState: 'TRUSTED' },
  };
}

function contributionRuntime(): ConsumerBffRuntime {
  const sessions: SessionDirectory = new Map([[TOKEN, contributionPrincipal()]]);
  return {
    bff: {
      featureStub: (group: string) =>
        Object.freeze({
          group,
          availability: 'AVAILABLE_SIMULATION',
          productionActive: false,
        }),
    } as unknown as ConsumerBff,
    sessions,
    hinContributions: createHinContributionSurface(),
  };
}

describe('Consumer BFF HIN contributions', () => {
  it('catalogs the read-only HIN resource and does not expose verification or issuance routes', () => {
    const hin = CONSUMER_RESOURCE_CATALOG.find((row) => row.group === 'HIN');
    assert.ok(hin);
    assert.deepEqual(hin?.methods, ['GET']);
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/hin/contributions'));
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/hin/metrics'));
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/hin/me/summary'));
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/hin/valuation-methodologies'));
    assert.ok(!CONSUMER_BFF_ROUTES.some((row) => row.includes('hin') && (row.includes('verify') || row.includes('issuance') || row.includes('mint'))));
  });

  it('returns customer contributions and aggregate metrics without raw personal data', () => {
    const runtime = contributionRuntime();
    const list = handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/hin/contributions',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(list.status, 200);
    const body = list.body as { items: readonly { containsRawPersonalData: boolean; issuancePromised: boolean }[] };
    assert.equal(body.items.length >= 1, true);
    assert.equal(body.items[0]?.containsRawPersonalData, false);
    assert.equal(body.items[0]?.issuancePromised, false);

    const metrics = handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/hin/metrics',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(metrics.status, 200);
    const aggregate = metrics.body as { suppression: { individualRecordsExposed: boolean }; economicValueInputs: { isMintAmount: boolean } };
    assert.equal(aggregate.suppression.individualRecordsExposed, false);
    assert.equal(aggregate.economicValueInputs.isMintAmount, false);

    const summary = handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/hin/me/summary',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(summary.status, 200);
    const me = summary.body as { issuancePromised: boolean; compensation: { mintRequested: boolean } };
    assert.equal(me.issuancePromised, false);
    assert.equal(me.compensation.mintRequested, false);
  });

  it('rejects privileged verify and mint posts', () => {
    const runtime = contributionRuntime();
    const verify = handleConsumerBff(runtime, {
      method: 'POST',
      path: '/api/v1/hin/contributions/hec_1/verify',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.ok(verify.status === 404 || verify.status === 405);
    const mint = handleConsumerBff(runtime, {
      method: 'POST',
      path: '/api/v1/hin/issuance',
      query: {},
      body: { amount: '1' },
      authorization: `Bearer ${TOKEN}`,
    });
    assert.ok(mint.status === 404 || mint.status === 405);
  });
});
