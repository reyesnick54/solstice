/**
 * ACCESS Wave 2 Prompt 31 — free/open access discovery types.
 *
 * Discovery observations are not funded capacity, bookings, or settlements.
 */

import type { AccessCapacityCategory } from '../taxonomy.ts';

export type { AccessCapacityCategory } from '../taxonomy.ts';

export const ACCESS_DISCOVERY_PROVIDER_IDS = [
  'gbfs',
  'transitland',
  'transport-rest',
  'open-charge-map',
  'national-park-service',
  'recreation-gov-ridb',
] as const;
export type AccessDiscoveryProviderId = (typeof ACCESS_DISCOVERY_PROVIDER_IDS)[number];

export const ACCESS_PROVIDER_CAPABILITY_IDS = [
  'DISCOVER',
  'SEARCH',
  'AVAILABILITY',
  'LOCATION',
  'STATUS',
  'SCHEDULE',
  'REFERENCE_PRICE',
  'INVENTORY_METADATA',
] as const;
export type AccessProviderCapabilityId = (typeof ACCESS_PROVIDER_CAPABILITY_IDS)[number];

export const DISCOVERY_AVAILABILITY_STATES = [
  'AVAILABLE',
  'LIMITED',
  'UNAVAILABLE',
  'UNKNOWN',
  'STALE',
] as const;
export type DiscoveryAvailabilityState = (typeof DISCOVERY_AVAILABILITY_STATES)[number];

export const DISCOVERY_CAPACITY_UNITS = [
  'RIDE',
  'TRIP',
  'VEHICLE_HOUR',
  'VEHICLE_DAY',
  'EXPERIENCE_SLOT',
  'KWH',
] as const;
export type DiscoveryCapacityUnit = (typeof DISCOVERY_CAPACITY_UNITS)[number];

export const DISCOVERY_AUTHORITY_CLASSES = [
  'official_public',
  'community_data',
  'open_data',
  'simulation_fixture',
] as const;
export type DiscoveryAuthorityClass = (typeof DISCOVERY_AUTHORITY_CLASSES)[number];

export type AccessProviderCapability = {
  readonly capabilityId: AccessProviderCapabilityId;
  readonly supported: boolean;
  readonly notes: string | null;
};

export type DiscoveryGeography = {
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm: number | null;
  readonly countryCode: string | null;
  readonly regionCode: string | null;
};

export type DiscoveryLocation = {
  readonly label: string | null;
  readonly geography: DiscoveryGeography;
};

export type DiscoveryFreshness = {
  readonly retrievedAt: string;
  readonly sourceTimestamp: string | null;
  readonly freshnessStatus: 'fresh' | 'stale' | 'expired' | 'unknown';
  readonly stale: boolean;
};

export type DiscoveryProvenance = {
  readonly providerId: AccessDiscoveryProviderId | string;
  readonly sourceObservationId: string;
  readonly authorityClass: DiscoveryAuthorityClass;
  readonly simulationOnly: boolean;
  readonly referenceOnly: true;
};

export type DiscoveryReferencePrice = {
  readonly kind: 'REFERENCE_PRICE';
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly sourceTimestamp: string | null;
  readonly providerId: AccessDiscoveryProviderId | string;
  readonly freshness: DiscoveryFreshness;
  readonly notes: string | null;
};

export type AccessOpportunity = {
  readonly opportunityId: string;
  readonly category: AccessCapacityCategory;
  readonly accessProductId: string | null;
  readonly providerId: AccessDiscoveryProviderId | string;
  readonly providerItemId: string;
  readonly name: string;
  readonly description: string | null;
  readonly location: DiscoveryLocation | null;
  readonly geography: DiscoveryGeography | null;
  readonly availableUnits: bigint | null;
  readonly unit: DiscoveryCapacityUnit | null;
  readonly availabilityWindow: { readonly start: string; readonly end: string } | null;
  readonly referencePrice: DiscoveryReferencePrice | null;
  readonly currency: string | null;
  readonly status: DiscoveryAvailabilityState;
  readonly sourceTimestamp: string | null;
  readonly retrievedAt: string;
  readonly freshness: DiscoveryFreshness;
  readonly confidence: number;
  readonly provenance: DiscoveryProvenance;
  readonly discoveryOnly: true;
  readonly fundedCapacity: false;
  readonly bookingSupported: false;
};

export type AccessCapacityCandidate = {
  readonly candidateId: string;
  readonly providerId: AccessDiscoveryProviderId | string;
  readonly providerItemId: string;
  readonly category: AccessCapacityCategory;
  readonly unit: DiscoveryCapacityUnit;
  readonly estimatedAvailableUnits: bigint | null;
  readonly geography: DiscoveryGeography;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly referencePrice: DiscoveryReferencePrice | null;
  readonly currency: string | null;
  readonly availabilityStatus: DiscoveryAvailabilityState;
  readonly sourceObservationId: string;
  readonly confidence: number;
  readonly createdAt: string;
  readonly fundedCapacity: false;
  readonly requiresExplicitApproval: true;
};

export type AccessSearchRequest = {
  readonly category: AccessCapacityCategory | null;
  readonly location: DiscoveryGeography | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly units: bigint | null;
  readonly unit: DiscoveryCapacityUnit | null;
  readonly radiusKm: number | null;
  readonly filters: Readonly<Record<string, string>>;
  readonly sort: 'relevance' | 'distance' | 'freshness';
  readonly page: number;
  readonly pageSize: number;
  readonly query: string | null;
};

export type AccessSearchResult = {
  readonly opportunities: readonly AccessOpportunity[];
  readonly resultCount: number;
  readonly nextPage: number | null;
  readonly status: 'OK' | 'DEGRADED' | 'PARTIAL' | 'FAILED';
  readonly freshness: DiscoveryFreshness;
  readonly searchContext: {
    readonly category: AccessCapacityCategory | null;
    readonly bounded: true;
    readonly privacySafe: true;
  };
};

export type AccessDiscoveryFailure = {
  readonly ok: false;
  readonly code:
    | 'QUERY_LIMIT_EXCEEDED'
    | 'INVALID_PARAMETER'
    | 'PROVIDER_TIMEOUT'
    | 'PROVIDER_RATE_LIMITED'
    | 'PROVIDER_FAILURE'
    | 'PRIVACY_VIOLATION';
  readonly message: string;
};

export type AccessDiscoverySuccess<T> = {
  readonly ok: true;
  readonly value: T;
};

export type AccessDiscoveryOutcome<T> = AccessDiscoverySuccess<T> | AccessDiscoveryFailure;
