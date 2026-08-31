/**
 * TravelIntelligenceService — canonical travel discovery and reference plane.
 * Information only. No booking execution.
 */

import { EnvironmentalOracleService } from '../environmental-oracle/service.ts';
import type { Wave5FixtureProviders } from './adapters/fixture-adapters.ts';
import { createWave5FixtureProviders } from './adapters/fixture-adapters.ts';
import { TravelIntelligenceCache } from './cache.ts';
import {
  clampResultLimit,
  privacySafeLogFields,
  TRAVEL_QUERY_LIMITS,
  validateBoundingBox,
  validateCountryCode,
  type BoundingBox,
} from './limits.ts';
import type {
  Airport,
  AviationObservation,
  ChargingLocation,
  EntryRequirementObservation,
  ProviderObservationEnvelope,
  TransitDeparture,
  TransitRoute,
  TravelPlanningContext,
  TravelProviderHealth,
  TravelServiceResult,
} from './types.ts';

export type TravelIntelligenceServiceOptions = {
  readonly providers?: Wave5FixtureProviders;
  readonly cache?: TravelIntelligenceCache;
  readonly environmentalOracle?: EnvironmentalOracleService;
  readonly nowUtc?: () => string;
};

export class TravelIntelligenceService {
  readonly #providers: Wave5FixtureProviders;
  readonly #cache: TravelIntelligenceCache;
  readonly #environmental: EnvironmentalOracleService;
  readonly #nowUtc: () => string;

