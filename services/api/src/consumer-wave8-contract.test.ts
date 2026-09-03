import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff, type ConsumerBffRuntime } from './consumer/handler.ts';
import { WAVE8_BFF_ROUTES } from './consumer/wave8-dispatch.ts';
import { createNativeEconomySurface } from './consumer/native-economy-adapter.ts';
import { createProductiveEconomySurface } from './consumer/productive-economy-adapter.ts';
import { createHinContributionSurface } from './consumer/hin-adapter.ts';
import { consumerContractManifest } from './consumer/api-contract.ts';
import { classifyEndpoint } from './consumer/domains.ts';
import { authorizeConsumerRoute } from './consumer/authorization.ts';
import type { ConsumerBff } from './consumer/orchestrator.ts';
import type { BffPrincipal } from './consumer/ports.ts';
import type { SessionDirectory } from './consumer/session.ts';
import { unwrapBff } from './consumer/bff-test-utils.ts';

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
    capabilities: ['VIEW_ACCOUNT', 'VIEW_ECONOMIC_GRAPH', 'EXCHANGE_VIEW'],
    risk: 'LOW',
    restricted: false,
    sandboxPersona: 'basic_verified',
    deviceSummary: { deviceId: 'dev_basic', trustState: 'TRUSTED' },
  };
}

function restrictedPrincipal(): BffPrincipal {
  return { ...principal(), restricted: true, capabilities: ['VIEW_ACCOUNT'] };
}

function runtime(): ConsumerBffRuntime {
  const sessions: SessionDirectory = new Map([[TOKEN, principal()]]);
  return {
    bff: {
      home: () =>
        Object.freeze({
          pendingApprovals: [
            {
              actionId: 'act_home_1',
              kind: 'PAYMENT_APPROVAL',
              status: 'AWAITING_APPROVAL',
              title: 'Approve payment',
              detail: 'Payment awaiting approval',
              createdAt: '2026-08-01T00:00:00.000Z',
            },
          ],
        }),
      featureStub: (group: string) =>
        Object.freeze({ group, availability: 'AVAILABLE_SIMULATION', productionActive: false }),
    } as unknown as ConsumerBff,
    sessions,
    nativeEconomy: createNativeEconomySurface(),
    productiveEconomy: createProductiveEconomySurface(),
    hinContributions: createHinContributionSurface(),
  };
}

function get(path: string, token: string | null = TOKEN, query: Record<string, string> = {}) {
  return unwrapBff(handleConsumerBff(runtime(), {
    method: 'GET',
    path,
    query,
    body: {},
    authorization: token ? `Bearer ${token}` : undefined,
    requestId: 'req_wave8_contract',
  }));
}

describe('Wave 8 consumer contract — Home', () => {
  it('requires authentication on home', () => {
    const res = get('/api/v1/me/home', null);
    assert.equal(res.status, 401);
  });

  it('returns home with contract headers', () => {
    const res = get('/api/v1/me/home');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-sunrey-contract-version'], '1.0.0-wave8');
  });
});

describe('Wave 8 consumer contract — SunRey', () => {
  it('registers SunRey domain routes', () => {
    assert.ok(WAVE8_BFF_ROUTES.includes('GET /api/v1/sunrey/supply'));
    assert.ok(WAVE8_BFF_ROUTES.includes('GET /api/v1/sunrey/peve'));
  });

  it('returns supply without mint endpoints', () => {
    const res = get('/api/v1/sunrey/supply');
    assert.equal(res.status, 200);
    const body = res.body as { schema: string; protocolNative: boolean; valuationDoesNotSetPrice: boolean };
    assert.equal(body.schema, 'sunrey.consumer.sunrey.supply.v1');
    assert.equal(body.protocolNative, true);
    assert.equal(body.valuationDoesNotSetPrice, true);
  });

  it('returns PEVE only for verified principals', () => {
    const ok = get('/api/v1/sunrey/peve');
    assert.equal(ok.status, 200);
    assert.equal((ok.body as { authorized: boolean }).authorized, true);
    assert.equal((ok.body as { isMintFormula: boolean }).isMintFormula, false);

    const sessions: SessionDirectory = new Map([[TOKEN, restrictedPrincipal()]]);
    const denied = handleConsumerBff(
      { ...runtime(), sessions },
      {
        method: 'GET',
        path: '/api/v1/sunrey/peve',
        query: {},
        body: {},
        authorization: `Bearer ${TOKEN}`,
        requestId: 'req_peve_denied',
      },
    );
    assert.equal(denied.status, 403);
  });

  it('does not expose raw HIN in contribution history', () => {
    const res = get('/api/v1/sunrey/contributions/history');
    assert.equal(res.status, 200);
    const body = res.body as { items: { containsRawPersonalData: false }[]; issuancePromised: false };
    assert.equal(body.issuancePromised, false);
    for (const row of body.items) {
      assert.equal(row.containsRawPersonalData, false);
    }
  });
});

