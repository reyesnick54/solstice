import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCESS_DISCOVERY_PROVIDER_REGISTRY,
  AccessDiscoveryCache,
  AccessDiscoveryService,
  assertCapacityCandidate,
  assertDiscoveryOpportunity,
  assertReferencePriceNotBookingPrice,
  clampPageSize,
  clampRadiusKm,
  createAccessDiscoveryCapabilityRegistry,
  DISCOVERY_POSTURE,
  normalizeChargingLocationToOpportunity,
  normalizeGbfsStationToCapacityCandidate,
  normalizeGbfsStationToOpportunity,
  normalizeParkToOpportunity,
  normalizeRecreationToOpportunity,
  normalizeTransitRouteToOpportunity,
  validateAccessSearchRequest,
} from './index.ts';
import type {
  DiscoveryChargingLocationObservation,
  DiscoveryGbfsStationObservation,
  DiscoveryParkObservation,
  DiscoveryRecreationObservation,
  DiscoveryTransitRouteObservation,
} from './ports.ts';

const NOW = '2026-08-31T12:00:00.000Z';

function freshness(stale = false) {
  return Object.freeze({
    retrievedAt: NOW,
    sourceTimestamp: NOW,
    freshnessStatus: stale ? ('stale' as const) : ('fresh' as const),
    stale,
  });
}

