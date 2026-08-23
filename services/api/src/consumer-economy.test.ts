import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleConsumerBff } from './consumer/handler.ts';
import { createSandboxWorld, sandboxToken } from './consumer/fixtures.ts';
import { createNativeEconomySurface } from './consumer/native-economy-adapter.ts';
import { CONSUMER_RESOURCE_CATALOG } from './consumer/resources.ts';
import { CONSUMER_BFF_ROUTES } from './consumer/handler.ts';

function auth(persona: Parameters<typeof sandboxToken>[0]) {
  return `Bearer ${sandboxToken(persona)}`;
}

describe('Consumer BFF native economy', () => {
  it('catalogs the read-only economy resource and does not expose issuance routes', () => {
    const economy = CONSUMER_RESOURCE_CATALOG.find((row) => row.group === 'ECONOMY');
    assert.ok(economy);
    assert.deepEqual(economy?.methods, ['GET']);
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/economy'));
    assert.ok(CONSUMER_BFF_ROUTES.includes('GET /api/v1/economy/supply'));
    assert.ok(!CONSUMER_BFF_ROUTES.some((row) => row.includes('issuance') || row.includes('mint') || row.includes('burn')));
  });

  it('returns protocol-native SunRey and MoonRey supply without fabricating HIN metrics', () => {
    const world = createSandboxWorld();
    const res = handleConsumerBff(
      {
        bff: world.bff,
        sessions: world.sessions,
        identity: world.runtime.identity.service,
        nativeEconomy: createNativeEconomySurface(),
      },
      {
        method: 'GET',
        path: '/api/v1/economy',
        query: {},
        body: {},
        authorization: auth('basic_verified'),
      },
    );
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
    const world = createSandboxWorld();
    const runtime = {
      bff: world.bff,
      sessions: world.sessions,
      identity: world.runtime.identity.service,
      nativeEconomy: createNativeEconomySurface(),
    };
    const missing = handleConsumerBff(runtime, {
      method: 'GET',
      path: '/api/v1/economy/assets/USDT',
      query: {},
      body: {},
      authorization: auth('basic_verified'),
    });
    assert.equal(missing.status, 404);
    const mint = handleConsumerBff(runtime, {
      method: 'POST',
      path: '/api/v1/economy/issuance',
      query: {},
      body: { amount: '1' },
      authorization: auth('basic_verified'),
    });
    assert.ok(mint.status === 404 || mint.status === 405);
  });
});
