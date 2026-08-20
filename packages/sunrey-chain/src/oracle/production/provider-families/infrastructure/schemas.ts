import type { FeedSchemaDefinition } from '../../types.ts';
import type { InfrastructureFactType, InfrastructureSourceClass } from './types.ts';

export const INFRASTRUCTURE_SCHEMA_IDS = Object.freeze({
  FACILITY_MANAGEMENT_SYSTEM: 'infrastructure.facility-management.v2',
  TERMINAL_USAGE_SYSTEM: 'infrastructure.terminal-usage.v2',
  PORT_INFRASTRUCTURE_SYSTEM: 'infrastructure.port.v2',
  AIRPORT_INFRASTRUCTURE_SYSTEM: 'infrastructure.airport.v2',
  RAIL_TERMINAL_SYSTEM: 'infrastructure.rail-terminal.v2',
  DATA_CENTER_FACILITY_SYSTEM: 'infrastructure.data-center.v2',
  PUBLIC_ASSET_UTILIZATION_REFERENCE: 'infrastructure.public-asset.v2',
  INDUSTRIAL_INFRASTRUCTURE_METER: 'infrastructure.industrial-meter.v2',
  INDEPENDENT_INFRASTRUCTURE_ATTESTATION: 'infrastructure.attestation.v2',
  LEGACY_INFRASTRUCTURE_USAGE_V1: 'infrastructure.usage.v1',
  LEGACY_INFRASTRUCTURE_CAPACITY_V1: 'infrastructure.capacity.v1',
} as const);

const REQUIRED = Object.freeze([
  'identifier',
  'numericValue',
  'unit',
  'facilityUnits',
  'measurementStartUnix',
  'measurementEndUnix',
  'usageState',
  'infrastructureClass',
  'sourceTimestampUnix',
]);

function facilitySchema(schemaId: string, factType: InfrastructureFactType): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId,
    version: 2,
    factType,
    requiredFields: REQUIRED,
    unit: 'facility_hour',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

export const INFRASTRUCTURE_FEED_SCHEMAS: Readonly<Record<InfrastructureSourceClass, FeedSchemaDefinition>> =
  Object.freeze({
    FACILITY_MANAGEMENT_SYSTEM: facilitySchema(INFRASTRUCTURE_SCHEMA_IDS.FACILITY_MANAGEMENT_SYSTEM, 'INFRASTRUCTURE_USAGE'),
    TERMINAL_USAGE_SYSTEM: facilitySchema(INFRASTRUCTURE_SCHEMA_IDS.TERMINAL_USAGE_SYSTEM, 'INFRASTRUCTURE_USAGE'),
    PORT_INFRASTRUCTURE_SYSTEM: facilitySchema(INFRASTRUCTURE_SCHEMA_IDS.PORT_INFRASTRUCTURE_SYSTEM, 'INFRASTRUCTURE_USAGE'),
    AIRPORT_INFRASTRUCTURE_SYSTEM: facilitySchema(INFRASTRUCTURE_SCHEMA_IDS.AIRPORT_INFRASTRUCTURE_SYSTEM, 'INFRASTRUCTURE_USAGE'),
    RAIL_TERMINAL_SYSTEM: facilitySchema(INFRASTRUCTURE_SCHEMA_IDS.RAIL_TERMINAL_SYSTEM, 'INFRASTRUCTURE_USAGE'),
    DATA_CENTER_FACILITY_SYSTEM: facilitySchema(INFRASTRUCTURE_SCHEMA_IDS.DATA_CENTER_FACILITY_SYSTEM, 'INFRASTRUCTURE_USAGE'),
    PUBLIC_ASSET_UTILIZATION_REFERENCE: facilitySchema(
      INFRASTRUCTURE_SCHEMA_IDS.PUBLIC_ASSET_UTILIZATION_REFERENCE,
      'INFRASTRUCTURE_CAPACITY',
    ),
    INDUSTRIAL_INFRASTRUCTURE_METER: facilitySchema(
      INFRASTRUCTURE_SCHEMA_IDS.INDUSTRIAL_INFRASTRUCTURE_METER,
      'INFRASTRUCTURE_USAGE',
    ),
    INDEPENDENT_INFRASTRUCTURE_ATTESTATION: facilitySchema(
      INFRASTRUCTURE_SCHEMA_IDS.INDEPENDENT_INFRASTRUCTURE_ATTESTATION,
      'INFRASTRUCTURE_USAGE',
    ),
  });

export function defaultFactFor(sourceClass: InfrastructureSourceClass): InfrastructureFactType {
  return sourceClass === 'PUBLIC_ASSET_UTILIZATION_REFERENCE' ? 'INFRASTRUCTURE_CAPACITY' : 'INFRASTRUCTURE_USAGE';
}

export function infrastructureFeedSchema(sourceClass: InfrastructureSourceClass): FeedSchemaDefinition {
  return INFRASTRUCTURE_FEED_SCHEMAS[sourceClass];
}

export function infrastructureSchemaDrift(input: {
  readonly sourceClass: InfrastructureSourceClass;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly unitSemantics: string;
}): boolean {
  if (input.unitSemantics === 'LEGACY_INFRASTRUCTURE_MACHINE_H_V1') {
    return (
      input.schemaId !== INFRASTRUCTURE_SCHEMA_IDS.LEGACY_INFRASTRUCTURE_USAGE_V1 &&
      input.schemaId !== INFRASTRUCTURE_SCHEMA_IDS.LEGACY_INFRASTRUCTURE_CAPACITY_V1
    );
  }
  const expected = INFRASTRUCTURE_FEED_SCHEMAS[input.sourceClass];
  return input.schemaId !== expected.schemaId || input.schemaVersion !== expected.version;
}
