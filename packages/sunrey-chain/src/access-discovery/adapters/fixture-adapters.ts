/**
 * ACCESS Wave 2 Prompt 31 — fixture adapters for GBFS, NPS, and RIDB.
 * Simulation only — no live provider HTTP.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AccessDiscoveryAdapterId,
  AccessDiscoveryProviderHealth,
  AccessDiscoveryProviderObservation,
  GbfsStationObservation,
  NpsParkRecord,
  RidbFacilityRecord,
} from '../types.ts';
import {
  FIXTURE_GBFS_OBSERVATIONS,
  FIXTURE_NPS_PARKS,
  FIXTURE_RIDB_FACILITIES,
} from '../fixtures/data.ts';

type Clock = { readonly nowUtc: () => string };

const defaultClock = (): Clock => ({ nowUtc: () => new Date().toISOString() });

function envelope<T>(
  providerId: AccessDiscoveryAdapterId,
  capability: string,
  data: T,
  clock: Clock,
  stale = false,
): AccessDiscoveryProviderObservation<T> {
  return Object.freeze({
    providerId,
    capability,
    collectedAtUtc: clock.nowUtc() as UtcInstant,
    stale,
    simulation: true as const,
    data,
  });
}

abstract class BaseAccessDiscoveryFixtureProvider {
  abstract readonly providerId: AccessDiscoveryAdapterId;
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

  markTimeout(): void {
    this.healthy = false;
    this.message = 'provider timeout';
  }

  health(): AccessDiscoveryProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      healthy: this.healthy,
      degraded: this.degraded,
      message: this.message,
      capabilities: this.capabilities,
    });
  }
}

export class GbfsFixtureProvider extends BaseAccessDiscoveryFixtureProvider {
  readonly providerId = 'gbfs' as const;
  readonly capabilities = Object.freeze([
    'gbfs_system_information',
    'gbfs_station_information',
    'gbfs_station_status',
    'gbfs_vehicle_types',
    'gbfs_pricing_plans',
  ]);

  searchStations(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ): AccessDiscoveryProviderObservation<readonly GbfsStationObservation[]> {
    if (!this.healthy) {
      return envelope(this.providerId, 'gbfs_station_information', Object.freeze([]), this.clock, true);
    }
    const results = FIXTURE_GBFS_OBSERVATIONS.filter((row) => {
      const latDiff = Math.abs(row.station.location.latitude - latitude);
      const lonDiff = Math.abs(row.station.location.longitude - longitude);
      return latDiff + lonDiff <= radiusKm / 100;
    }).slice(0, limit);
    return envelope(this.providerId, 'gbfs_station_information', results, this.clock, this.degraded);
  }
}

export class NpsFixtureProvider extends BaseAccessDiscoveryFixtureProvider {
  readonly providerId = 'national-park-service' as const;
  readonly capabilities = Object.freeze([
    'nps_parks',
    'nps_events',
    'nps_campgrounds',
    'nps_alerts',
    'nps_visitor_information',
  ]);

  searchParks(query: string, limit: number): AccessDiscoveryProviderObservation<readonly NpsParkRecord[]> {
    if (!this.healthy) {
      return envelope(this.providerId, 'nps_parks', Object.freeze([]), this.clock, true);
    }
    const q = query.toLowerCase();
    const results = FIXTURE_NPS_PARKS.filter(
      (park) =>
        park.fullName.toLowerCase().includes(q) ||
        park.parkCode.toLowerCase().includes(q) ||
        q.length === 0,
    ).slice(0, limit);
    return envelope(this.providerId, 'nps_parks', results, this.clock, this.degraded);
  }
}

export class RidbFixtureProvider extends BaseAccessDiscoveryFixtureProvider {
  readonly providerId = 'recreation-gov-ridb' as const;
  readonly capabilities = Object.freeze([
    'ridb_campgrounds',
    'ridb_facilities',
    'ridb_tours',
    'ridb_activities',
    'ridb_permit_metadata',
  ]);

  searchFacilities(
    query: string,
    limit: number,
  ): AccessDiscoveryProviderObservation<readonly RidbFacilityRecord[]> {
    if (!this.healthy) {
      return envelope(this.providerId, 'ridb_facilities', Object.freeze([]), this.clock, true);
    }
    const q = query.toLowerCase();
    const results = FIXTURE_RIDB_FACILITIES.filter(
      (facility) =>
        facility.facilityName.toLowerCase().includes(q) ||
        (facility.activityDescription?.toLowerCase().includes(q) ?? false) ||
        q.length === 0,
    ).slice(0, limit);
    return envelope(this.providerId, 'ridb_facilities', results, this.clock, this.degraded);
  }
}

export function createAccessDiscoveryFixtureProviders(clock?: Clock): Readonly<Record<AccessDiscoveryAdapterId, GbfsFixtureProvider | NpsFixtureProvider | RidbFixtureProvider>> {
  const c = clock ?? defaultClock();
  return Object.freeze({
    gbfs: new GbfsFixtureProvider(c),
    'national-park-service': new NpsFixtureProvider(c),
    'recreation-gov-ridb': new RidbFixtureProvider(c),
  });
}

export type AccessDiscoveryFixtureProviders = ReturnType<typeof createAccessDiscoveryFixtureProviders>;
