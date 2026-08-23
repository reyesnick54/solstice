import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff, CONSUMER_BFF_ROUTES, type ConsumerBffRuntime } from './consumer/handler.ts';
import { createHinContributionSurface } from './consumer/hin-adapter.ts';
import { CONSUMER_RESOURCE_CATALOG } from './consumer/resources.ts';
import type { ConsumerBff } from './consumer/orchestrator.ts';
import type { BffPrincipal } from './consumer/ports.ts';
import type { SessionDirectory } from './consumer/session.ts';

const TOKEN = 'sandbox.basic_verified';

function principal(): BffPrincipal {
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

function hinRuntime(): ConsumerBffRuntime {
  const sessions: SessionDirectory = new Map([[TOKEN, principal()]]);
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
    hin: createHinContributionSurface(),
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
    const runtime = hinRuntime();
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
    const runtime = hinRuntime();
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
