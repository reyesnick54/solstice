/**
 * Wave 5 travel intelligence fixture data — simulation only.
 */

import type {
  Airport,
  AviationObservation,
  ChargingLocation,
  EntryRequirementObservation,
  TransitDeparture,
  TransitRoute,
} from '../types.ts';

const NOW = '2026-08-31T12:00:00.000Z';

function freshness(sourceUrl: string | null = null) {
  return Object.freeze({
    freshnessStatus: 'fresh' as const,
    retrievedAt: NOW,
    sourceEffectiveAt: '2026-08-01T00:00:00.000Z',
    sourceUrl,
  });
}

function provenance(providerId: string, capability: string) {
  return Object.freeze({
    providerId,
    capability,
    simulation: true as const,
    rawPayloadHash: `fixture-${providerId}-${capability}`,
  });
}

export const FIXTURE_AIRPORTS: readonly Airport[] = Object.freeze([
  Object.freeze({
    airportId: 'RUH',
    iata: 'RUH',
    icao: 'OERK',
    name: 'King Khalid International Airport',
    country: 'SA',
    city: 'Riyadh',
    region: 'Riyadh Province',
    location: Object.freeze({ latitude: 24.9576, longitude: 46.6988 }),
    timezone: 'Asia/Riyadh',
  }),
  Object.freeze({
    airportId: 'JFK',
    iata: 'JFK',
    icao: 'KJFK',
    name: 'John F. Kennedy International Airport',
    country: 'US',
    city: 'New York',
    region: 'NY',
    location: Object.freeze({ latitude: 40.6413, longitude: -73.7781 }),
    timezone: 'America/New_York',
  }),
  Object.freeze({
    airportId: 'ZRH',
    iata: 'ZRH',
    icao: 'LSZH',
    name: 'Zurich Airport',
    country: 'CH',
    city: 'Zurich',
    region: 'ZH',
    location: Object.freeze({ latitude: 47.4647, longitude: 8.5492 }),
    timezone: 'Europe/Zurich',
  }),
]);

export const FIXTURE_AVIATION_OBSERVATIONS = Object.freeze([
  Object.freeze({
    flightId: 'SV123',
    callsign: 'SVA123',
    aircraft: Object.freeze({
      icao24: '710258',
      tailNumber: 'HZ-AK18',
      registration: 'HZ-AK18',
      callsign: 'SVA123',
      aircraftModel: 'A320',
      providerNativeId: '710258',
    }),
    origin: 'RUH',
    destination: 'JFK',
    location: Object.freeze({ latitude: 45.2, longitude: -30.1 }),
    altitudeMeters: 10668,
    groundSpeedKnots: 480,
    headingDegrees: 290,
    verticalRateFpm: 0,
    departureTime: '2026-08-31T08:00:00.000Z',
    arrivalTime: '2026-08-31T18:30:00.000Z',
    status: 'en_route',
    observedAt: NOW,
    providerId: 'opensky',
    freshness: freshness('https://opensky-network.org/api/states/all'),
    provenance: provenance('opensky', 'aircraft_position'),
  }),
]) as readonly AviationObservation[];

export const FIXTURE_ENTRY_REQUIREMENTS = Object.freeze([
  Object.freeze({
    travelerNationality: 'US',
    destination: 'SA',
    entryRequirementType: 'visa',
    visaRequired: true,
    restrictionStatus: 'eVisa available for tourism',
    notes: 'Reference only — verify with official embassy sources before travel.',
    sourceEffectiveAt: '2026-08-01T00:00:00.000Z',
    retrievedAt: NOW,
    providerId: 'can-i-enter',
    freshness: freshness('https://canienter.com/api/v1/requirements'),
    sourceUrl: 'https://canienter.com/api/v1/requirements',
    provenance: provenance('can-i-enter', 'entry_requirements'),
    referenceOnly: true as const,
  }),
  Object.freeze({
    travelerNationality: 'US',
    destination: 'SA',
    entryRequirementType: 'visa',
    visaRequired: true,
    restrictionStatus: 'eVisa required — policy updated',
    notes: 'Stale fixture for testing freshness warnings.',
    sourceEffectiveAt: '2025-01-01T00:00:00.000Z',
    retrievedAt: '2025-06-01T00:00:00.000Z',
    providerId: 'can-i-enter',
    freshness: Object.freeze({
      freshnessStatus: 'stale' as const,
      retrievedAt: '2025-06-01T00:00:00.000Z',
      sourceEffectiveAt: '2025-01-01T00:00:00.000Z',
      sourceUrl: 'https://canienter.com/api/v1/requirements',
    }),
    sourceUrl: 'https://canienter.com/api/v1/requirements',
    provenance: provenance('can-i-enter', 'entry_requirements'),
    referenceOnly: true as const,
  }),
]) as readonly EntryRequirementObservation[];

