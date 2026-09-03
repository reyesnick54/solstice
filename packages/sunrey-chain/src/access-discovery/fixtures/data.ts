/**
 * ACCESS Wave 2 Prompt 31 — fixture data for GBFS, NPS, and RIDB discovery providers.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  GbfsPricingPlan,
  GbfsStationInfo,
  GbfsStationObservation,
  GbfsStationStatus,
  GbfsSystemInfo,
  NpsParkRecord,
  RidbFacilityRecord,
} from '../types.ts';

const NOW = '2026-08-31T12:00:00.000Z' as UtcInstant;

export const FIXTURE_GBFS_SYSTEM: GbfsSystemInfo = Object.freeze({
  systemId: 'demo_city_bikes',
  name: 'Demo City Bikes',
  language: 'en',
  timezone: 'America/New_York',
});

export const FIXTURE_GBFS_STATIONS: readonly GbfsStationInfo[] = Object.freeze([
  Object.freeze({
    stationId: 'station_001',
    systemId: FIXTURE_GBFS_SYSTEM.systemId,
    name: 'Central Park Station',
    location: Object.freeze({ latitude: 40.7829, longitude: -73.9654 }),
    capacity: 30,
    vehicleTypes: Object.freeze(['classic_bike', 'ebike']),
  }),
  Object.freeze({
    stationId: 'station_002',
    systemId: FIXTURE_GBFS_SYSTEM.systemId,
    name: 'Times Square Station',
    location: Object.freeze({ latitude: 40.758, longitude: -73.9855 }),
    capacity: 45,
    vehicleTypes: Object.freeze(['classic_bike']),
  }),
]);

export const FIXTURE_GBFS_STATUS: Readonly<Record<string, GbfsStationStatus>> = Object.freeze({
  station_001: Object.freeze({
    stationId: 'station_001',
    systemId: FIXTURE_GBFS_SYSTEM.systemId,
    vehiclesAvailable: 12,
    docksAvailable: 18,
    isInstalled: true,
    isRenting: true,
    isReturning: true,
    lastReported: NOW,
  }),
  station_002: Object.freeze({
    stationId: 'station_002',
    systemId: FIXTURE_GBFS_SYSTEM.systemId,
    vehiclesAvailable: 3,
    docksAvailable: 42,
    isInstalled: true,
    isRenting: true,
    isReturning: true,
    lastReported: NOW,
  }),
});

export const FIXTURE_GBFS_PRICING: GbfsPricingPlan = Object.freeze({
  planId: 'plan_unlock',
  name: 'Unlock + per minute',
  currency: 'USD',
  priceMinorUnits: 100n,
  per: 'MINUTE',
});

export const FIXTURE_GBFS_OBSERVATIONS: readonly GbfsStationObservation[] = Object.freeze(
  FIXTURE_GBFS_STATIONS.map((station) => {
    const status = FIXTURE_GBFS_STATUS[station.stationId]!;
    return Object.freeze({
      station,
      status,
      pricingPlan: FIXTURE_GBFS_PRICING,
      providerId: 'gbfs' as const,
      freshness: Object.freeze({
        freshnessStatus: 'fresh' as const,
        retrievedAt: NOW,
        sourceTimestamp: status.lastReported,
      }),
      sourceObservationId: `obs_gbfs_${station.stationId}`,
    });
  }),
);

export const FIXTURE_NPS_PARKS: readonly NpsParkRecord[] = Object.freeze([
  Object.freeze({
    parkCode: 'yell',
    fullName: 'Yellowstone National Park',
    description: 'First national park — geothermal features and wildlife.',
    location: Object.freeze({ latitude: 44.428, longitude: -110.5885 }),
    states: Object.freeze(['WY', 'MT', 'ID']),
    alerts: Object.freeze(['North entrance road construction — check NPS alerts.']),
    visitorInfo: 'Most roads open late April through early November.',
    providerId: 'national-park-service',
    freshness: Object.freeze({
      freshnessStatus: 'fresh' as const,
      retrievedAt: NOW,
      sourceTimestamp: NOW,
    }),
    sourceObservationId: 'obs_nps_yell',
  }),
  Object.freeze({
    parkCode: 'grca',
    fullName: 'Grand Canyon National Park',
    description: 'Iconic canyon views on the Colorado Plateau.',
    location: Object.freeze({ latitude: 36.0544, longitude: -112.1401 }),
    states: Object.freeze(['AZ']),
    alerts: Object.freeze([]),
    visitorInfo: 'South Rim open year-round.',
    providerId: 'national-park-service',
    freshness: Object.freeze({
      freshnessStatus: 'fresh' as const,
      retrievedAt: NOW,
      sourceTimestamp: NOW,
    }),
    sourceObservationId: 'obs_nps_grca',
  }),
]);

export const FIXTURE_RIDB_FACILITIES: readonly RidbFacilityRecord[] = Object.freeze([
  Object.freeze({
    facilityId: 'ridb_camp_001',
    facilityName: 'Madison Campground',
    activityDescription: 'Campground near Yellowstone geysers.',
    location: Object.freeze({ latitude: 44.58, longitude: -110.86 }),
    reservable: true,
    permitRequired: false,
    referencePriceMinorUnits: 3500n,
    currency: 'USD',
    providerId: 'recreation-gov-ridb',
    freshness: Object.freeze({
      freshnessStatus: 'fresh' as const,
      retrievedAt: NOW,
      sourceTimestamp: NOW,
    }),
    sourceObservationId: 'obs_ridb_camp_001',
  }),
  Object.freeze({
    facilityId: 'ridb_tour_001',
    facilityName: 'Canyon Rim Guided Walk',
    activityDescription: 'Ranger-led rim walk — reference inventory only.',
    location: Object.freeze({ latitude: 36.05, longitude: -112.12 }),
    reservable: false,
    permitRequired: true,
    referencePriceMinorUnits: null,
    currency: null,
    providerId: 'recreation-gov-ridb',
    freshness: Object.freeze({
      freshnessStatus: 'unknown' as const,
      retrievedAt: NOW,
      sourceTimestamp: null,
    }),
    sourceObservationId: 'obs_ridb_tour_001',
  }),
]);
