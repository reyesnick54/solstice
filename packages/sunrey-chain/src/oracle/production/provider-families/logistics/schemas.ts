/**
 * Logistics / storage feed schemas. Breaking changes require a new version.
 * Floating-point quantities are refused.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FactType } from '../../../types.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import {
  isLogisticsFactType,
  type IntegerMeasure,
  type LogisticsFactType,
  type LogisticsRefusal,
  type LogisticsSourceObservation,
} from './types.ts';

export const LOGISTICS_SCHEMA_IDS = Object.freeze({
  LOGISTICS_CAPACITY: 'logistics.resource.v1',
  DELIVERY_COMPLETION: 'delivery.completion.v1',
  STORAGE_CAPACITY: 'storage.warehouse.v1',
  GOODS_DELIVERY: 'goods.delivery.v1',
} as const);

export const LOGISTICS_FEED_SCHEMAS: Readonly<Record<LogisticsFactType, FeedSchemaDefinition>> = Object.freeze({
  LOGISTICS_CAPACITY: Object.freeze({
    schemaVersion: 1,
    schemaId: LOGISTICS_SCHEMA_IDS.LOGISTICS_CAPACITY,
    version: 1,
    factType: 'LOGISTICS_CAPACITY',
    requiredFields: Object.freeze(['identifier', 'unit', 'sourceTimestampUnix']),
    unit: 'tonne_km',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  }),
  DELIVERY_COMPLETION: Object.freeze({
    schemaVersion: 1,
    schemaId: LOGISTICS_SCHEMA_IDS.DELIVERY_COMPLETION,
    version: 1,
    factType: 'DELIVERY_COMPLETION',
    requiredFields: Object.freeze(['identifier', 'unit', 'sourceTimestampUnix']),
    unit: 'units_produced',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  }),
  STORAGE_CAPACITY: Object.freeze({
    schemaVersion: 1,
    schemaId: LOGISTICS_SCHEMA_IDS.STORAGE_CAPACITY,
    version: 1,
    factType: 'STORAGE_CAPACITY',
    requiredFields: Object.freeze(['identifier', 'unit', 'sourceTimestampUnix']),
    unit: 'm3',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  }),
  GOODS_DELIVERY: Object.freeze({
    schemaVersion: 1,
    schemaId: LOGISTICS_SCHEMA_IDS.GOODS_DELIVERY,
    version: 1,
    factType: 'GOODS_DELIVERY',
    requiredFields: Object.freeze(['identifier', 'unit', 'sourceTimestampUnix']),
    unit: 'units_produced',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  }),
});

const INTEGER_MANTISSA = /^-?[0-9]+$/;

export function parseIntegerMantissa(value: string, label: string): Result<bigint, LogisticsRefusal> {
  if (!INTEGER_MANTISSA.test(value) || value.includes('.') || /[eE]/.test(value)) {
    return err({
      code: 'FLOAT_QUANTITY_FORBIDDEN',
      detail: `${label} must be an integer mantissa; floats are refused`,
      reviewRequired: false,
    });
  }
  return ok(BigInt(value));
}

export function parseIntegerMeasure(
  measure: IntegerMeasure | undefined,
  label: string,
): Result<{ mantissa: bigint; scale: number; unit: string } | null, LogisticsRefusal> {
  if (measure === undefined) {
    return ok(null);
  }
  if (!Number.isInteger(measure.scale) || measure.scale < 0 || measure.scale > 12) {
    return err({
      code: 'FLOAT_QUANTITY_FORBIDDEN',
      detail: `${label} scale must be an integer 0..12`,
      reviewRequired: false,
    });
  }
  const mantissa = parseIntegerMantissa(measure.mantissa, label);
  if (!mantissa.ok) {
    return mantissa;
  }
  return ok({ mantissa: mantissa.value, scale: measure.scale, unit: measure.unit });
}

export function detectSchemaDrift(
  observation: LogisticsSourceObservation,
  expectedFactType: FactType,
): Result<true, LogisticsRefusal> {
  if (!isLogisticsFactType(observation.factType)) {
    return err({
      code: 'UNKNOWN_FACT_TYPE',
      detail: `fact type ${observation.factType} is not a logistics/storage fact`,
      reviewRequired: false,
    });
  }
  if (observation.factType !== expectedFactType) {
    return err({
      code: 'SCHEMA_DRIFT',
      detail: `observation fact ${observation.factType} does not match expected ${expectedFactType}`,
      reviewRequired: false,
    });
  }
  const expected = LOGISTICS_FEED_SCHEMAS[observation.factType];
  if (observation.schemaId !== expected.schemaId || observation.schemaVersion !== expected.version) {
    return err({
      code: 'SCHEMA_DRIFT',
      detail: `schema ${observation.schemaId}@${observation.schemaVersion} is not ${expected.schemaId}@${expected.version}`,
      reviewRequired: false,
    });
  }
  return ok(true);
}

export function refuseFloatNumericValue(value: string | undefined, label: string): Result<bigint | null, LogisticsRefusal> {
  if (value === undefined) {
    return ok(null);
  }
  return parseIntegerMantissa(value, label);
}
