/**
 * Access-side productive capacity taxonomy.
 *
 * Mirrors canonical productive/oracle semantics without redefining owners.
 */

export const CAPACITY_SLICE_SCHEMA = 'sunrey.access.capacity-slice.v1' as const;
export const ACCESS_PRODUCTIVE_CAPACITY_CHUNK = 'ACCESS-03' as const;

export const CAPACITY_SOURCE_CLASSES = [
  'CANONICAL_PRODUCTIVE_REGISTRY',
  'CANONICAL_ORACLE_FACT',
  'SIMULATION_FIXTURE',
] as const;
export type CapacitySourceClass = (typeof CAPACITY_SOURCE_CLASSES)[number];

export const CAPACITY_VERIFICATION_STATUSES = [
  'VERIFIED',
  'PENDING',
  'STALE',
  'DISPUTED',
  'REJECTED',
  'MARKETING_UNPROVENANCED',
] as const;
export type CapacityVerificationStatus = (typeof CAPACITY_VERIFICATION_STATUSES)[number];

export const CAPACITY_FRESHNESS_STATES = ['FRESH', 'AGING', 'STALE', 'EXPIRED'] as const;
export type CapacityFreshnessState = (typeof CAPACITY_FRESHNESS_STATES)[number];

export const SERVICE_QUALITY_CLASSES = [
  'STANDARD',
  'PREMIUM',
  'BUSINESS',
  'ECONOMY',
  'GPU_A100',
  'GPU_H100',
  'ROBOT_INDUSTRIAL',
  'ROBOT_COLLABORATIVE',
  'PASSENGER_VEHICLE',
  'HOTEL_ROOM_NIGHT',
  'AIRLINE_SEAT',
  'FOOD_DELIVERY',
  'FOOD_PRODUCTION',
  'ENERGY_GRID',
] as const;
export type ServiceQualityClass = (typeof SERVICE_QUALITY_CLASSES)[number];

export const CAPACITY_QUERY_KINDS = ['AVAILABILITY', 'UTILIZATION'] as const;
export type CapacityQueryKind = (typeof CAPACITY_QUERY_KINDS)[number];

export const CAPACITY_REJECTION_CODES = [
  'INVALID_TIME_WINDOW',
  'GEOGRAPHY_MISMATCH',
  'QUALITY_MISMATCH',
  'CATEGORY_MISMATCH',
  'STALE_EVIDENCE',
  'UNPROVENANCED_SOURCE',
  'ZERO_CAPACITY',
  'NEGATIVE_CAPACITY',
  'EXHAUSTED_CAPACITY',
  'MARKETING_WITHOUT_PROVENANCE',
  'PORT_READ_ONLY',
  'UNKNOWN_SLICE',
] as const;
export type CapacityRejectionCode = (typeof CAPACITY_REJECTION_CODES)[number];

export const SIMULATION_FIXTURE_PREFIX = 'sim_access_fixture_' as const;
export const SIMULATION_OPERATOR_PREFIX = 'sim_access_operator_' as const;
export const SIMULATION_PROVENANCE_PREFIX = 'sim_access_provenance_' as const;
