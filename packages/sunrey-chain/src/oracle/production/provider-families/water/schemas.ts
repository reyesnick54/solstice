import type { FeedSchemaDefinition } from '../../types.ts';
import type { WaterSourceClass } from './types.ts';

export const WATER_SCHEMA_IDS = Object.freeze({
  WATER_UTILITY_PRODUCTION_METER: 'water.utility-production.v1',
  TREATMENT_PLANT_METER: 'water.treatment.v1',
  DESALINATION_PLANT_METER: 'water.desalination.v1',
  WELL_PRODUCTION_METER: 'water.well.v1',
  RESERVOIR_REFERENCE: 'water.reservoir.v1',
  AQUIFER_REFERENCE: 'water.aquifer.v1',
  PUMPING_METER: 'water.pumping.v1',
  INDUSTRIAL_WATER_PLANT: 'water.industrial.v1',
  IRRIGATION_METER: 'water.irrigation.v1',
  WATER_QUALITY_ATTESTATION: 'water.quality.v1',
  INDEPENDENT_WATER_AUDITOR: 'water.auditor.v1',
} as const);

const REQUIRED = Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']);

function volumeSchema(
  schemaId: string,
  factType: 'WATER_PRODUCTION' | 'WATER_AVAILABILITY',
): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId,
    version: 1,
    factType,
    requiredFields: REQUIRED,
    unit: 'L',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

export const WATER_FEED_SCHEMAS: Readonly<Record<WaterSourceClass, FeedSchemaDefinition>> = Object.freeze({
  WATER_UTILITY_PRODUCTION_METER: volumeSchema(WATER_SCHEMA_IDS.WATER_UTILITY_PRODUCTION_METER, 'WATER_PRODUCTION'),
  TREATMENT_PLANT_METER: volumeSchema(WATER_SCHEMA_IDS.TREATMENT_PLANT_METER, 'WATER_PRODUCTION'),
  DESALINATION_PLANT_METER: volumeSchema(WATER_SCHEMA_IDS.DESALINATION_PLANT_METER, 'WATER_PRODUCTION'),
  WELL_PRODUCTION_METER: volumeSchema(WATER_SCHEMA_IDS.WELL_PRODUCTION_METER, 'WATER_PRODUCTION'),
  RESERVOIR_REFERENCE: volumeSchema(WATER_SCHEMA_IDS.RESERVOIR_REFERENCE, 'WATER_AVAILABILITY'),
  AQUIFER_REFERENCE: volumeSchema(WATER_SCHEMA_IDS.AQUIFER_REFERENCE, 'WATER_AVAILABILITY'),
  PUMPING_METER: volumeSchema(WATER_SCHEMA_IDS.PUMPING_METER, 'WATER_PRODUCTION'),
  INDUSTRIAL_WATER_PLANT: volumeSchema(WATER_SCHEMA_IDS.INDUSTRIAL_WATER_PLANT, 'WATER_PRODUCTION'),
  IRRIGATION_METER: volumeSchema(WATER_SCHEMA_IDS.IRRIGATION_METER, 'WATER_PRODUCTION'),
  WATER_QUALITY_ATTESTATION: volumeSchema(WATER_SCHEMA_IDS.WATER_QUALITY_ATTESTATION, 'WATER_PRODUCTION'),
  INDEPENDENT_WATER_AUDITOR: volumeSchema(WATER_SCHEMA_IDS.INDEPENDENT_WATER_AUDITOR, 'WATER_PRODUCTION'),
});

export function waterFeedSchema(sourceClass: WaterSourceClass): FeedSchemaDefinition {
  return WATER_FEED_SCHEMAS[sourceClass];
}

export function waterSchemaDrift(input: {
  readonly sourceClass: WaterSourceClass;
  readonly schemaId: string;
  readonly schemaVersion: number;
}): boolean {
  const expected = WATER_FEED_SCHEMAS[input.sourceClass];
  return input.schemaId !== expected.schemaId || input.schemaVersion !== expected.version;
}

const CREDENTIAL_KEY = /(api[_-]?key|password|secret|credential|token|private[_-]?key|authorization)/i;

export function containsWaterCredentialLeak(value: unknown, key = ''): boolean {
  if (CREDENTIAL_KEY.test(key)) {
    return true;
  }
  if (typeof value === 'string') {
    return /\b(sk-|Bearer |BEGIN (RSA |EC )?PRIVATE KEY)\b/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsWaterCredentialLeak(item));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([childKey, child]) =>
      containsWaterCredentialLeak(child, childKey),
    );
  }
  return false;
}
