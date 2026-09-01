import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { handleConsumerBff } from '../services/api/src/consumer/handler.ts';
import { CONSUMER_BFF_ROUTES } from '../services/api/src/consumer/handler.ts';
import { buildWorldSnapshot } from '../packages/external-data/src/world-snapshot.ts';
import { buildAgentEvidenceCatalog } from '../packages/external-data/src/agent-evidence-catalog.ts';
import { createExternalDataPlane } from '../packages/external-data/src/plane.ts';
import { SIMULATION_INVENTORY } from '../packages/external-data/src/simulation-inventory.ts';
import { PRODUCT_DATA_STATES } from '../packages/external-data/src/product-data-state.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = '2026-08-31T12:00:00.000Z';

function runtime() {
  const world = createSandboxWorld();
  return Object.freeze({
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    payments: world.payments,
    worldExternalData: world.worldExternalData,
    environmental: world.environmental,
    travel: world.travel,
    agentExternalEvidence: world.agentExternalEvidence,
    productiveEconomy: world.productiveEconomy,
    exchange: world.exchange,
  });
}

async function call(method: string, path: string, query: Record<string, string> = {}) {
  const result = await Promise.resolve(
    await handleConsumerBff(runtime(), {
      method,
      path,
      query,
      body: {},
      authorization: `Bearer ${sandboxToken('basic_verified')}`,
      requestId: 'req_prompt25',
    }),
  );
  return result;
}

describe('Wave 7 Prompt 25 — product wiring contract tests', () => {
  it('registers new BFF routes', async () => {
    for (const route of [
      'GET /api/v1/world/snapshot',
      'GET /api/v1/grow/context',
      'GET /api/v1/travel/overview',
      'GET /api/v1/agent/external-evidence',
      'GET /api/v1/agent/external-events',
      'GET /api/v1/economy/productive/snapshot',
    ]) {
      assert.ok(CONSUMER_BFF_ROUTES.includes(route), `missing route ${route}`);
    }
  });

  it('world snapshot returns partial-success sections', async () => {
    const plane = createExternalDataPlane({ nowUtc: NOW });
    const snapshot = await buildWorldSnapshot(plane, { nowUtc: NOW });
    assert.equal(snapshot.schema, 'sunrey.world.snapshot.v1');
    assert.equal(snapshot.referenceOnly, true);
    assert.ok(snapshot.sections.economy);
    assert.ok(snapshot.sections.markets);
    assert.ok(snapshot.sections.resources);
    const lithium = (snapshot.sections.resources.data as { resources: { resourceType: string; status: string }[] })
      ?.resources?.find((r) => r.resourceType === 'lithium');
    assert.ok(lithium);
    assert.equal(lithium!.status, 'UNAVAILABLE');
  });

  it('GET /api/v1/world/snapshot returns vendor-neutral contract', async () => {
    const result = await call('GET', '/api/v1/world/snapshot');
    assert.equal(result.status, 200);
    const body = JSON.stringify(result.body);
    assert.equal(body.includes('api.coingecko.com'), false);
    assert.equal(body.includes('api_key'), false);
    assert.equal(body.includes('providerId'), false);
    assert.ok((result.body as { schema: string }).schema === 'sunrey.world.snapshot.v1');
  });

  it('GET /api/v1/grow/context exposes external context with dataState', async () => {
    const result = await call('GET', '/api/v1/grow/context');
    assert.equal(result.status, 200);
    const body = result.body as { schema: string; dataState: string; dataMode: string };
    assert.equal(body.schema, 'sunrey.grow.external-context.v1');
    assert.ok(PRODUCT_DATA_STATES.includes(body.dataState as (typeof PRODUCT_DATA_STATES)[number]));
    assert.ok(body.dataMode);
  });

  it('GET /api/v1/travel/overview is reference-only', async () => {
    const result = await call('GET', '/api/v1/travel/overview', { destLat: '48.8566', destLon: '2.3522' });
    assert.equal(result.status, 200);
    const body = result.body as { referenceOnly: boolean; bookingAuthorized: boolean };
    assert.equal(body.referenceOnly, true);
    assert.equal(body.bookingAuthorized, false);
  });

  it('GET /api/v1/agent/external-evidence never grants execution authority', async () => {
    const plane = createExternalDataPlane({ nowUtc: NOW });
    const catalog = await buildAgentEvidenceCatalog(plane, { nowUtc: NOW });
    assert.equal(catalog.grantsExecutionAuthority, false);

    const result = await call('GET', '/api/v1/agent/external-evidence');
    assert.equal(result.status, 200);
    const body = result.body as { grantsExecutionAuthority: false; categories: unknown[] };
    assert.equal(body.grantsExecutionAuthority, false);
    assert.ok(body.categories.length > 0);
  });

  it('GET /api/v1/agent/external-events uses canonical events', async () => {
    const result = await call('GET', '/api/v1/agent/external-events');
    assert.equal(result.status, 200);
    const body = result.body as { schema: string; autoNotify: false; events: unknown[] };
    assert.equal(body.schema, 'sunrey.bff.action-center.external-events.v1');
    assert.equal(body.autoNotify, false);
    assert.ok(Array.isArray(body.events));
  });

  it('GET /api/v1/world/resources/lithium returns UNAVAILABLE not fabricated price', async () => {
    const result = await call('GET', '/api/v1/world/resources/lithium');
    assert.equal(result.status, 200);
    const body = result.body as { dataState: string; priceMinorUnits: null };
    assert.equal(body.dataState, 'UNAVAILABLE');
    assert.equal(body.priceMinorUnits, null);
  });

  it('GET /api/v1/economy/productive/snapshot is analytics-only', async () => {
    const result = await call('GET', '/api/v1/economy/productive/snapshot');
    assert.equal(result.status, 200);
    const body = result.body as { analyticsOnly: true; issuanceAuthority: false };
    assert.equal(body.analyticsOnly, true);
    assert.equal(body.issuanceAuthority, false);
  });

  it('world fx BFF response excludes providerId', async () => {
    const result = await call('GET', '/api/v1/world/fx');
    assert.equal(result.status, 200);
    const body = JSON.stringify(result.body);
    assert.equal(body.includes('providerId'), false);
    assert.ok(body.includes('dataState'));
  });

  it('simulation inventory exists with classifications', async () => {
    assert.ok(SIMULATION_INVENTORY.length >= 10);
    const classifications = new Set(SIMULATION_INVENTORY.map((row) => row.classification));
    assert.ok(classifications.has('KEEP_FOR_TEST'));
    assert.ok(classifications.has('LIVE_SOURCE_NOT_AVAILABLE'));
  });

  it('frontend security — built SDK has no provider API keys', async () => {
    const clientPath = join(ROOT, 'packages/sunrey-sdk/src/consumer-bff/client.ts');
    const source = readFileSync(clientPath, 'utf8');
    assert.equal(/FRED_API_KEY|COINGECKO|api\.open-meteo|api_key/i.test(source), false);
  });

  it('end-to-end product flow through BFF without vendor awareness', async () => {
    const routes = [
      '/api/v1/me/home',
      '/api/v1/world/snapshot',
      '/api/v1/grow/context',
      '/api/v1/exchange',
      '/api/v1/travel/overview',
      '/api/v1/world/resources/gold',
    ];
    for (const path of routes) {
      const result = await call('GET', path);
      assert.ok(result.status >= 200 && result.status < 500, `${path} failed with ${result.status}`);
      const serialized = JSON.stringify(result.body);
      assert.equal(serialized.includes('api.coingecko.com'), false, path);
      assert.equal(serialized.includes('sk_live'), false, path);
    }
  });
});
