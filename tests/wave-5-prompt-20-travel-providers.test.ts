import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createTravelProviderRuntime,
  createTravelIntelligenceSandbox,
  TRAVEL_ADAPTER_IDS,
  toTravelAgentEvidence,
  validateBoundingBox,
  clampResultLimit,
  privacySafeLogFields,
  TRAVEL_QUERY_LIMITS,
} from '../packages/sunrey-chain/src/travel-intelligence/index.ts';
import { createEnvironmentalOracleSandbox } from '../packages/sunrey-chain/src/environmental-oracle/index.ts';
import { dispatchTravel } from '../services/api/src/consumer/travel.ts';
import { createCanonicalToolRegistry } from '../packages/sunrey-agent/src/tools/catalog.ts';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

describe('Wave 5 Prompt 20 travel providers', () => {
  it('registers all 9 travel providers from catalog', () => {
    const runtime = createTravelProviderRuntime({ mode: 'simulation' });
    assert.equal(TRAVEL_ADAPTER_IDS.length, 9);
    assert.equal(runtime.registry.list().length, 9);
    for (const id of TRAVEL_ADAPTER_IDS) {
      assert.ok(runtime.registry.has(id), `missing provider ${id}`);
    }
  });

  it('catalog contains only Wave 5 travel provider entries', () => {
    const catalog = parseYaml(readFileSync('config/providers/wave5-travel-catalog-entries.yaml', 'utf8'));
    const ids = catalog.providers.map((p: { provider_id: string }) => p.provider_id);
    assert.equal(ids.length, 9);
    for (const id of TRAVEL_ADAPTER_IDS) {
      assert.ok(ids.includes(id), `catalog missing ${id}`);
    }
  });

  it('returns aircraft positions with bounded results', () => {
    const svc = createTravelIntelligenceSandbox();
    const result = svc.getAircraftPositions(
      Object.freeze({ minLat: 40, maxLat: 50, minLon: -80, maxLon: -70 }),
      10,
    );
    assert.ok(result.data.length > 0);
    assert.equal(result.providerId, 'opensky');
    assert.ok(result.data[0]!.aircraft.icao24);
    assert.ok(result.data[0]!.aircraft.tailNumber);
  });

  it('preserves aircraft identity fields', () => {
    const svc = createTravelIntelligenceSandbox();
    const result = svc.getAircraftPositions(
      Object.freeze({ minLat: 40, maxLat: 50, minLon: -35, maxLon: -25 }),
      1,
    );
    const obs = result.data[0]!;
    assert.equal(obs.aircraft.icao24, '710258');
    assert.equal(obs.aircraft.registration, 'HZ-AK18');
    assert.equal(obs.aircraft.aircraftModel, 'A320');
  });

  it('resolves airport identity canonically', () => {
    const svc = createTravelIntelligenceSandbox();
    const result = svc.getAirport('RUH');
    assert.ok(result.data);
    assert.equal(result.data!.iata, 'RUH');
    assert.equal(result.data!.icao, 'OERK');
    assert.equal(result.data!.country, 'SA');
    assert.ok(result.data!.location.latitude);
  });

  it('normalizes entry requirements with freshness', () => {
    const svc = createTravelIntelligenceSandbox();
    const result = svc.getEntryRequirements('US', 'SA');
    assert.ok(result.data.length > 0);
    assert.equal(result.data[0]!.referenceOnly, true);
    assert.ok(result.data[0]!.freshness.retrievedAt);
    assert.ok(result.data[0]!.sourceUrl);
  });

  it('warns on stale entry rules', () => {
    const svc = createTravelIntelligenceSandbox();
    const result = svc.getEntryRequirements('US', 'SA');
    const stale = result.data.find((r) => r.freshness.freshnessStatus === 'stale');
    assert.ok(stale);
    assert.ok(result.warnings.length > 0 || result.stale);
  });

  it('returns transit routes and departures', () => {
    const svc = createTravelIntelligenceSandbox();
    const routes = svc.searchTransit('Zurich', 5);
    assert.ok(routes.data.length > 0);
    assert.equal(routes.data[0]!.mode, 'RAIL');

    const departures = svc.getTransitDepartures('8503000', 5);
    assert.ok(departures.data.length > 0);
    assert.ok(departures.data[0]!.scheduledTime);
  });

  it('returns EV charger locations without fake availability', () => {
    const svc = createTravelIntelligenceSandbox();
    const result = svc.findChargingLocations(24.7136, 46.6753, 10, 5);
    assert.ok(result.data.length > 0);
    assert.equal(result.data[0]!.availabilityStatus, null);
    assert.ok(result.data[0]!.connectorTypes.length > 0);
  });

  it('rejects oversized bounding boxes', () => {
    const rejection = validateBoundingBox(
      Object.freeze({ minLat: 0, maxLat: 50, minLon: 0, maxLon: 50 }),
    );
    assert.ok(rejection);
    assert.equal(rejection!.code, 'BOUNDING_BOX_TOO_LARGE');
  });

  it('clamps aviation result limits', () => {
    assert.equal(clampResultLimit(9999, TRAVEL_QUERY_LIMITS.maxAircraftResults), 100);
    assert.equal(clampResultLimit(undefined, 50), 20);
  });

  it('uses Environmental Oracle for destination weather', () => {
    const oracle = createEnvironmentalOracleSandbox();
    const weather = oracle.getDestinationWeather('RUH');
    assert.ok(weather);
    assert.equal(weather!.referenceOnly, true);
    assert.equal(weather!.simulation, true);

    const svc = createTravelIntelligenceSandbox();
    const context = svc.buildTravelPlanningContext({ destination: 'RUH', travelerNationality: 'US' });
    assert.ok(context.environmentalContext);
  });

  it('handles provider timeout simulation via degraded health', () => {
    const runtime = createTravelProviderRuntime();
    const provider = runtime.providers.opensky as import('../packages/sunrey-chain/src/travel-intelligence/adapters/fixture-adapters.ts').OpenSkyFixtureProvider;
    provider.markUnhealthy('timeout');
    const health = provider.health();
    assert.equal(health.healthy, false);
    assert.match(health.message, /timeout/i);
  });

  it('handles 429 rate limit simulation', () => {
    const runtime = createTravelProviderRuntime();
    const provider = runtime.providers.opensky as import('../packages/sunrey-chain/src/travel-intelligence/adapters/fixture-adapters.ts').OpenSkyFixtureProvider;
    provider.markRateLimited();
    const health = provider.health();
    assert.equal(health.degraded, true);
    assert.match(health.message, /429/);
  });

  it('falls back when airport not found', () => {
    const svc = createTravelIntelligenceSandbox();
    const result = svc.getAirport('XXX');
    assert.equal(result.data, null);
  });

  it('enforces privacy-safe logging fields', () => {
    const fields = privacySafeLogFields({
      providerId: 'can-i-enter',
      capability: 'entry_requirements',
      destination: 'SA',
      nationality: 'US',
    });
    assert.equal(fields.providerId, 'can-i-enter');
    assert.equal(fields.hasNationality, 'yes');
    assert.equal(fields.destinationRegion, 'SA');
    assert.equal((fields as Record<string, unknown>).nationality, undefined);
  });

  it('Travel Agent planning does not claim booking', () => {
    const svc = createTravelIntelligenceSandbox();
    const context = svc.buildTravelPlanningContext({ destination: 'Riyadh', travelerNationality: 'US' });
    assert.equal(context.bookingConfirmed, false);
    assert.equal(context.referenceOnly, true);
    const evidence = toTravelAgentEvidence(context);
    assert.equal(evidence.grantsBookingAuthority, false);
    assert.equal(evidence.grantsExecutionAuthority, false);
  });

  it('Travel Agent tool is registered with booking=false semantics', () => {
    const registry = createCanonicalToolRegistry();
    const tool = registry.get('getTravelPlanningContext');
    assert.ok(tool);
    assert.equal(tool!.readOnly, true);
    assert.equal(tool!.createsProposal, false);
    assert.match(tool!.description, /does not book/i);
    assert.match(tool!.purpose, /Never claims booking/i);
  });

  it('blocks live network in simulation environment', () => {
    assert.throws(() => createTravelProviderRuntime({ mode: 'live' }), /ENVIRONMENT=simulation/);
  });

  it('Financial Agent evidence does not grant execution authority', () => {
    const svc = createTravelIntelligenceSandbox();
    const evidence = svc.agentTravelEvidenceRef('SA');
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.equal(evidence.grantsBookingAuthority, false);
  });
});

