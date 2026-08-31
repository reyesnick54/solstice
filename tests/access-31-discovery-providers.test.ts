import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createAccessDiscoveryBridge,
  createAccessDiscoveryPorts,
} from '../packages/human-access-economy/src/discovery-bridge.ts';
import {
  AccessDiscoveryDataCache,
  AccessDiscoveryDataService,
  createAccessDiscoveryDataSandbox,
  FIXTURE_GBFS_OBSERVATIONS,
  FIXTURE_NPS_PARKS,
} from '../packages/sunrey-chain/src/access-discovery/index.ts';
import {
  createTravelIntelligenceSandbox,
} from '../packages/sunrey-chain/src/travel-intelligence/service.ts';
import {
  FIXTURE_CHARGING_LOCATIONS,
  FIXTURE_TRANSIT_ROUTES,
} from '../packages/sunrey-chain/src/travel-intelligence/fixtures/data.ts';
import { createAccessDiscoveryCapabilityRegistry } from '../packages/access-economy/src/discovery/capabilities.ts';
import { DISCOVERY_POSTURE } from '../packages/access-economy/src/discovery/invariants.ts';
import { GbfsFixtureProvider } from '../packages/sunrey-chain/src/access-discovery/adapters/fixture-adapters.ts';

describe('ACCESS Wave 2 Prompt 31 discovery providers integration', () => {
  it('connects six discovery providers through capability registry', () => {
    const registry = createAccessDiscoveryCapabilityRegistry();
    assert.equal(registry.list().length, 6);
    assert.ok(registry.get('gbfs'));
    assert.ok(registry.get('transitland'));
    assert.ok(registry.get('open-charge-map'));
    assert.ok(registry.get('national-park-service'));
    assert.ok(registry.get('recreation-gov-ridb'));
  });

  it('reuses TravelIntelligenceService for transit and charging', () => {
    const travel = createTravelIntelligenceSandbox();
    const ports = createAccessDiscoveryPorts({ travel });
    const transit = ports.travel.searchTransit('Zurich', 5);
    assert.equal(transit.ok, true);
    if (transit.ok) {
      assert.ok(transit.value.length > 0);
      assert.equal(transit.value[0]!.providerId, FIXTURE_TRANSIT_ROUTES[0]!.providerId);
    }
    const charging = ports.travel.findChargingLocations(
      Object.freeze({
        latitude: FIXTURE_CHARGING_LOCATIONS[0]!.location.latitude,
        longitude: FIXTURE_CHARGING_LOCATIONS[0]!.location.longitude,
        radiusKm: 10,
        countryCode: 'US',
        regionCode: null,
      }),
      5,
    );
    assert.equal(charging.ok, true);
    if (charging.ok) {
      assert.ok(charging.value.length > 0);
      assert.equal(charging.value[0]!.providerId, 'open-charge-map');
    }
  });

  it('normalizes GBFS fixture stations through bridge search', () => {
    const service = createAccessDiscoveryBridge();
    const result = service.searchOpportunities({
      category: 'TRANSPORTATION',
      location: Object.freeze({
        latitude: FIXTURE_GBFS_OBSERVATIONS[0]!.station.location.latitude,
        longitude: FIXTURE_GBFS_OBSERVATIONS[0]!.station.location.longitude,
        radiusKm: 10,
        countryCode: 'US',
        regionCode: 'NY',
      }),
      startDate: null,
      endDate: null,
      units: null,
      unit: null,
      radiusKm: 10,
      filters: Object.freeze({}),
      sort: 'relevance',
      page: 1,
      pageSize: 20,
      query: '',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const gbfs = result.value.opportunities.find((row) => row.providerId === 'gbfs');
      assert.ok(gbfs);
      assert.equal(gbfs!.fundedCapacity, false);
      assert.equal(gbfs!.discoveryOnly, true);
      assert.equal(gbfs!.unit, 'RIDE');
    }
  });

  it('normalizes NPS and RIDB opportunities via AccessDiscoveryService', () => {
    const service = createAccessDiscoveryBridge();
    const result = service.searchByCategory('EXPERIENCES', {
      location: null,
      startDate: null,
      endDate: null,
      units: null,
      unit: null,
      radiusKm: null,
      filters: Object.freeze({}),
      sort: 'relevance',
      page: 1,
      pageSize: 20,
      query: 'Yellowstone',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.value.opportunities.some((row) => row.providerId === 'national-park-service'));
      assert.ok(result.value.opportunities.some((row) => row.providerId === 'recreation-gov-ridb'));
      assert.ok(result.value.opportunities.every((row) => row.bookingSupported === false));
    }
  });

  it('classifies reference prices and keeps opportunities distinct from capacity', () => {
    const service = createAccessDiscoveryBridge();
    const search = service.searchByCategory('EXPERIENCES', {
      location: null,
      startDate: null,
      endDate: null,
      units: null,
      unit: null,
      radiusKm: null,
      filters: Object.freeze({}),
      sort: 'relevance',
      page: 1,
      pageSize: 20,
      query: 'Madison',
    });
    assert.equal(search.ok, true);
    if (search.ok) {
      const recreation = search.value.opportunities.find((row) => row.providerId === 'recreation-gov-ridb');
      assert.ok(recreation);
      assert.equal(recreation!.referencePrice?.kind, 'REFERENCE_PRICE');
      assert.notEqual(recreation!.opportunityId, recreation!.providerItemId);
    }
  });

  it('reuses environmental oracle through travel bridge', () => {
    const ports = createAccessDiscoveryPorts();
    const env = ports.environmental.getDestinationContext('US');
    assert.equal(env.ok, true);
  });

  it('handles provider timeout and 429 as degraded/failure paths', () => {
    const data = createAccessDiscoveryDataSandbox();
    data.listProviderHealth();
    const gbfs = new GbfsFixtureProvider();
    gbfs.markTimeout();
    const timeoutResult = gbfs.searchStations(40.78, -73.96, 10, 5);
    assert.equal(timeoutResult.data.length, 0);
    gbfs.markRateLimited();
    const rateLimited = gbfs.searchStations(40.78, -73.96, 10, 5);
    assert.equal(rateLimited.stale, true);
  });

  it('returns cached parks from AccessDiscoveryDataService', () => {
    const cache = new AccessDiscoveryDataCache();
    const data = new AccessDiscoveryDataService({ cache });
    const first = data.searchParks('Yellowstone', 5);
    const second = data.searchParks('Yellowstone', 5);
    assert.equal(first.data.length, second.data.length);
    assert.equal(second.providerId, 'national-park-service');
  });

  it('enforces geographic normalization without Access-specific geography tables', () => {
    const ports = createAccessDiscoveryPorts();
    const normalized = ports.geospatial.normalizeGeography(
      Object.freeze({
        latitude: 40.78291234,
        longitude: -73.96541234,
        radiusKm: 10,
        countryCode: 'US',
        regionCode: 'NY',
      }),
    );
    assert.equal(normalized.ok, true);
    if (normalized.ok) {
      assert.equal(normalized.value.latitude, 40.7829);
      assert.equal(normalized.value.longitude, -73.9654);
    }
  });

  it('does not change SR/MR allocation or fund capacity', () => {
    assert.equal(DISCOVERY_POSTURE.dualTokenAllocationChanged, false);
    assert.equal(DISCOVERY_POSTURE.accessAllocationEngineChanged, false);
    assert.equal(DISCOVERY_POSTURE.fundingReservationOccurs, false);
    const service = createAccessDiscoveryBridge();
    assert.equal(service.posture.paymentIntegrationAdded, false);
    assert.equal(service.posture.settlementIntegrationAdded, false);
  });

  it('finds NPS parks fixture data directly', () => {
    const data = createAccessDiscoveryDataSandbox();
    const parks = data.searchParks('Grand Canyon', 5);
    assert.ok(parks.data.some((park) => park.parkCode === FIXTURE_NPS_PARKS[1]!.parkCode));
  });
});
