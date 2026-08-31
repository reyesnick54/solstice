/**
 * Wave 5 fixture-backed travel provider adapters.
 * Simulation only — no live provider HTTP.
 */

import type { TravelProvider } from './base.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  Airport,
  AviationObservation,
  ChargingLocation,
  EntryRequirementObservation,
  ProviderObservationEnvelope,
  TransitDeparture,
  TransitRoute,
  TravelAdapterId,
  TravelProviderHealth,
} from '../types.ts';
import type { BoundingBox } from '../limits.ts';
import {
  FIXTURE_AIRCRAFT_REGISTRY,
  FIXTURE_AIRPORTS,
  FIXTURE_AVIATION_OBSERVATIONS,
  FIXTURE_CHARGING_LOCATIONS,
  FIXTURE_ENTRY_REQUIREMENTS,
  FIXTURE_TRANSIT_DEPARTURES,
  FIXTURE_TRANSIT_ROUTES,
} from '../fixtures/data.ts';

type Clock = { readonly nowUtc: () => string };

const defaultClock = (): Clock => ({ nowUtc: () => new Date().toISOString() });

function envelope<T>(
  providerId: string,
  capability: string,
  data: T,
  clock: Clock,
  stale = false,
): ProviderObservationEnvelope<T> {
  return Object.freeze({
    providerId,
    capability,
    collectedAtUtc: clock.nowUtc() as UtcInstant,
    sourceTimestampUtc: clock.nowUtc() as UtcInstant,
    stale,
    simulation: true as const,
    data,
  });
}

abstract class BaseFixtureTravelProvider implements TravelProvider {
  abstract readonly providerId: TravelAdapterId;
  abstract readonly capabilities: readonly string[];
  protected readonly clock: Clock;
  private healthy = true;
  private degraded = false;
  private message = 'fixture healthy';

  constructor(clock: Clock = defaultClock()) {
    this.clock = clock;
  }

  markUnhealthy(message: string): void {
    this.healthy = false;
    this.message = message;
  }

  markDegraded(message: string): void {
    this.degraded = true;
    this.message = message;
  }

  markRateLimited(): void {
    this.degraded = true;
    this.message = 'rate limited (429)';
  }

  health(): TravelProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      healthy: this.healthy,
      degraded: this.degraded,
      message: this.message,
      capabilities: this.capabilities,
    });
  }
}

export class OpenSkyFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'opensky' as const;
  readonly capabilities = Object.freeze(['aircraft_position', 'flight_reference', 'aviation_positions']);

  getAircraftPositions(
    _bounds: BoundingBox,
    limit: number,
  ): ProviderObservationEnvelope<readonly AviationObservation[]> {
    return envelope(
      this.providerId,
      'aircraft_position',
      FIXTURE_AVIATION_OBSERVATIONS.slice(0, limit),
      this.clock,
    );
  }
}

export class FaaRegistryFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'faa-registry' as const;
  readonly capabilities = Object.freeze(['aircraft_registry', 'flight_reference']);

  getAircraftRegistry(identifier: string): ProviderObservationEnvelope<Record<string, unknown> | null> {
    if (identifier.toUpperCase() !== FIXTURE_AIRCRAFT_REGISTRY.nNumber) {
      return envelope(this.providerId, 'aircraft_registry', null, this.clock);
    }
    return envelope(this.providerId, 'aircraft_registry', { ...FIXTURE_AIRCRAFT_REGISTRY }, this.clock);
  }
}

export class AviationApiFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'aviationapi' as const;
  readonly capabilities = Object.freeze(['airport_information', 'flight_reference']);

  searchAirports(query: string, limit: number): ProviderObservationEnvelope<readonly Airport[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_AIRPORTS.filter(
      (a) =>
        a.airportId.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.city?.toLowerCase().includes(q) ?? false),
    ).slice(0, limit);
    return envelope(this.providerId, 'airport_information', results, this.clock);
  }

  getAirport(airportId: string): ProviderObservationEnvelope<Airport | null> {
    const airport = FIXTURE_AIRPORTS.find((a) => a.airportId === airportId.toUpperCase()) ?? null;
    return envelope(this.providerId, 'airport_information', airport, this.clock);
  }
}

export class CanIEnterFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'can-i-enter' as const;
  readonly capabilities = Object.freeze(['entry_requirements', 'visa_entry']);

  getEntryRequirements(
    nationality: string,
    destination: string,
  ): ProviderObservationEnvelope<readonly EntryRequirementObservation[]> {
    const results = FIXTURE_ENTRY_REQUIREMENTS.filter(
      (r) =>
        r.travelerNationality === nationality.toUpperCase() &&
        r.destination === destination.toUpperCase(),
    );
    const stale = results.some((r) => r.freshness.freshnessStatus === 'stale');
    return envelope(this.providerId, 'entry_requirements', results, this.clock, stale);
  }
}

