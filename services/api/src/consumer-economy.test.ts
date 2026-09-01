import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { callConsumerBffSync, CONSUMER_BFF_ROUTES, type ConsumerBffRuntime } from './consumer/sync-call.ts';
import { createNativeEconomySurface } from './consumer/native-economy-adapter.ts';
import { createProductiveEconomySurface } from './consumer/productive-economy-adapter.ts';
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

function economyRuntime(): ConsumerBffRuntime {
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
    nativeEconomy: createNativeEconomySurface(),
    productiveEconomy: createProductiveEconomySurface(),
  };
}

describe('Consumer BFF native economy', () => {
  it('catalogs the read-only economy resource and does not expose issuance routes', () => {
    const economy = CONSUMER_RESOURCE_CATALOG.find((row) => row.group === 'ECONOMY');
    assert.ok(economy);
    assert.deepEqual(economy?.methods, ['GET']);
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/economy'));
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/economy/supply'));
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/economy/productive'));
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/economy/productive/moonrey-input'));
    assert.ok(!CONSUMER_BFF_ROUTES.some((row) => row.includes('issuance') || row.includes('mint') || row.includes('burn')));
  });

  it('returns protocol-native SunRey and MoonRey supply without fabricating HIN metrics', () => {
    const res = callConsumerBffSync(economyRuntime(), {
      method: 'GET',
      path: '/api/v1/economy',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(res.status, 200);
    const body = res.body as {
      schema: string;
      productionActive: boolean;
      sunrey: { protocolNative: boolean; hinMetrics: { available: boolean }; marketPrice: { valuationDoesNotSetPrice: boolean } };
      moonrey: { protocolNative: boolean; approvedUnderlyingMetrics: unknown[]; productiveCategories: { connected: boolean }[] };
    };
    assert.equal(body.schema, 'sunrey.consumer.native-economy.v1');
    assert.equal(body.productionActive, false);
    assert.equal(body.sunrey.protocolNative, true);
    assert.equal(body.moonrey.protocolNative, true);
    assert.equal(body.sunrey.hinMetrics.available, false);
    assert.equal(body.moonrey.approvedUnderlyingMetrics.length, 0);
    assert.ok(body.moonrey.productiveCategories.every((row) => row.connected === false));
    assert.equal(body.sunrey.marketPrice.valuationDoesNotSetPrice, true);
  });

  it('rejects unknown assets and privileged POST issuance', () => {
    const runtime = economyRuntime();
    const missing = callConsumerBffSync(runtime, {
      method: 'GET',
      path: '/api/v1/economy/assets/USDT',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(missing.status, 404);
    const mint = callConsumerBffSync(runtime, {
      method: 'POST',
      path: '/api/v1/economy/issuance',
      query: {},
      body: { amount: '1' },
      authorization: `Bearer ${TOKEN}`,
    });
    assert.ok(mint.status === 404 || mint.status === 405);
  });

  it('returns verified productive-economy metrics without minting', () => {
    const res = callConsumerBffSync(economyRuntime(), {
      method: 'GET',
      path: '/api/v1/economy/productive',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(res.status, 200);
    const body = res.body as {
      schema: string;
      productionActive: boolean;
      categories: { id: string; connected: boolean; metric: string | null }[];
      moonreyInput: { minted: boolean; marketPriceSet: boolean };
    };
    assert.equal(body.schema, 'sunrey.consumer.productive-economy.v1');
    assert.equal(body.productionActive, false);
    assert.ok(body.categories.some((row) => row.id === 'ENERGY' && row.connected && row.metric === 'ENERGY_PRODUCTION'));
    assert.equal(body.moonreyInput.minted, false);
    assert.equal(body.moonreyInput.marketPriceSet, false);

    const sources = callConsumerBffSync(economyRuntime(), {
      method: 'GET',
      path: '/api/v1/economy/productive/sources',
      query: {},
      body: {},
      authorization: `Bearer ${TOKEN}`,
    });
    assert.equal(sources.status, 200);
    const sourceBody = sources.body as { items: { rawWithheld: boolean }[] };
    assert.ok(sourceBody.items.some((row) => row.rawWithheld));
  });
});
