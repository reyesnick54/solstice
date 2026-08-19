/**
 * Provider-neutral energy source schemas.
 *
 * Adapters map external provider fields into these families. Schemas are
 * not bound to any commercial API.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import {
  ENERGY_SCHEMA_IDS,
  energyRejection,
  isEnergySchemaId,
  type EnergyObservationInput,
  type EnergyRejection,
  type EnergySchemaId,
} from './types.ts';

export const ENERGY_SCHEMA_REQUIRED_FIELDS = Object.freeze([
  'sourceObservationId',
  'quantity',
  'unit',
  'sourceTimestampUnix',
  'collectionTimestampUnix',
  'meterRef',
  'registerId',
] as const);

const CREDENTIAL_KEYS = Object.freeze([
  'apiKey',
  'api_key',
  'clientSecret',
  'oauthClientSecret',
  'privateKey',
  'password',
  'authorization',
  'bearer',
]);

const PII_KEYS = Object.freeze(['ssn', 'email', 'phone', 'customerName', 'homeAddress', 'accountHolder']);

export type EnergySchemaDefinition = {
  readonly schemaId: EnergySchemaId;
  readonly version: 1;
  readonly requiredFields: readonly string[];
  readonly allowFloat: false;
  readonly vendorBound: false;
};

export const ENERGY_SCHEMA_FAMILIES: Readonly<Record<EnergySchemaId, EnergySchemaDefinition>> = Object.freeze(
  Object.fromEntries(
    ENERGY_SCHEMA_IDS.map((schemaId) => [
      schemaId,
      Object.freeze({
        schemaId,
        version: 1 as const,
        requiredFields: ENERGY_SCHEMA_REQUIRED_FIELDS,
        allowFloat: false as const,
        vendorBound: false as const,
      }),
    ]),
  ) as Record<EnergySchemaId, EnergySchemaDefinition>,
);

export function energyFeedSchema(schemaId: EnergySchemaId, unit: FeedSchemaDefinition['unit'], factType: FeedSchemaDefinition['factType']): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId,
    version: 1,
    factType,
    requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
    unit,
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

export function validateEnergySchema(input: EnergyObservationInput): Result<EnergyObservationInput, EnergyRejection> {
  if (!isEnergySchemaId(input.schemaId)) {
    return err(energyRejection('SCHEMA_INVALID', `unknown energy schema ${input.schemaId}`));
  }
  const schema = ENERGY_SCHEMA_FAMILIES[input.schemaId];
  for (const field of schema.requiredFields) {
    const value = (input as unknown as Record<string, unknown>)[field];
    if (value === undefined || value === null || value === '') {
      if (field === 'sourceTimestampUnix') {
        return err(energyRejection('MISSING_SOURCE_TIMESTAMP', 'source timestamp is required', false));
      }
      return err(energyRejection('SCHEMA_INVALID', `missing required field ${field}`));
    }
  }
  if (containsCredentialMaterial(input)) {
    return err(energyRejection('CREDENTIAL_MATERIAL_FORBIDDEN', 'credentials cannot appear in energy observations', false));
  }
  if (containsPii(input)) {
    return err(energyRejection('PII_FORBIDDEN', 'customer PII cannot appear in oracle energy subjects', false));
  }
  return ok(input);
}

export function containsCredentialMaterial(value: unknown): boolean {
  return scanKeys(value, CREDENTIAL_KEYS);
}

export function containsPii(value: unknown): boolean {
  return scanKeys(value, PII_KEYS);
}

function scanKeys(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanKeys(item, keys));
  }
  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    if (keys.includes(key) && item) {
      return true;
    }
    if (scanKeys(item, keys)) {
      return true;
    }
  }
  return false;
}
