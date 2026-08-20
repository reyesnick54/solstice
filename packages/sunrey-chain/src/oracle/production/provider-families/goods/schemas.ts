/**
 * Goods feed schemas. Breaking changes require a new version.
 * Floating-point quantities are refused. Historical GOODS_OUTPUT and
 * GOODS_DELIVERY subject schemas remain goods.output.v1 / goods.delivery.v1.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import { isGoodsFactType, type GoodsFactType, type GoodsRefusal, type GoodsSourceObservation } from './types.ts';

export const GOODS_SCHEMA_IDS = Object.freeze({
  GOODS_OUTPUT: 'goods.output.v1',
  GOODS_DELIVERY: 'goods.delivery.v1',
} as const);

export const GOODS_FEED_SCHEMAS: Readonly<Record<GoodsFactType, FeedSchemaDefinition>> = Object.freeze({
  GOODS_OUTPUT: Object.freeze({
    schemaVersion: 1,
    schemaId: GOODS_SCHEMA_IDS.GOODS_OUTPUT,
    version: 1,
    factType: 'GOODS_OUTPUT',
    requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
    unit: 'units_produced',
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  }),
  GOODS_DELIVERY: Object.freeze({
    schemaVersion: 1,
    schemaId: GOODS_SCHEMA_IDS.GOODS_DELIVERY,
    version: 1,
    factType: 'GOODS_DELIVERY',
    requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
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

export function parseIntegerMantissa(value: string, label: string): Result<bigint, GoodsRefusal> {
  if (!INTEGER_MANTISSA.test(value) || value.includes('.') || /[eE]/.test(value)) {
    return err({
      code: 'FLOAT_QUANTITY_FORBIDDEN',
      detail: `${label} must be an integer mantissa; floats are refused`,
    });
  }
  return ok(BigInt(value));
}

export function detectSchemaDrift(observation: GoodsSourceObservation): Result<true, GoodsRefusal> {
  if (!isGoodsFactType(observation.factType)) {
    return err({
      code: 'UNKNOWN_FACT_TYPE',
      detail: `fact type ${observation.factType} is not a goods fact`,
    });
  }
  const expected = GOODS_FEED_SCHEMAS[observation.factType];
  if (observation.schemaId !== expected.schemaId || observation.schemaVersion !== expected.version) {
    return err({
      code: 'SCHEMA_DRIFT',
      detail: `schema ${observation.schemaId}@${observation.schemaVersion} is not ${expected.schemaId}@${expected.version}`,
    });
  }
  return ok(true);
}

export function goodsFeedSchema(factType: GoodsFactType): FeedSchemaDefinition {
  return GOODS_FEED_SCHEMAS[factType];
}

export function breakingGoodsSchemaRequiresNewVersion(): true {
  return true;
}
