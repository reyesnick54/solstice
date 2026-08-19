/**
 * Bounded manufacturing feed schemas and payload minimization.
 *
 * Economic measurement metadata only. PLC dumps, recipes, CAD,
 * trade-secret settings, robot programs, and factory credentials
 * are refused.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FactType } from '../../../types.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import { breakingSchemaChange, validateExternalRecord, type ExternalSourceRecord } from '../../schema.ts';
import {
  FORBIDDEN_PAYLOAD_KEYS,
  type ManufacturingFactType,
  type ManufacturingRejection,
  type ManufacturingSourceClass,
  type ManufacturingObservation,
} from './types.ts';

const INTEGER_RE = /^-?\d+$/;
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$/;

export const MANUFACTURING_SCHEMA_IDS = Object.freeze({
  MES: 'manufacturing.mes.output.v1',
  ERP_PRODUCTION_LEDGER: 'manufacturing.erp.output-batch.v1',
  SCADA_READ_ONLY_GATEWAY: 'manufacturing.scada.read.v1',
  PLC_READ_ONLY_TELEMETRY: 'manufacturing.plc.telemetry.v1',
  ROBOT_CONTROLLER_TELEMETRY: 'manufacturing.robot.output.v1',
  MACHINE_DATA_HISTORIAN: 'manufacturing.historian.counter.v1',
  QUALITY_MANAGEMENT_SYSTEM: 'manufacturing.qms.attestation.v1',
  WEIGH_SCALE: 'manufacturing.weigh-scale.mass.v1',
  VISION_INSPECTION_ATTESTATION: 'manufacturing.vision.attestation.v1',
  WAREHOUSE_PRODUCTION_HANDOFF: 'manufacturing.warehouse.handoff.v1',
} as const);

export function manufacturingFeedSchema(
  sourceClass: ManufacturingSourceClass,
  factType: ManufacturingFactType,
  unit: FeedSchemaDefinition['unit'],
): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId: MANUFACTURING_SCHEMA_IDS[sourceClass],
    version: 1,
    factType,
    requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
    unit,
    quantityScale: 0,
    identifierPattern: IDENTIFIER_RE.source,
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

export function defaultUnitForFact(factType: FactType): FeedSchemaDefinition['unit'] {
  if (factType === 'MANUFACTURING_CAPACITY') {
    return 'machine_h';
  }
  return 'units_produced';
}

export function containsForbiddenIndustrialPayload(value: unknown, key = ''): boolean {
  const lowered = key.toLowerCase();
  if (
    FORBIDDEN_PAYLOAD_KEYS.some((item) => lowered.includes(item.toLowerCase())) ||
    /credential|password|secret|apikey|recipe|cad|plcwrite|motioncommand/.test(lowered)
  ) {
    return true;
  }
  if (typeof value === 'string') {
    return /\b(plc write|motion command|scada command|actuator|firmware update|safety override)\b/i.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenIndustrialPayload(item));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([childKey, child]) =>
      containsForbiddenIndustrialPayload(child, childKey),
    );
  }
  return false;
}

export function containsCredentialLeak(value: unknown, key = ''): boolean {
  const lowered = key.toLowerCase();
  if (/(api[_-]?key|password|secret|credential|token|private[_-]?key)/.test(lowered)) {
    return true;
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([childKey, child]) =>
      containsCredentialLeak(child, childKey),
    );
  }
  return false;
}

export function containsUnboundedArray(value: unknown, maxArrayLength: number): boolean {
  if (Array.isArray(value) && value.length > maxArrayLength) {
    return true;
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((child) =>
      containsUnboundedArray(child, maxArrayLength),
    );
  }
  return false;
}

export function validateManufacturingPayload(
  observation: ManufacturingObservation,
  schema: FeedSchemaDefinition,
): Result<ManufacturingObservation, ManufacturingRejection> {
  if (observation.schemaId !== schema.schemaId || observation.schemaVersion !== schema.version) {
    return err({
      code: 'SCHEMA_DRIFT',
      detail: `expected ${schema.schemaId}@${schema.version}, received ${observation.schemaId}@${observation.schemaVersion}`,
    });
  }
  if (observation.rawPayloadPresent) {
    return err({
      code: 'RAW_INDUSTRIAL_CONTROL_PAYLOAD',
      detail: 'raw industrial payloads are refused; retain economic measurement metadata only',
    });
  }
  if (!IDENTIFIER_RE.test(observation.identifier)) {
    return err({ code: 'INVALID_IDENTIFIER', detail: observation.identifier });
  }
  if (observation.numericValue.includes('.') || /e/i.test(observation.numericValue) || !INTEGER_RE.test(observation.numericValue)) {
    return err({
      code: 'FLOAT_FORBIDDEN',
      detail: 'manufacturing quantities must be integer minor-unit strings',
    });
  }
  if (observation.numericValue.startsWith('-')) {
    return err({ code: 'WRONG_NUMERIC_REPRESENTATION', detail: 'negative manufacturing quantities are refused' });
  }
  if (observation.unit !== schema.unit) {
    return err({ code: 'WRONG_UNIT', detail: `expected ${schema.unit}, received ${observation.unit}` });
  }
  if (containsForbiddenIndustrialPayload(observation.extras) || containsForbiddenIndustrialPayload(observation, '')) {
    return err({
      code: 'RAW_INDUSTRIAL_CONTROL_PAYLOAD',
      detail: 'PLC dumps, recipes, CAD, robot programs, and control payloads are forbidden',
    });
  }
  if (containsCredentialLeak(observation.extras) || containsCredentialLeak(observation)) {
    return err({ code: 'CREDENTIAL_LEAK', detail: 'factory credentials and secrets must not be stored' });
  }
  if (containsUnboundedArray(observation.extras, schema.maxArrayLength)) {
    return err({ code: 'UNBOUNDED_ARRAY', detail: `array exceeds maxArrayLength ${schema.maxArrayLength}` });
  }
  const record: ExternalSourceRecord = {
    identifier: observation.identifier,
    numericValue: observation.numericValue,
    unit: observation.unit,
    sourceTimestampUnix: observation.sourceTimestampUnix,
    schemaId: observation.schemaId,
    schemaVersion: observation.schemaVersion,
    extras: observation.extras,
  };
  const external = validateExternalRecord(schema, record);
  if (!external.ok) {
    if (external.error.code === 'FLOAT_FORBIDDEN' || external.error.code === 'UNBOUNDED_ARRAY' || external.error.code === 'SCHEMA_DRIFT') {
      return err({ code: external.error.code, detail: external.error.detail });
    }
    if (external.error.code === 'WRONG_NUMERIC_REPRESENTATION' || external.error.code === 'WRONG_UNIT' || external.error.code === 'INVALID_IDENTIFIER' || external.error.code === 'RECORD_OVERSIZED') {
      return err({ code: external.error.code, detail: external.error.detail });
    }
    return err({ code: 'SCHEMA_DRIFT', detail: external.error.detail });
  }
  return ok(observation);
}

export function manufacturingSchemaChangeIsBreaking(
  previous: FeedSchemaDefinition,
  next: FeedSchemaDefinition,
): boolean {
  return breakingSchemaChange(previous, next);
}
