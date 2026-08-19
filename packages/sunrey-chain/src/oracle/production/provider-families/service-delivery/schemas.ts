/**
 * Service-delivery feed schemas.
 *
 * Historical SERVICE_DELIVERY allowed units_produced and machine_h.
 * Chunk 137 adds a governed extension that also allows service_hour
 * for genuine time-based services. machine_h remains valid for
 * historical records and is not reinterpreted as service_hour.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import {
  SERVICE_HOUR_SCHEMA_EXTENSION,
  isServiceFactType,
  type ServiceRefusal,
  type ServiceSourceObservation,
} from './types.ts';

export const SERVICE_SCHEMA_IDS = Object.freeze({
  SERVICE_DELIVERY: 'service.delivery.v1',
  SERVICE_DELIVERY_SERVICE_HOUR: SERVICE_HOUR_SCHEMA_EXTENSION,
} as const);

export const SERVICE_FEED_SCHEMA: FeedSchemaDefinition = Object.freeze({
  schemaVersion: 1,
  schemaId: SERVICE_SCHEMA_IDS.SERVICE_DELIVERY,
  version: 1,
  factType: 'SERVICE_DELIVERY',
  requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
  unit: 'units_produced',
  quantityScale: 0,
  identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
  maxRecordBytes: 8_192,
  maxArrayLength: 32,
  allowFloat: false,
  breakingChangeCreatesNewVersion: true,
});

export const SERVICE_HOUR_ALLOWED_UNITS = Object.freeze(['units_produced', 'machine_h', 'service_hour', 'UNIT'] as const);

const INTEGER_MANTISSA = /^-?[0-9]+$/;

export function parseIntegerMantissa(value: string, label: string): Result<bigint, ServiceRefusal> {
  if (!INTEGER_MANTISSA.test(value) || value.includes('.') || /[eE]/.test(value)) {
    return err({
      code: 'FLOAT_QUANTITY_FORBIDDEN',
      detail: `${label} must be an integer mantissa; floats are refused`,
    });
  }
  return ok(BigInt(value));
}

export function detectSchemaDrift(observation: ServiceSourceObservation): Result<true, ServiceRefusal> {
  if (!isServiceFactType(observation.factType)) {
    return err({
      code: 'UNKNOWN_FACT_TYPE',
      detail: `fact type ${observation.factType} is not SERVICE_DELIVERY`,
    });
  }
  const allowedIds: readonly string[] = [SERVICE_SCHEMA_IDS.SERVICE_DELIVERY, SERVICE_SCHEMA_IDS.SERVICE_DELIVERY_SERVICE_HOUR];
  if (!allowedIds.includes(observation.schemaId) || observation.schemaVersion !== 1) {
    return err({
      code: 'SCHEMA_DRIFT',
      detail: `schema ${observation.schemaId}@${observation.schemaVersion} is not a governed SERVICE_DELIVERY schema`,
    });
  }
  if (observation.unit === 'service_hour' && observation.schemaId !== SERVICE_SCHEMA_IDS.SERVICE_DELIVERY && observation.schemaId !== SERVICE_SCHEMA_IDS.SERVICE_DELIVERY_SERVICE_HOUR) {
    return err({
      code: 'SCHEMA_DRIFT',
      detail: 'service_hour requires a governed SERVICE_DELIVERY schema extension',
    });
  }
  return ok(true);
}

export function historicalMachineHourSchemaPreserved(schemaId: string, unit: string): boolean {
  return schemaId === SERVICE_SCHEMA_IDS.SERVICE_DELIVERY && unit === 'machine_h';
}

export function serviceFeedSchema(): FeedSchemaDefinition {
  return SERVICE_FEED_SCHEMA;
}
