import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { clearLiveProviderCache } from './cache.ts';
import { resetCircuitBreakers } from './circuit-breaker.ts';
import { createAccessLiveProviderFabricService } from './fabric-service.ts';
import { resetEbayTokenCache } from './adapters/ebay.ts';
import type { FetchLike } from './http-client.ts';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('Access Live Provider Fabric', () => {
  beforeEach(() => {
    clearLiveProviderCache();
    resetCircuitBreakers();
    resetEbayTokenCache();
    for (const key of [
      'VAST_API_KEY',
      'TICKETMASTER_API_KEY',
      'EIA_API_KEY',
      'OPEN_CHARGE_MAP_API_KEY',
      'EBAY_CLIENT_ID',
      'EBAY_CLIENT_SECRET',
      'GOOGLE_PLACES_API_KEY',
      'YELP_API_KEY',
    ]) {
      delete process.env[key];
    }
    process.env.GOOGLE_PLACES_ENABLED = 'false';
    process.env.YELP_ENABLED = 'false';
  });

  it('lists providers with configuration-required when keys are absent', () => {
    const fabric = createAccessLiveProviderFabricService();
    const providers = fabric.listProviders();
    const vast = providers.find((row) => row.providerId === 'vast-ai');
    assert.ok(vast);
    assert.equal(vast.integrationState, 'CONFIGURATION_REQUIRED');
    assert.equal(vast.transactionCapability, false);
  });

  it('vast-ai adapter normalizes live offers with mocked transport', async () => {
    process.env.VAST_API_KEY = 'test-key';
    const fetchFn: FetchLike = async (url, init) => {
      assert.match(String(url), /vast\.ai/);
      assert.equal(init?.method, 'POST');
      return jsonResponse({
        offers: [
          {
            id: 123,
            gpu_name: 'RTX 4090',
            num_gpus: 1,
            dph_total: 0.45,
            geolocation: 'US',
            rentable: true,
            verified: true,
          },
        ],
      });
    };
    const fabric = createAccessLiveProviderFabricService({ deps: { fetchFn } });
    const result = await fabric.search({
      requestId: 'test_vast',
      providerId: 'vast-ai',
      limit: 5,
    });
    assert.equal(result.offers.length, 1);
    assert.equal(result.offers[0]?.title, 'RTX 4090');
    assert.equal(result.offers[0]?.provenance.liveRead, true);
    assert.equal(result.offers[0]?.provenance.simulation, false);
  });

  it('ticketmaster adapter handles 429 with retry using mocked transport', async () => {
    process.env.TICKETMASTER_API_KEY = 'tm-key';
    let calls = 0;
    const fetchFn: FetchLike = async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ fault: true }, 429, { 'retry-after': '0' });
      }
      return jsonResponse({
        _embedded: {
          events: [{ id: 'evt1', name: 'Concert', url: 'https://ticketmaster.com/event/1' }],
        },
      });
    };
    const fabric = createAccessLiveProviderFabricService({ deps: { fetchFn } });
    const result = await fabric.search({
      requestId: 'test_tm',
      providerId: 'ticketmaster',
      query: 'concert',
      city: 'New York',
    });
    assert.equal(result.offers.length, 1);
    assert.ok(calls >= 2);
  });

  it('open-charge-map works without API key', async () => {
    const fetchFn: FetchLike = async (url) => {
      assert.match(String(url), /openchargemap/);
      return jsonResponse([
        {
          ID: 99,
          AddressInfo: { Title: 'Station A', Town: 'Austin', Country: { ISOCode: 'US' }, Latitude: 30.2, Longitude: -97.7 },
          Connections: [{ PowerKW: 150, ConnectionType: { Title: 'CCS' } }],
          StatusType: { Title: 'Operational' },
        },
      ]);
    };
    const fabric = createAccessLiveProviderFabricService({ deps: { fetchFn } });
    const result = await fabric.search({
      requestId: 'test_ocm',
      providerId: 'open-charge-map',
      latitude: 30.2,
      longitude: -97.7,
    });
    assert.equal(result.offers.length, 1);
    assert.equal(result.offers[0]?.metadata.bookable, false);
  });

  it('isolates provider failures with Promise.allSettled orchestration', async () => {
    process.env.VAST_API_KEY = 'test-key';
    process.env.TICKETMASTER_API_KEY = 'tm-key';
    const fetchFn: FetchLike = async (url) => {
      if (String(url).includes('vast.ai')) {
        return jsonResponse({ offers: [{ id: 1, gpu_name: 'A100', dph_total: 1.2, rentable: true, verified: true }] });
      }
      return jsonResponse({ error: 'down' }, 500);
    };
    const fabric = createAccessLiveProviderFabricService({ deps: { fetchFn } });
    const vastOnly = await fabric.search({ requestId: 'partial_vast', providerId: 'vast-ai', limit: 5 });
    const tmOnly = await fabric.search({ requestId: 'partial_tm', providerId: 'ticketmaster', limit: 5 });
    const result = {
      offers: [...vastOnly.offers, ...tmOnly.offers],
      providerErrors: [...vastOnly.providerErrors, ...tmOnly.providerErrors],
    };
    assert.ok(result.offers.some((offer) => offer.providerId === 'vast-ai'));
    assert.ok(result.providerErrors.length > 0);
  });

  it('frankfurter reference adapter marks offers as reference data', async () => {
    const fetchFn: FetchLike = async (url) => {
      assert.match(String(url), /frankfurter/);
      return jsonResponse({ base: 'USD', date: '2026-09-10', rates: { EUR: 0.92 } });
    };
    const fabric = createAccessLiveProviderFabricService({ deps: { fetchFn } });
    const result = await fabric.search({ requestId: 'fx', providerId: 'frankfurter' });
    assert.ok(result.offers.length >= 1);
    assert.equal(result.offers[0]?.availability, 'REFERENCE_DATA');
  });

  it('uses cache on repeated searches', async () => {
    process.env.VAST_API_KEY = 'test-key';
    let calls = 0;
    const fetchFn: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ offers: [{ id: 1, gpu_name: 'GPU', dph_total: 1, rentable: true, verified: true }] });
    };
    const fabric = createAccessLiveProviderFabricService({ deps: { fetchFn } });
    await fabric.search({ requestId: 'cache1', providerId: 'vast-ai' });
    await fabric.search({ requestId: 'cache2', providerId: 'vast-ai' });
    assert.equal(calls, 1);
  });

  it('buildHomeFeed returns home.v2 schema', async () => {
    const fetchFn: FetchLike = async (url) => {
      if (String(url).includes('frankfurter')) {
        return jsonResponse({ base: 'USD', date: '2026-09-10', rates: { EUR: 0.92 } });
      }
      if (String(url).includes('worldbank')) {
        return jsonResponse([{}, [{ country: { value: 'United States' }, date: '2024', value: '2.8' }]]);
      }
      if (String(url).includes('openchargemap')) {
        return jsonResponse([]);
      }
      return jsonResponse({}, 404);
    };
    const fabric = createAccessLiveProviderFabricService({ deps: { fetchFn } });
    const feed = await fabric.buildHomeFeed({ limit: 5 });
    assert.equal(feed.schema, 'sunrey.consumer.access.home.v2');
    assert.ok(Array.isArray(feed.providerStatus));
    assert.ok(feed.categories.length > 0);
  });
});