describe('Wave 8 consumer contract — MoonRey', () => {
  it('states GPUV is not market price', () => {
    const res = get('/api/v1/moonrey/gpuv');
    assert.equal(res.status, 200);
    const body = res.body as {
      gpuvIsNotMarketPrice: boolean;
      gpuvIsNotMoonReyQuantity: boolean;
      gpuvIsNotExchangePrice: boolean;
      productionValuationActive: false;
    };
    assert.equal(body.gpuvIsNotMarketPrice, true);
    assert.equal(body.gpuvIsNotMoonReyQuantity, true);
    assert.equal(body.gpuvIsNotExchangePrice, true);
    assert.equal(body.productionValuationActive, false);
  });

  it('classifies moonrey domain as SIMULATION', () => {
    assert.equal(classifyEndpoint('/api/v1/moonrey/supply', 'GET'), 'SIMULATION');
  });
});

describe('Wave 8 consumer contract — Action Center', () => {
  it('unifies durable backend actions', () => {
    const res = get('/api/v1/actions');
    assert.equal(res.status, 200);
    const body = res.body as {
      schema: string;
      frontendIsNotSourceOfTruth: boolean;
      items: { durableSource: string }[];
    };
    assert.equal(body.schema, 'sunrey.consumer.action-center.unified.v1');
    assert.equal(body.frontendIsNotSourceOfTruth, true);
    assert.ok(body.items.some((row) => row.durableSource.includes('pendingApprovals')));
  });

  it('supports SSE stream for actions', () => {
    const res = handleConsumerBff(runtime(), {
      method: 'GET',
      path: '/api/v1/actions/stream',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
      accept: 'text/event-stream',
      requestId: 'req_sse',
    });
    assert.equal(res.status, 200);
    assert.ok(String(res.headers['content-type']).includes('text/event-stream'));
  });
});

describe('Wave 8 consumer contract — policy failure', () => {
  it('denies restricted principals on regulated wallet routes', () => {
    const sessions: SessionDirectory = new Map([[TOKEN, restrictedPrincipal()]]);
    const res = handleConsumerBff(
      { ...runtime(), sessions },
      {
        method: 'POST',
        path: '/api/v1/wallets/withdrawals',
        query: {},
        body: { quantity: '100' },
        authorization: `Bearer ${TOKEN}`,
        requestId: 'req_wallet_denied',
      },
    );
    assert.equal(res.status, 403);
    const body = res.body as { errorCode: string };
    assert.equal(body.errorCode, 'POLICY_DENIED');
  });

  it('authorizeConsumerRoute returns POLICY_DENIED for restricted', () => {
    const err = authorizeConsumerRoute(restrictedPrincipal(), 'GET', '/api/v1/exchange', 'req_auth');
    assert.ok(err);
    assert.equal(err.errorCode, 'POLICY_DENIED');
  });
});

describe('Wave 8 consumer contract — catalog', () => {
  it('publishes API contract manifest', () => {
    const res = get('/api/v1/catalog/contract');
    assert.equal(res.status, 200);
    const body = res.body as ReturnType<typeof consumerContractManifest>;
    assert.equal(body.productionActive, false);
    assert.ok(body.domains.some((d) => d.domain === 'sunrey'));
    assert.ok(body.deprecations.length > 0);
  });

  it('exposes status semantics enums', () => {
    const res = get('/api/v1/catalog/status-semantics');
    assert.equal(res.status, 200);
    const body = res.body as { blockchainTxStatus: string[]; economicClaimStatus: string[] };
    assert.ok(body.blockchainTxStatus.includes('FINALIZED'));
    assert.ok(body.economicClaimStatus.includes('AWAITING_GOVERNANCE'));
    assert.ok(!body.economicClaimStatus.includes('COMPLETE'));
  });
});

describe('Wave 8 consumer contract — Exchange and Grow stubs', () => {
  it('classifies exchange as SIMULATION', () => {
    assert.equal(classifyEndpoint('/api/v1/exchange', 'GET'), 'SIMULATION');
  });

  it('classifies grow as SIMULATION', () => {
    assert.equal(classifyEndpoint('/api/v1/grow', 'GET'), 'SIMULATION');
  });
});