describe('ACCESS Wave 2 Prompt 31 discovery domain', () => {
  it('maps provider capabilities without booking/pay/settle', () => {
    const registry = createAccessDiscoveryCapabilityRegistry();
    for (const provider of registry.list()) {
      assert.equal(provider.simulationOnly, true);
      assert.equal(registry.canPerform(provider.providerId, 'DISCOVER'), true);
      assert.equal(registry.canPerform(provider.providerId, 'SEARCH'), true);
    }
    const gbfs = ACCESS_DISCOVERY_PROVIDER_REGISTRY.gbfs;
    const capabilityIds = gbfs.capabilities.filter((row) => row.supported).map((row) => row.capabilityId);
    assert.ok(capabilityIds.includes('AVAILABILITY'));
    assert.ok(!capabilityIds.includes('BOOK' as never));
  });

  it('normalizes GBFS station to AccessOpportunity', () => {
    const observation: DiscoveryGbfsStationObservation = Object.freeze({
      stationId: 'station_001',
      systemId: 'demo_city_bikes',
      name: 'Central Park Station',
      geography: Object.freeze({
        latitude: 40.7829,
        longitude: -73.9654,
        radiusKm: 10,
        countryCode: 'US',
        regionCode: 'NY',
      }),
      capacity: 30,
      vehiclesAvailable: 12,
      vehicleTypes: Object.freeze(['classic_bike']),
      pricingPlan: 'Unlock + per minute',
      availabilityStatus: 'AVAILABLE',
      providerId: 'gbfs',
      freshness: freshness(),
      sourceObservationId: 'obs_gbfs_station_001',
    });
    const opportunity = normalizeGbfsStationToOpportunity(observation, NOW);
    assert.equal(opportunity.category, 'TRANSPORTATION');
    assert.equal(opportunity.fundedCapacity, false);
    assert.equal(opportunity.bookingSupported, false);
    assertDiscoveryOpportunity(opportunity);
  });

  it('creates GBFS capacity candidate requiring approval', () => {
    const observation: DiscoveryGbfsStationObservation = Object.freeze({
      stationId: 'station_001',
      systemId: 'demo_city_bikes',
      name: 'Central Park Station',
      geography: Object.freeze({
        latitude: 40.7829,
        longitude: -73.9654,
        radiusKm: 10,
        countryCode: 'US',
        regionCode: 'NY',
      }),
      capacity: 30,
      vehiclesAvailable: 12,
      vehicleTypes: Object.freeze(['classic_bike']),
      pricingPlan: null,
      availabilityStatus: 'AVAILABLE',
      providerId: 'gbfs',
      freshness: freshness(),
      sourceObservationId: 'obs_gbfs_station_001',
    });
    const candidate = normalizeGbfsStationToCapacityCandidate(
      observation,
      NOW,
      '2026-09-01T00:00:00.000Z',
      '2026-09-02T00:00:00.000Z',
    );
    assert.equal(candidate.fundedCapacity, false);
    assert.equal(candidate.requiresExplicitApproval, true);
    assertCapacityCandidate(candidate);
  });

  it('normalizes transit route opportunity', () => {
    const observation: DiscoveryTransitRouteObservation = Object.freeze({
      routeId: 'route_1',
      routeName: 'S-Bahn S12',
      operator: 'SBB',
      mode: 'RAIL',
      providerId: 'transitland',
      stopCount: 4,
      freshness: freshness(),
      sourceObservationId: 'obs_transit_route_1',
    });
    const opportunity = normalizeTransitRouteToOpportunity(observation, NOW);
    assert.equal(opportunity.unit, 'TRIP');
    assert.equal(opportunity.providerId, 'transitland');
  });

  it('normalizes charging location with reference price', () => {
    const observation: DiscoveryChargingLocationObservation = Object.freeze({
      locationId: 'ocm_1',
      name: 'Downtown Charger',
      geography: Object.freeze({
        latitude: 40.7,
        longitude: -74.0,
        radiusKm: 5,
        countryCode: 'US',
        regionCode: 'NY',
      }),
      operator: 'ChargeCo',
      connectorTypes: Object.freeze(['CCS']),
      powerKw: 150,
      availabilityStatus: 'AVAILABLE',
      accessType: 'public',
      pricingReference: 'USD 0.35/kWh reference',
      providerId: 'open-charge-map',
      freshness: freshness(),
      sourceObservationId: 'obs_charge_1',
    });
    const opportunity = normalizeChargingLocationToOpportunity(observation, NOW);
    assert.equal(opportunity.category, 'ENERGY');
    assert.equal(opportunity.referencePrice?.kind, 'REFERENCE_PRICE');
    assertReferencePriceNotBookingPrice(opportunity.referencePrice);
  });

  it('does not upgrade UNKNOWN availability', () => {
    const observation: DiscoveryChargingLocationObservation = Object.freeze({
      locationId: 'ocm_2',
      name: 'Unknown Charger',
      geography: Object.freeze({
        latitude: 40.7,
        longitude: -74.0,
        radiusKm: 5,
        countryCode: 'US',
        regionCode: 'NY',
      }),
      operator: null,
      connectorTypes: Object.freeze([]),
      powerKw: null,
      availabilityStatus: 'UNKNOWN',
      accessType: null,
      pricingReference: null,
      providerId: 'open-charge-map',
      freshness: freshness(),
      sourceObservationId: 'obs_charge_2',
    });
    const opportunity = normalizeChargingLocationToOpportunity(observation, NOW);
    assert.equal(opportunity.status, 'UNKNOWN');
  });

  it('normalizes NPS and RIDB opportunities', () => {
    const park: DiscoveryParkObservation = Object.freeze({
      parkCode: 'yell',
      name: 'Yellowstone National Park',
      description: 'Geothermal features',
      geography: Object.freeze({
        latitude: 44.428,
        longitude: -110.5885,
        radiusKm: null,
        countryCode: 'US',
        regionCode: 'WY',
      }),
      alerts: Object.freeze(['road work']),
      visitorInfo: 'seasonal access',
      availabilityStatus: 'LIMITED',
      providerId: 'national-park-service',
      freshness: freshness(),
      sourceObservationId: 'obs_nps_yell',
    });
    const nps = normalizeParkToOpportunity(park, NOW);
    assert.equal(nps.category, 'EXPERIENCES');

    const recreation: DiscoveryRecreationObservation = Object.freeze({
      facilityId: 'ridb_camp_001',
      name: 'Madison Campground',
      activityType: 'Campground',
      geography: Object.freeze({
        latitude: 44.58,
        longitude: -110.86,
        radiusKm: null,
        countryCode: 'US',
        regionCode: 'WY',
      }),
      permitMetadata: null,
      referencePrice: Object.freeze({
        kind: 'REFERENCE_PRICE',
        amountMinorUnits: 3500n,
        currency: 'USD',
        sourceTimestamp: NOW,
        providerId: 'recreation-gov-ridb',
        freshness: freshness(),
        notes: 'reference',
      }),
      availabilityStatus: 'AVAILABLE',
      providerId: 'recreation-gov-ridb',
      freshness: freshness(),
      sourceObservationId: 'obs_ridb_camp_001',
    });
    const ridb = normalizeRecreationToOpportunity(recreation, NOW);
    assert.equal(ridb.referencePrice?.kind, 'REFERENCE_PRICE');
  });

  it('enforces query bounds and privacy-safe filters', () => {
    assert.equal(clampPageSize(500), 50);
    assert.equal(clampRadiusKm(500), 50);
    const invalid = validateAccessSearchRequest({
      category: null,
      location: Object.freeze({ latitude: 999, longitude: 0, radiusKm: 5, countryCode: null, regionCode: null }),
      startDate: null,
      endDate: null,
      units: null,
      unit: null,
      radiusKm: null,
      filters: Object.freeze({}),
      sort: 'relevance',
      page: 1,
      pageSize: 20,
      query: null,
    });
    assert.ok(invalid);
  });

  it('uses discovery cache with stale flag', () => {
    let now = 0;
    const cache = new AccessDiscoveryCache(() => now);
    cache.set('key', ['value'], 'search_results');
    now = 120_000;
    const hit = cache.get<string[]>('key');
    assert.ok(hit);
    assert.equal(hit!.stale, true);
  });

  it('preserves discovery posture invariants', () => {
    assert.equal(DISCOVERY_POSTURE.paymentIntegrationAdded, false);
    assert.equal(DISCOVERY_POSTURE.fundingReservationOccurs, false);
    assert.equal(DISCOVERY_POSTURE.dualTokenAllocationChanged, false);
  });

  it('AccessDiscoveryService rejects privacy-violating filters', () => {
    const service = new AccessDiscoveryService({
      ports: {
        travel: {
          searchTransit: () => Object.freeze({ ok: true, value: Object.freeze([]) }),
          findChargingLocations: () => Object.freeze({ ok: true, value: Object.freeze([]) }),
        },
        mobility: {
          searchGbfsStations: () => Object.freeze({ ok: true, value: Object.freeze([]) }),
        },
        recreation: {
          searchParks: () => Object.freeze({ ok: true, value: Object.freeze([]) }),
          searchRecreationInventory: () => Object.freeze({ ok: true, value: Object.freeze([]) }),
        },
        environmental: {
          getDestinationContext: () =>
            Object.freeze({
              ok: true,
              value: Object.freeze({
                destinationRegion: 'US',
                severeWeather: false,
                notes: Object.freeze([]),
                freshness: freshness(),
              }),
            }),
        },
        geospatial: {
          normalizeGeography: (input) => Object.freeze({ ok: true, value: input }),
        },
      },
    });
    const outcome = service.searchOpportunities({
      category: null,
      location: null,
      startDate: null,
      endDate: null,
      units: null,
      unit: null,
      radiusKm: null,
      filters: Object.freeze({ tokenBalance: 'secret' }),
      sort: 'relevance',
      page: 1,
      pageSize: 20,
      query: null,
    });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.code, 'PRIVACY_VIOLATION');
  });
});
