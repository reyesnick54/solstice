import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { isRegisteredUnit } from '../units.ts';
import type { FeedSchemaDefinition, ProductionOracleRejection } from './types.ts';

export type ExternalSourceRecord = {
  readonly identifier: string;
  readonly numericValue: string;
  readonly unit: string;
  readonly sourceTimestampUnix: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly extras?: Readonly<Record<string, unknown>>;
};

const INTEGER_RE = /^-?\d+$/;

export function validateExternalRecord(
  schema: FeedSchemaDefinition,
  record: ExternalSourceRecord,
): Result<ExternalSourceRecord, ProductionOracleRejection> {
  if (record.schemaId !== schema.schemaId) {
    return err({
      code: 'SCHEMA_DRIFT',
      detail: `expected schema ${schema.schemaId}, received ${record.schemaId}; fields are not reinterpreted`,
    });
  }
  if (record.schemaVersion !== schema.version) {
    return err({
      code: 'SCHEMA_INCOMPATIBLE',
      detail: `expected schema version ${schema.version}, received ${record.schemaVersion}; create a new feed version`,
    });
  }
  if (!new RegExp(schema.identifierPattern).test(record.identifier)) {
    return err({ code: 'INVALID_IDENTIFIER', detail: record.identifier });
  }
  if (record.sourceTimestampUnix.length === 0) {
    return err({ code: 'MISSING_SOURCE_TIMESTAMP', detail: 'source timestamp is required' });
  }
  if (!INTEGER_RE.test(record.sourceTimestampUnix)) {
    return err({ code: 'MISSING_SOURCE_TIMESTAMP', detail: 'source timestamp must be an integer unix second' });
  }
  if (!INTEGER_RE.test(record.numericValue)) {
    return err({
      code: 'WRONG_NUMERIC_REPRESENTATION',
      detail: 'consensus-facing values must be integer/fixed-point strings; floats are refused',
    });
  }
  if (record.numericValue.includes('.') || record.numericValue.toLowerCase().includes('e') || record.numericValue.startsWith('-')) {
    return err({ code: 'FLOAT_FORBIDDEN', detail: 'floating-point and negative source values are forbidden' });
  }
  if (record.unit !== schema.unit || !isRegisteredUnit(record.unit)) {
    return err({ code: 'WRONG_UNIT', detail: `expected ${schema.unit}, received ${record.unit}` });
  }
  const encoded = JSON.stringify(record);
  if (Buffer.byteLength(encoded, 'utf8') > schema.maxRecordBytes) {
    return err({ code: 'RECORD_OVERSIZED', detail: `record exceeds ${schema.maxRecordBytes} bytes` });
  }
  if (record.extras) {
    for (const [key, value] of Object.entries(record.extras)) {
      if (Array.isArray(value) && value.length > schema.maxArrayLength) {
        return err({ code: 'UNBOUNDED_ARRAY', detail: `${key} exceeds maxArrayLength ${schema.maxArrayLength}` });
      }
    }
  }
  for (const field of schema.requiredFields) {
    if (field === 'identifier' && record.identifier.length === 0) {
      return err({ code: 'SCHEMA_INCOMPATIBLE', detail: 'unknown required semantics: identifier' });
    }
    if (field === 'numericValue' && record.numericValue.length === 0) {
      return err({ code: 'SCHEMA_INCOMPATIBLE', detail: 'unknown required semantics: numericValue' });
    }
    if (field === 'unit' && record.unit.length === 0) {
      return err({ code: 'SCHEMA_INCOMPATIBLE', detail: 'unknown required semantics: unit' });
    }
    if (field === 'sourceTimestampUnix' && record.sourceTimestampUnix.length === 0) {
      return err({ code: 'MISSING_SOURCE_TIMESTAMP', detail: 'unknown required semantics: sourceTimestampUnix' });
    }
  }
  return ok(record);
}

export function breakingSchemaChange(previous: FeedSchemaDefinition, next: FeedSchemaDefinition): boolean {
  return (
    previous.schemaId !== next.schemaId ||
    previous.unit !== next.unit ||
    previous.quantityScale !== next.quantityScale ||
    previous.factType !== next.factType ||
    previous.requiredFields.join(',') !== next.requiredFields.join(',')
  );
}
