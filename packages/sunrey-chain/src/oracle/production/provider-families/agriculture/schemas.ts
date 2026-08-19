import type { FeedSchemaDefinition } from '../../types.ts';
import type { AgricultureSourceClass } from './types.ts';

export const AGRICULTURE_SCHEMA_IDS = Object.freeze({
  FARM_MANAGEMENT_SYSTEM: 'agriculture.farm-management.v1',
  HARVEST_METER: 'agriculture.harvest-meter.v1',
  GRAIN_SCALE: 'agriculture.grain-scale.v1',
  PACKHOUSE_SYSTEM: 'agriculture.packhouse.v1',
  AGRICULTURAL_EQUIPMENT_TELEMETRY: 'agriculture.equipment.v1',
  SILO_INVENTORY_SYSTEM: 'agriculture.silo-inventory.v1',
  COOPERATIVE_PRODUCTION_LEDGER: 'agriculture.cooperative.v1',
  DAIRY_PRODUCTION_METER: 'agriculture.dairy.v1',
  GREENHOUSE_PRODUCTION_SYSTEM: 'agriculture.greenhouse.v1',
  AQUACULTURE_PRODUCTION_SYSTEM: 'agriculture.aquaculture.v1',
  INDEPENDENT_AGRICULTURAL_ATTESTATION: 'agriculture.attestation.v1',
  REGULATORY_AGRICULTURAL_REFERENCE: 'agriculture.regulatory.v1',
} as const);

const REQUIRED = Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']);

function massSchema(schemaId: string, factType: 'FOOD_PRODUCTION' | 'AGRICULTURAL_OUTPUT' = 'AGRICULTURAL_OUTPUT'): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId,
    version: 1,
    factType,
    requiredFields: REQUIRED,
    unit: 'kg',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

export const AGRICULTURE_FEED_SCHEMAS: Readonly<Record<AgricultureSourceClass, FeedSchemaDefinition>> = Object.freeze({
  FARM_MANAGEMENT_SYSTEM: massSchema(AGRICULTURE_SCHEMA_IDS.FARM_MANAGEMENT_SYSTEM),
  HARVEST_METER: massSchema(AGRICULTURE_SCHEMA_IDS.HARVEST_METER),
  GRAIN_SCALE: massSchema(AGRICULTURE_SCHEMA_IDS.GRAIN_SCALE),
  PACKHOUSE_SYSTEM: massSchema(AGRICULTURE_SCHEMA_IDS.PACKHOUSE_SYSTEM, 'FOOD_PRODUCTION'),
  AGRICULTURAL_EQUIPMENT_TELEMETRY: massSchema(AGRICULTURE_SCHEMA_IDS.AGRICULTURAL_EQUIPMENT_TELEMETRY),
  SILO_INVENTORY_SYSTEM: massSchema(AGRICULTURE_SCHEMA_IDS.SILO_INVENTORY_SYSTEM),
  COOPERATIVE_PRODUCTION_LEDGER: massSchema(AGRICULTURE_SCHEMA_IDS.COOPERATIVE_PRODUCTION_LEDGER, 'FOOD_PRODUCTION'),
  DAIRY_PRODUCTION_METER: massSchema(AGRICULTURE_SCHEMA_IDS.DAIRY_PRODUCTION_METER, 'FOOD_PRODUCTION'),
  GREENHOUSE_PRODUCTION_SYSTEM: massSchema(AGRICULTURE_SCHEMA_IDS.GREENHOUSE_PRODUCTION_SYSTEM, 'FOOD_PRODUCTION'),
  AQUACULTURE_PRODUCTION_SYSTEM: massSchema(AGRICULTURE_SCHEMA_IDS.AQUACULTURE_PRODUCTION_SYSTEM, 'FOOD_PRODUCTION'),
  INDEPENDENT_AGRICULTURAL_ATTESTATION: massSchema(AGRICULTURE_SCHEMA_IDS.INDEPENDENT_AGRICULTURAL_ATTESTATION),
  REGULATORY_AGRICULTURAL_REFERENCE: massSchema(AGRICULTURE_SCHEMA_IDS.REGULATORY_AGRICULTURAL_REFERENCE),
});

export function agricultureFeedSchema(sourceClass: AgricultureSourceClass): FeedSchemaDefinition {
  return AGRICULTURE_FEED_SCHEMAS[sourceClass];
}

export function agricultureSchemaDrift(input: {
  readonly sourceClass: AgricultureSourceClass;
  readonly schemaId: string;
  readonly schemaVersion: number;
}): boolean {
  const expected = AGRICULTURE_FEED_SCHEMAS[input.sourceClass];
  return input.schemaId !== expected.schemaId || input.schemaVersion !== expected.version;
}

const CREDENTIAL_KEY = /(api[_-]?key|password|secret|credential|token|private[_-]?key|authorization)/i;

export function containsAgricultureCredentialLeak(value: unknown, key = ''): boolean {
  if (CREDENTIAL_KEY.test(key)) {
    return true;
  }
  if (typeof value === 'string') {
    return /\b(sk-|Bearer |BEGIN (RSA |EC )?PRIVATE KEY)\b/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsAgricultureCredentialLeak(item));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([childKey, child]) =>
      containsAgricultureCredentialLeak(child, childKey),
    );
  }
  return false;
}
