import type { FeedSchemaDefinition } from '../../types.ts';
import type { ResourceSourceClass } from './types.ts';

export const RESOURCE_SCHEMA_IDS = Object.freeze({
  MINE_PRODUCTION_SYSTEM: 'minerals.mine-production.v1',
  WEIGHBRIDGE: 'minerals.weighbridge.v1',
  HAULAGE_TELEMETRY: 'minerals.haulage.v1',
  PROCESS_PLANT_METER: 'minerals.process-plant.v1',
  INVENTORY_STOCKPILE_SYSTEM: 'minerals.stockpile.v1',
  ASSAY_LAB_ATTESTATION: 'minerals.assay.v1',
  RESOURCE_SURVEY: 'minerals.survey.v1',
  RESERVE_REPORT_REFERENCE: 'minerals.reserve-report.v1',
  REGULATORY_PRODUCTION_REFERENCE: 'minerals.regulatory-production.v1',
  INDEPENDENT_AUDITOR_ATTESTATION: 'minerals.auditor.v1',
} as const);

const REQUIRED = Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']);

function massSchema(schemaId: string): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId,
    version: 1,
    factType: 'RESOURCE_EXTRACTION',
    requiredFields: REQUIRED,
    unit: 'tonne',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

function reserveSchema(schemaId: string): FeedSchemaDefinition {
  return Object.freeze({
    ...massSchema(schemaId),
    factType: 'RESOURCE_RESERVE',
  });
}

export const RESOURCE_FEED_SCHEMAS: Readonly<Record<ResourceSourceClass, FeedSchemaDefinition>> = Object.freeze({
  MINE_PRODUCTION_SYSTEM: massSchema(RESOURCE_SCHEMA_IDS.MINE_PRODUCTION_SYSTEM),
  WEIGHBRIDGE: massSchema(RESOURCE_SCHEMA_IDS.WEIGHBRIDGE),
  HAULAGE_TELEMETRY: massSchema(RESOURCE_SCHEMA_IDS.HAULAGE_TELEMETRY),
  PROCESS_PLANT_METER: massSchema(RESOURCE_SCHEMA_IDS.PROCESS_PLANT_METER),
  INVENTORY_STOCKPILE_SYSTEM: massSchema(RESOURCE_SCHEMA_IDS.INVENTORY_STOCKPILE_SYSTEM),
  ASSAY_LAB_ATTESTATION: massSchema(RESOURCE_SCHEMA_IDS.ASSAY_LAB_ATTESTATION),
  RESOURCE_SURVEY: reserveSchema(RESOURCE_SCHEMA_IDS.RESOURCE_SURVEY),
  RESERVE_REPORT_REFERENCE: reserveSchema(RESOURCE_SCHEMA_IDS.RESERVE_REPORT_REFERENCE),
  REGULATORY_PRODUCTION_REFERENCE: massSchema(RESOURCE_SCHEMA_IDS.REGULATORY_PRODUCTION_REFERENCE),
  INDEPENDENT_AUDITOR_ATTESTATION: massSchema(RESOURCE_SCHEMA_IDS.INDEPENDENT_AUDITOR_ATTESTATION),
});

export function resourceFeedSchema(sourceClass: ResourceSourceClass): FeedSchemaDefinition {
  return RESOURCE_FEED_SCHEMAS[sourceClass];
}

export function resourceSchemaDrift(input: {
  readonly sourceClass: ResourceSourceClass;
  readonly schemaId: string;
  readonly schemaVersion: number;
}): boolean {
  const expected = RESOURCE_FEED_SCHEMAS[input.sourceClass];
  return input.schemaId !== expected.schemaId || input.schemaVersion !== expected.version;
}
