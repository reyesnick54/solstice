/**
 * ACCESS Wave 2 Prompt 31 — access discovery provider types (GBFS, NPS, RIDB).
 */

import type { UtcInstant } from '../../../domain/src/time.ts';

export type AccessDiscoveryGeoCoordinate = {
  readonly latitude: number;
  readonly longitude: number;
};

export type AccessDiscoveryFreshnessInfo = {
  readonly freshnessStatus: 'fresh' | 'stale' | 'expired' | 'unknown';
  readonly retrievedAt: UtcInstant;
  readonly sourceTimestamp: UtcInstant | null;
};

export type GbfsSystemInfo = {
  readonly systemId: string;
  readonly name: string;
  readonly language: string;
  readonly timezone: string;
};

export type GbfsStationInfo = {
  readonly stationId: string;
  readonly systemId: string;
  readonly name: string;
  readonly location: AccessDiscoveryGeoCoordinate;
  readonly capacity: number | null;
  readonly vehicleTypes: readonly string[];
};

export type GbfsStationStatus = {
  readonly stationId: string;
  readonly systemId: string;
  readonly vehiclesAvailable: number | null;
  readonly docksAvailable: number | null;
  readonly isInstalled: boolean;
  readonly isRenting: boolean;
  readonly isReturning: boolean;
  readonly lastReported: UtcInstant | null;
};

export type GbfsPricingPlan = {
  readonly planId: string;
  readonly name: string;
  readonly currency: string;
  readonly priceMinorUnits: bigint | null;
  readonly per: 'RIDE' | 'MINUTE' | 'HOUR' | 'DAY';
};

export type GbfsStationObservation = {
  readonly station: GbfsStationInfo;
  readonly status: GbfsStationStatus;
  readonly pricingPlan: GbfsPricingPlan | null;
  readonly providerId: 'gbfs';
  readonly freshness: AccessDiscoveryFreshnessInfo;
  readonly sourceObservationId: string;
};

export type NpsParkRecord = {
  readonly parkCode: string;
  readonly fullName: string;
  readonly description: string | null;
  readonly location: AccessDiscoveryGeoCoordinate;
  readonly states: readonly string[];
  readonly alerts: readonly string[];
  readonly visitorInfo: string | null;
  readonly providerId: 'national-park-service';
  readonly freshness: AccessDiscoveryFreshnessInfo;
  readonly sourceObservationId: string;
};

export type RidbFacilityRecord = {
  readonly facilityId: string;
  readonly facilityName: string;
  readonly activityDescription: string | null;
  readonly location: AccessDiscoveryGeoCoordinate;
  readonly reservable: boolean;
  readonly permitRequired: boolean;
  readonly referencePriceMinorUnits: bigint | null;
  readonly currency: string | null;
  readonly providerId: 'recreation-gov-ridb';
  readonly freshness: AccessDiscoveryFreshnessInfo;
  readonly sourceObservationId: string;
};

export type AccessDiscoveryProviderObservation<T> = {
  readonly providerId: string;
  readonly capability: string;
  readonly collectedAtUtc: UtcInstant;
  readonly stale: boolean;
  readonly simulation: true;
  readonly data: T;
};

export const ACCESS_DISCOVERY_ADAPTER_IDS = [
  'gbfs',
  'national-park-service',
  'recreation-gov-ridb',
] as const;

export type AccessDiscoveryAdapterId = (typeof ACCESS_DISCOVERY_ADAPTER_IDS)[number];

export type AccessDiscoveryProviderHealth = {
  readonly providerId: AccessDiscoveryAdapterId;
  readonly healthy: boolean;
  readonly degraded: boolean;
  readonly message: string;
  readonly capabilities: readonly string[];
};

export type AccessDiscoveryServiceResult<T> = {
  readonly data: T;
  readonly providerId: string;
  readonly stale: boolean;
  readonly degraded: boolean;
  readonly warnings: readonly string[];
};