  constructor(options: TravelIntelligenceServiceOptions = {}) {
    this.#providers = options.providers ?? createWave5FixtureProviders();
    this.#cache = options.cache ?? new TravelIntelligenceCache();
    this.#environmental =
      options.environmentalOracle ?? new EnvironmentalOracleService({ cache: this.#cache });
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  listProviders(): readonly string[] {
    return Object.freeze(Object.keys(this.#providers));
  }

  allProviderHealth(): readonly TravelProviderHealth[] {
    return Object.freeze(Object.values(this.#providers).map((p) => p.health()));
  }

  searchAirports(query: string, limit?: number): TravelServiceResult<readonly Airport[]> {
    const clamped = clampResultLimit(limit, TRAVEL_QUERY_LIMITS.maxAirportResults);
    const key = `airports:${query}:${clamped}`;
    const cached = this.#cache.get<readonly Airport[]>(key);
    if (cached) {
      return Object.freeze({
        data: cached.value,
        providerId: 'aviationapi',
        stale: cached.stale,
        degraded: false,
        warnings: Object.freeze([]),
      });
    }
    const result = this.#providers.aviationapi.searchAirports?.(query, clamped);
    if (!result) {
      return Object.freeze({
        data: Object.freeze([]),
        providerId: 'none',
        stale: true,
        degraded: true,
        warnings: Object.freeze(['airport search unavailable']),
      });
    }
    this.#cache.set(key, result.data, 'airport_information');
    return Object.freeze({
      data: result.data,
      providerId: result.providerId,
      stale: result.stale,
      degraded: false,
      warnings: Object.freeze([]),
    });
  }

  getAirport(airportId: string): TravelServiceResult<Airport | null> {
    const key = `airport:${airportId}`;
    const cached = this.#cache.get<Airport | null>(key);
    if (cached) {
      return Object.freeze({
        data: cached.value,
        providerId: 'aviationapi',
        stale: cached.stale,
        degraded: false,
        warnings: Object.freeze([]),
      });
    }
    const result = this.#providers.aviationapi.getAirport?.(airportId.toUpperCase());
    if (!result) {
      return Object.freeze({
        data: null,
        providerId: 'none',
        stale: true,
        degraded: true,
        warnings: Object.freeze(['airport lookup unavailable']),
      });
    }
    this.#cache.set(key, result.data, 'airport_information');
    return Object.freeze({
      data: result.data,
      providerId: result.providerId,
      stale: result.stale,
      degraded: false,
      warnings: Object.freeze([]),
    });
  }

  getAircraftPositions(
    bounds: BoundingBox,
    limit?: number,
  ): TravelServiceResult<readonly AviationObservation[]> {
    const boxError = validateBoundingBox(bounds);
    if (boxError) {
      return Object.freeze({
        data: Object.freeze([]),
        providerId: 'none',
        stale: false,
        degraded: true,
        warnings: Object.freeze([boxError.message]),
      });
    }
    const clamped = clampResultLimit(limit, TRAVEL_QUERY_LIMITS.maxAircraftResults);
    const key = `aircraft:${bounds.minLat}:${bounds.maxLat}:${bounds.minLon}:${bounds.maxLon}:${clamped}`;
    const cached = this.#cache.get<readonly AviationObservation[]>(key);
    if (cached) {
      return Object.freeze({
        data: cached.value,
        providerId: 'opensky',
        stale: cached.stale,
        degraded: false,
        warnings: Object.freeze([]),
      });
    }
    const result = this.#providers.opensky.getAircraftPositions?.(bounds, clamped);
    if (!result) {
      return Object.freeze({
        data: Object.freeze([]),
        providerId: 'none',
        stale: true,
        degraded: true,
        warnings: Object.freeze(['aircraft position unavailable']),
      });
    }
    this.#cache.set(key, result.data, 'aircraft_position');
    return Object.freeze({
      data: result.data,
      providerId: result.providerId,
      stale: result.stale,
      degraded: false,
      warnings: Object.freeze([]),
    });
  }

  getAircraftRegistry(identifier: string): TravelServiceResult<Record<string, unknown> | null> {
    const result = this.#providers['faa-registry'].getAircraftRegistry?.(identifier.toUpperCase());
    return Object.freeze({
      data: result?.data ?? null,
      providerId: result?.providerId ?? 'faa-registry',
      stale: result?.stale ?? false,
      degraded: false,
      warnings: Object.freeze([]),
    });
  }

  getEntryRequirements(
    nationality: string,
    destination: string,
  ): TravelServiceResult<readonly EntryRequirementObservation[]> {
    const natError = validateCountryCode(nationality);
    const destError = validateCountryCode(destination);
    if (natError || destError) {
      return Object.freeze({
        data: Object.freeze([]),
        providerId: 'none',
        stale: false,
        degraded: true,
        warnings: Object.freeze([natError?.message ?? destError!.message]),
      });
    }

    privacySafeLogFields({
      providerId: 'can-i-enter',
      capability: 'entry_requirements',
      destination,
      nationality,
    });

    const result = this.#providers['can-i-enter'].getEntryRequirements?.(
      nationality.toUpperCase(),
      destination.toUpperCase(),
    );
    const stale = result?.data.some((r) => r.freshness.freshnessStatus === 'stale') ?? false;
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: result?.providerId ?? 'can-i-enter',
      stale,
      degraded: false,
      warnings: stale
        ? Object.freeze(['Some entry requirement data may be outdated — verify with official sources.'])
        : Object.freeze([]),
    });
  }

  searchTransit(query: string, limit?: number): TravelServiceResult<readonly TransitRoute[]> {
    const clamped = clampResultLimit(limit, TRAVEL_QUERY_LIMITS.maxTransitResults);
    const routes: TransitRoute[] = [];
    const providers = ['transitland', 'transport-rest', 'entur', 'bc-ferries'] as const;
    for (const id of providers) {
      const result = this.#providers[id].searchTransit?.(query, clamped);
      if (result) routes.push(...result.data);
    }
    return Object.freeze({
      data: Object.freeze(routes.slice(0, clamped)),
      providerId: 'transitland',
      stale: false,
      degraded: false,
      warnings: Object.freeze([]),
    });
  }

  getTransitDepartures(stopId: string, limit?: number): TravelServiceResult<readonly TransitDeparture[]> {
    const clamped = clampResultLimit(limit, TRAVEL_QUERY_LIMITS.maxTransitResults);
    const departures: TransitDeparture[] = [];
    const providers = ['transport-rest', 'transitland', 'bc-ferries'] as const;
    for (const id of providers) {
      const result = this.#providers[id].getTransitDepartures?.(stopId, clamped);
      if (result) departures.push(...result.data);
    }
    return Object.freeze({
      data: Object.freeze(departures.slice(0, clamped)),
      providerId: 'transport-rest',
      stale: false,
      degraded: false,
      warnings: Object.freeze([]),
    });
  }

  findChargingLocations(
    latitude: number,
    longitude: number,
    radiusKm = 10,
    limit?: number,
  ): TravelServiceResult<readonly ChargingLocation[]> {
    const clamped = clampResultLimit(limit, TRAVEL_QUERY_LIMITS.maxChargingResults);
    const result = this.#providers['open-charge-map'].findChargingLocations?.(
      latitude,
      longitude,
      radiusKm,
      clamped,
    );
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: result?.providerId ?? 'open-charge-map',
      stale: result?.stale ?? false,
      degraded: false,
      warnings: Object.freeze([]),
    });
  }

  /** Travel planning context for Travel Agent — reference only, no booking. */
  buildTravelPlanningContext(input: {
    readonly destination: string;
    readonly travelerNationality?: string;
    readonly airportId?: string;
  }): TravelPlanningContext {
    const dest = input.destination.toUpperCase();
    const airportResult = input.airportId
      ? this.getAirport(input.airportId)
      : this.searchAirports(dest, 1);
    const airport =
      'data' in airportResult && Array.isArray(airportResult.data)
        ? (airportResult.data[0] ?? null)
        : (airportResult.data as Airport | null);

    const entryRequirements =
      input.travelerNationality !== undefined
        ? this.getEntryRequirements(input.travelerNationality, dest).data
        : Object.freeze([]);

    const environmentalContext = this.#environmental.getSevereWeatherContext(dest);

    return Object.freeze({
      destination: dest,
      destinationAirport: airport,
      entryRequirements,
      environmentalContext,
      nearbyTransit: this.searchTransit(dest, 5).data,
      nearbyCharging: airport
        ? this.findChargingLocations(airport.location.latitude, airport.location.longitude).data
        : Object.freeze([]),
      bookingConfirmed: false,
      referenceOnly: true,
    });
  }

  /** Evidence-only bundle for Travel Agent — never grants booking authority. */
  agentTravelEvidenceRef(destination: string): Record<string, unknown> {
    const context = this.buildTravelPlanningContext({ destination });
    return Object.freeze({
      kind: 'travel.observation.reference',
      destination: context.destination,
      hasEntryRequirements: context.entryRequirements.length > 0,
      hasAirport: context.destinationAirport !== null,
      hasEnvironmentalContext: context.environmentalContext !== null,
      bookingConfirmed: false,
      grantsExecutionAuthority: false,
      grantsBookingAuthority: false,
      referenceOnly: true,
      retrievedAt: this.#nowUtc(),
    });
  }

  environmentalOracle(): EnvironmentalOracleService {
    return this.#environmental;
  }
}

export function createTravelIntelligenceSandbox(): TravelIntelligenceService {
  return new TravelIntelligenceService();
}