describe('consumer BFF travel routes', () => {
  const headers = { 'cache-control': 'private, max-age=30' };

  it('GET /api/v1/travel/airports returns read-only simulation payload', () => {
    const res = dispatchTravel(
      { method: 'GET', path: '/api/v1/travel/airports', query: { q: 'Riyadh' } },
      'req_travel_airports',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
    const body = res!.body as Record<string, unknown>;
    assert.equal(body.readOnly, true);
    assert.equal(body.simulation, true);
    assert.equal(body.referenceOnly, true);
  });

  it('GET /api/v1/travel/entry-requirements', () => {
    const res = dispatchTravel(
      {
        method: 'GET',
        path: '/api/v1/travel/entry-requirements',
        query: { nationality: 'US', destination: 'SA' },
      },
      'req_travel_entry',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
    const body = res!.body as Record<string, unknown>;
    assert.equal(body.notAdmissibilityGuarantee, true);
  });

  it('GET /api/v1/travel/aviation requires bounding box', () => {
    const res = dispatchTravel(
      { method: 'GET', path: '/api/v1/travel/aviation' },
      'req_travel_aviation',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 400);
  });

  it('GET /api/v1/travel/aviation with bounds returns bounded results', () => {
    const res = dispatchTravel(
      {
        method: 'GET',
        path: '/api/v1/travel/aviation',
        query: { minLat: '40', maxLat: '50', minLon: '-80', maxLon: '-70', limit: '10' },
      },
      'req_travel_aviation_bounds',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
    const body = res!.body as Record<string, unknown>;
    assert.equal(body.boundedQuery, true);
  });

  it('does not expose generic third-party proxy POST', () => {
    const res = dispatchTravel(
      { method: 'POST', path: '/api/v1/travel/proxy' },
      'req_travel_proxy',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 404);
  });

  it('GET /api/v1/travel/providers lists all providers', () => {
    const res = dispatchTravel(
      { method: 'GET', path: '/api/v1/travel/providers' },
      'req_travel_providers',
      headers,
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
    const body = res!.body as Record<string, unknown>;
    const providers = body.providers as string[];
    assert.equal(providers.length, 9);
  });
});
