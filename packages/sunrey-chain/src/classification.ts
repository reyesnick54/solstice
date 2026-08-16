import { FORBIDDEN_PAYLOAD_KEYS, type ChainDataClass, type ChainRecordType } from './taxonomy.ts';
import type { ChainFailure, ChainRecordSchema } from './types.ts';

function walkKeys(value: unknown, out: string[]): void {
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkKeys(item, out);
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out.push(key);
    walkKeys(child, out);
  }
}

export function classifyWrite(input: {
  readonly recordType: ChainRecordType;
  readonly dataClass: ChainDataClass;
  readonly schema: ChainRecordSchema;
}): ChainFailure | null {
  if (input.dataClass === 'OFF_CHAIN_ONLY') {
    return {
      code: 'DATA_CLASSIFICATION_DENIED',
      message: 'OFF_CHAIN_ONLY material cannot be written to SunRey Chain',
    };
  }
  if (input.schema.dataClass !== 'ON_CHAIN_SAFE') {
    return {
      code: 'DATA_CLASSIFICATION_DENIED',
      message: 'chain record schema must be ON_CHAIN_SAFE',
    };
  }
  if (input.schema.recordType !== input.recordType) {
    return { code: 'SCHEMA_MISMATCH', message: 'schema recordType does not match intent' };
  }
  const keys: string[] = [];
  walkKeys(input.schema.fields, keys);
  for (const key of keys) {
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      return {
        code: 'FORBIDDEN_ON_CHAIN_FIELD',
        message: `field ${key} is off-chain only`,
      };
    }
  }
  const serialized = JSON.stringify(input.schema.fields).toLowerCase();
  if (
    serialized.includes('pdv payload') ||
    serialized.includes('"pan"') ||
    serialized.includes('cvv') ||
    serialized.includes('private_key') ||
    serialized.includes('genetic')
  ) {
    return {
      code: 'RAW_SENSITIVE_DATA_DENIED',
      message: 'raw sensitive material is structurally prohibited on chain',
    };
  }
  return null;
}
