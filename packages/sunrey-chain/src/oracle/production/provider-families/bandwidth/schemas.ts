/**
 * Versioned provider-neutral bandwidth feed schemas.
 *
 * BANDWIDTH_USAGE_V1 is the historical rate-labeled usage contract
 * (GB_s). Historical observations are not rewritten.
 *
 * BANDWIDTH_USAGE_V2 is the governed volume contract (GB, TB).
 * Capacity remains a DATA_RATE schema.
 */

import type { FeedSchemaDefinition } from '../../types.ts';
import type { BandwidthFactType, BandwidthSchemaId } from './types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ProductiveCategory } from '../../../../productive/types.ts';
import type { UnitCode } from '../../../types.ts';

export type BandwidthFeedSchema = FeedSchemaDefinition & {
  readonly bandwidthSchemaId: BandwidthSchemaId;
  readonly dataSourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly quantityKind: 'DATA_RATE' | 'DATA_VOLUME';
  readonly allowedUnits: readonly UnitCode[];
  readonly usageSchemaVersion: 1 | 2 | null;
  readonly historicalCompatibility: boolean;
};

function schema(input: {
  readonly bandwidthSchemaId: BandwidthSchemaId;
  readonly schemaId: string;
  readonly version: 1 | 2;
  readonly factType: BandwidthFactType;
  readonly unit: UnitCode;
  readonly allowedUnits: readonly UnitCode[];
  readonly quantityKind: 'DATA_RATE' | 'DATA_VOLUME';
  readonly requiredFields: readonly string[];
  readonly usageSchemaVersion: 1 | 2 | null;
  readonly historicalCompatibility?: boolean;
}): BandwidthFeedSchema {
  return Object.freeze({
    schemaVersion: 1,
    schemaId: input.schemaId,
    version: input.version,
    factType: input.factType,
    requiredFields: Object.freeze([...input.requiredFields]),
    unit: input.unit,
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
    bandwidthSchemaId: input.bandwidthSchemaId,
    dataSourceCategory: 'bandwidth',
    productiveCategory: 'BANDWIDTH_COMMUNICATIONS',
    quantityKind: input.quantityKind,
    allowedUnits: Object.freeze([...input.allowedUnits]),
    usageSchemaVersion: input.usageSchemaVersion,
    historicalCompatibility: input.historicalCompatibility === true,
  });
}

const METER_FIELDS = Object.freeze([
  'identifier',
  'numericValue',
  'unit',
  'sourceTimestampUnix',
  'measurementStart',
  'measurementEnd',
  'networkServiceId',
]);

export const BANDWIDTH_USAGE_SCHEMA_V1_DEF = schema({
  bandwidthSchemaId: 'BANDWIDTH_USAGE_V1',
  schemaId: 'bandwidth.usage.v1',
  version: 1,
  factType: 'BANDWIDTH_USAGE',
  unit: 'GB_s',
  allowedUnits: ['GB_s'],
  quantityKind: 'DATA_RATE',
  requiredFields: [...METER_FIELDS, 'durationSeconds'],
  usageSchemaVersion: 1,
  historicalCompatibility: true,
});

export const BANDWIDTH_USAGE_SCHEMA_V2_DEF = schema({
  bandwidthSchemaId: 'BANDWIDTH_USAGE_V2',
  schemaId: 'bandwidth.usage.v2',
  version: 2,
  factType: 'BANDWIDTH_USAGE',
  unit: 'GB',
  allowedUnits: ['GB', 'TB'],
  quantityKind: 'DATA_VOLUME',
  requiredFields: [...METER_FIELDS, 'transferSemantics'],
  usageSchemaVersion: 2,
});

export const BANDWIDTH_CAPACITY_SCHEMA_V1_DEF = schema({
  bandwidthSchemaId: 'BANDWIDTH_CAPACITY_V1',
  schemaId: 'bandwidth.capacity.v1',
  version: 1,
  factType: 'BANDWIDTH_CAPACITY',
  unit: 'GB_s',
  allowedUnits: ['GB_s'],
  quantityKind: 'DATA_RATE',
  requiredFields: [...METER_FIELDS],
  usageSchemaVersion: null,
});

export const BANDWIDTH_FEED_SCHEMAS: Readonly<Record<BandwidthSchemaId, BandwidthFeedSchema>> = Object.freeze({
  BANDWIDTH_CAPACITY_V1: BANDWIDTH_CAPACITY_SCHEMA_V1_DEF,
  BANDWIDTH_USAGE_V1: BANDWIDTH_USAGE_SCHEMA_V1_DEF,
  BANDWIDTH_USAGE_V2: BANDWIDTH_USAGE_SCHEMA_V2_DEF,
});

export function bandwidthFeedSchema(id: BandwidthSchemaId): BandwidthFeedSchema {
  return BANDWIDTH_FEED_SCHEMAS[id];
}

export function bandwidthSchemaDrift(input: {
  readonly schemaId: BandwidthSchemaId;
  readonly reportedSchemaId: string;
  readonly schemaVersion: number;
}): boolean {
  const expected = BANDWIDTH_FEED_SCHEMAS[input.schemaId];
  return input.reportedSchemaId !== expected.schemaId || input.schemaVersion !== expected.version;
}

export function breakingBandwidthSchemaRequiresNewVersion(): true {
  return true;
}