export const FIXTURE_TRANSIT_ROUTES = Object.freeze([
  Object.freeze({
    routeId: 'tl-route-1',
    operator: 'SBB',
    routeName: 'IC 1 Zurich — Bern',
    mode: 'RAIL' as const,
    stops: Object.freeze([
      Object.freeze({
        stopId: '8503000',
        name: 'Zurich HB',
        location: Object.freeze({ latitude: 47.3782, longitude: 8.5402 }),
        mode: 'RAIL' as const,
      }),
      Object.freeze({
        stopId: '8507000',
        name: 'Bern',
        location: Object.freeze({ latitude: 46.948, longitude: 7.4394 }),
        mode: 'RAIL' as const,
      }),
    ]),
    providerId: 'transport-rest',
    freshness: freshness(),
  }),
  Object.freeze({
    routeId: 'entur-route-1',
    operator: 'Vy',
    routeName: 'Oslo S — Bergen',
    mode: 'RAIL' as const,
    stops: Object.freeze([
      Object.freeze({
        stopId: 'NSR:StopPlace:1',
        name: 'Oslo S',
        location: Object.freeze({ latitude: 59.9115, longitude: 10.7522 }),
        mode: 'RAIL' as const,
      }),
    ]),
    providerId: 'entur',
    freshness: freshness(),
  }),
]) as readonly TransitRoute[];

export const FIXTURE_TRANSIT_DEPARTURES = Object.freeze([
  Object.freeze({
    departureId: 'dep-1',
    routeId: 'tl-route-1',
    stop: Object.freeze({
      stopId: '8503000',
      name: 'Zurich HB',
      location: Object.freeze({ latitude: 47.3782, longitude: 8.5402 }),
      mode: 'RAIL' as const,
    }),
    scheduledTime: '2026-08-31T13:00:00.000Z',
    estimatedTime: '2026-08-31T13:05:00.000Z',
    delayMinutes: 5,
    destination: 'Bern',
    mode: 'RAIL' as const,
    operator: 'SBB',
    providerId: 'transport-rest',
    freshness: freshness(),
  }),
  Object.freeze({
    departureId: 'ferry-1',
    routeId: 'bc-ferry-1',
    stop: Object.freeze({
      stopId: 'TSA',
      name: 'Tsawwassen',
      location: Object.freeze({ latitude: 49.0067, longitude: -123.1297 }),
      mode: 'FERRY' as const,
    }),
    scheduledTime: '2026-08-31T14:00:00.000Z',
    estimatedTime: null,
    delayMinutes: null,
    destination: 'Swartz Bay',
    mode: 'FERRY' as const,
    operator: 'BC Ferries',
    providerId: 'bc-ferries',
    freshness: freshness(),
  }),
]) as readonly TransitDeparture[];

export const FIXTURE_CHARGING_LOCATIONS = Object.freeze([
  Object.freeze({
    locationId: 'ocm-1',
    name: 'Riyadh Mall Charging Hub',
    location: Object.freeze({ latitude: 24.7136, longitude: 46.6753 }),
    operator: 'ChargePoint',
    connectorTypes: Object.freeze(['Type 2', 'CCS']),
    powerKw: 50,
    availabilityStatus: null,
    accessType: 'public',
    pricingReference: null,
    providerId: 'open-charge-map',
    freshness: freshness('https://openchargemap.org/site/chargepoint/1'),
  }),
]) as readonly ChargingLocation[];

export const FIXTURE_AIRCRAFT_REGISTRY = Object.freeze({
  nNumber: 'N12345',
  manufacturer: 'Cessna',
  model: '172S',
  serialNumber: '172S12345',
  owner: 'REDACTED',
  status: 'Valid',
  providerId: 'faa-registry',
});
