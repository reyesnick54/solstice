import type { FeedSchemaDefinition } from '../../types.ts';
import type { RealEstateFactType, RealEstateSourceClass } from './types.ts';

export const REAL_ESTATE_SCHEMA_IDS = Object.freeze({
  PROPERTY_MANAGEMENT_SYSTEM: 'real-estate.property-management.v1',
  SPACE_BOOKING_SYSTEM: 'real-estate.space-booking.v1',
  BUILDING_MANAGEMENT_SYSTEM: 'real-estate.building-management.v1',
  LEASE_ADMINISTRATION_REFERENCE: 'real-estate.lease-administration.v1',
  AGGREGATE_ACCESS_CONTROL: 'real-estate.aggregate-access.v1',
  COWORKING_USAGE_SYSTEM: 'real-estate.coworking-usage.v1',
  INDUSTRIAL_FACILITY_UTILIZATION: 'real-estate.industrial-utilization.v1',
  COMMERCIAL_SPACE_METER: 'real-estate.commercial-meter.v1',
  WAREHOUSE_SPACE_REFERENCE: 'real-estate.warehouse-space.v1',
  INDEPENDENT_OCCUPANCY_ATTESTATION: 'real-estate.occupancy-attestation.v1',
} as const);

const REQUIRED = Object.freeze([
  'identifier',
  'numericValue',
  'unit',
  'areaMantissa',
  'measurementStartUnix',
  'measurementEndUnix',
  'usageState',
  'sourceTimestampUnix',
]);

function usageSchema(schemaId: string): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId,
    version: 1,
    factType: 'REAL_ESTATE_USAGE',
    requiredFields: REQUIRED,
    unit: 'm2_hour',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

function capacitySchema(schemaId: string): FeedSchemaDefinition {
  return Object.freeze({
    ...usageSchema(schemaId),
    factType: 'REAL_ESTATE_USE_CAPACITY',
    unit: 'm2',
  });
}

const CAPACITY_CLASSES = new Set<RealEstateSourceClass>([
  'LEASE_ADMINISTRATION_REFERENCE',
  'WAREHOUSE_SPACE_REFERENCE',
]);

export const REAL_ESTATE_FEED_SCHEMAS: Readonly<Record<RealEstateSourceClass, FeedSchemaDefinition>> = Object.freeze({
  PROPERTY_MANAGEMENT_SYSTEM: usageSchema(REAL_ESTATE_SCHEMA_IDS.PROPERTY_MANAGEMENT_SYSTEM),
  SPACE_BOOKING_SYSTEM: usageSchema(REAL_ESTATE_SCHEMA_IDS.SPACE_BOOKING_SYSTEM),
  BUILDING_MANAGEMENT_SYSTEM: usageSchema(REAL_ESTATE_SCHEMA_IDS.BUILDING_MANAGEMENT_SYSTEM),
  LEASE_ADMINISTRATION_REFERENCE: capacitySchema(REAL_ESTATE_SCHEMA_IDS.LEASE_ADMINISTRATION_REFERENCE),
  AGGREGATE_ACCESS_CONTROL: usageSchema(REAL_ESTATE_SCHEMA_IDS.AGGREGATE_ACCESS_CONTROL),
  COWORKING_USAGE_SYSTEM: usageSchema(REAL_ESTATE_SCHEMA_IDS.COWORKING_USAGE_SYSTEM),
  INDUSTRIAL_FACILITY_UTILIZATION: usageSchema(REAL_ESTATE_SCHEMA_IDS.INDUSTRIAL_FACILITY_UTILIZATION),
  COMMERCIAL_SPACE_METER: usageSchema(REAL_ESTATE_SCHEMA_IDS.COMMERCIAL_SPACE_METER),
  WAREHOUSE_SPACE_REFERENCE: capacitySchema(REAL_ESTATE_SCHEMA_IDS.WAREHOUSE_SPACE_REFERENCE),
  INDEPENDENT_OCCUPANCY_ATTESTATION: usageSchema(REAL_ESTATE_SCHEMA_IDS.INDEPENDENT_OCCUPANCY_ATTESTATION),
});

export function defaultFactFor(sourceClass: RealEstateSourceClass): RealEstateFactType {
  return CAPACITY_CLASSES.has(sourceClass) ? 'REAL_ESTATE_USE_CAPACITY' : 'REAL_ESTATE_USAGE';
}

export function realEstateFeedSchema(sourceClass: RealEstateSourceClass): FeedSchemaDefinition {
  return REAL_ESTATE_FEED_SCHEMAS[sourceClass];
}

export function realEstateSchemaDrift(input: {
  readonly sourceClass: RealEstateSourceClass;
  readonly schemaId: string;
  readonly schemaVersion: number;
}): boolean {
  const expected = REAL_ESTATE_FEED_SCHEMAS[input.sourceClass];
  return input.schemaId !== expected.schemaId || input.schemaVersion !== expected.version;
}