export class TransportRestFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'transport-rest' as const;
  readonly capabilities = Object.freeze(['public_transit', 'transit_route', 'transit_departure']);

  searchTransit(_query: string, limit: number): ProviderObservationEnvelope<readonly TransitRoute[]> {
    return envelope(
      this.providerId,
      'transit_route',
      FIXTURE_TRANSIT_ROUTES.filter((r) => r.providerId === 'transport-rest').slice(0, limit),
      this.clock,
    );
  }

  getTransitDepartures(stopId: string, limit: number): ProviderObservationEnvelope<readonly TransitDeparture[]> {
    const results = FIXTURE_TRANSIT_DEPARTURES.filter(
      (d) => d.providerId === 'transport-rest' && d.stop.stopId === stopId,
    ).slice(0, limit);
    return envelope(this.providerId, 'transit_departure', results, this.clock);
  }
}

export class TransitLandFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'transitland' as const;
  readonly capabilities = Object.freeze(['public_transit', 'transit_route', 'transit_departure']);

  searchTransit(_query: string, limit: number): ProviderObservationEnvelope<readonly TransitRoute[]> {
    return envelope(this.providerId, 'transit_route', FIXTURE_TRANSIT_ROUTES.slice(0, limit), this.clock);
  }

  getTransitDepartures(_stopId: string, limit: number): ProviderObservationEnvelope<readonly TransitDeparture[]> {
    return envelope(
      this.providerId,
      'transit_departure',
      FIXTURE_TRANSIT_DEPARTURES.filter((d) => d.providerId !== 'bc-ferries').slice(0, limit),
      this.clock,
    );
  }
}

export class OpenChargeMapFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'open-charge-map' as const;
  readonly capabilities = Object.freeze(['ev_charging', 'mobility_status']);

  findChargingLocations(
    _latitude: number,
    _longitude: number,
    _radiusKm: number,
    limit: number,
  ): ProviderObservationEnvelope<readonly ChargingLocation[]> {
    return envelope(
      this.providerId,
      'ev_charging',
      FIXTURE_CHARGING_LOCATIONS.slice(0, limit),
      this.clock,
    );
  }
}

export class BcFerriesFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'bc-ferries' as const;
  readonly capabilities = Object.freeze(['public_transit', 'transit_route', 'transit_departure']);

  searchTransit(_query: string, limit: number): ProviderObservationEnvelope<readonly TransitRoute[]> {
    const ferryRoute: TransitRoute = Object.freeze({
      routeId: 'bc-ferry-1',
      operator: 'BC Ferries',
      routeName: 'Tsawwassen — Swartz Bay',
      mode: 'FERRY',
      stops: Object.freeze([
        Object.freeze({
          stopId: 'TSA',
          name: 'Tsawwassen',
          location: Object.freeze({ latitude: 49.0067, longitude: -123.1297 }),
          mode: 'FERRY' as const,
        }),
      ]),
      providerId: 'bc-ferries',
      freshness: FIXTURE_TRANSIT_DEPARTURES[1]!.freshness,
    });
    return envelope(this.providerId, 'transit_route', [ferryRoute].slice(0, limit), this.clock);
  }

  getTransitDepartures(stopId: string, limit: number): ProviderObservationEnvelope<readonly TransitDeparture[]> {
    const results = FIXTURE_TRANSIT_DEPARTURES.filter(
      (d) => d.providerId === 'bc-ferries' && d.stop.stopId === stopId,
    ).slice(0, limit);
    return envelope(this.providerId, 'transit_departure', results, this.clock);
  }
}

export class EnturFixtureProvider extends BaseFixtureTravelProvider {
  readonly providerId = 'entur' as const;
  readonly capabilities = Object.freeze(['public_transit', 'transit_route', 'transit_departure', 'mobility_status']);

  searchTransit(_query: string, limit: number): ProviderObservationEnvelope<readonly TransitRoute[]> {
    return envelope(
      this.providerId,
      'transit_route',
      FIXTURE_TRANSIT_ROUTES.filter((r) => r.providerId === 'entur').slice(0, limit),
      this.clock,
    );
  }

  getTransitDepartures(_stopId: string, limit: number): ProviderObservationEnvelope<readonly TransitDeparture[]> {
    return envelope(this.providerId, 'transit_departure', [], this.clock);
  }
}

export function createWave5FixtureProviders(clock?: Clock): Readonly<Record<TravelAdapterId, TravelProvider>> {
  const c = clock ?? defaultClock();
  return Object.freeze({
    opensky: new OpenSkyFixtureProvider(c),
    'faa-registry': new FaaRegistryFixtureProvider(c),
    aviationapi: new AviationApiFixtureProvider(c),
    'can-i-enter': new CanIEnterFixtureProvider(c),
    'transport-rest': new TransportRestFixtureProvider(c),
    transitland: new TransitLandFixtureProvider(c),
    'open-charge-map': new OpenChargeMapFixtureProvider(c),
    'bc-ferries': new BcFerriesFixtureProvider(c),
    entur: new EnturFixtureProvider(c),
  });
}

export type Wave5FixtureProviders = ReturnType<typeof createWave5FixtureProviders>;
