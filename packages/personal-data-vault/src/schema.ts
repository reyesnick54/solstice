import { asDataSchemaId, asDataSchemaVersion, type DataSchemaId, type DataSchemaVersion } from './ids.ts';
import type { DataCategory, SensitivityClass, SupportedContentType } from './taxonomy.ts';
import { PDV_LIMITS } from './taxonomy.ts';

export type SchemaFieldRule = {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  readonly required: boolean;
};

export type DataSchemaRecord = {
  readonly schemaId: DataSchemaId;
  readonly version: DataSchemaVersion;
  readonly contentType: SupportedContentType;
  readonly category: DataCategory;
  readonly sensitivityDefault: SensitivityClass;
  readonly allowedMetadata: readonly string[];
  readonly validationRules: readonly SchemaFieldRule[];
  readonly arrayField?: string;
  readonly description: string;
};

export const BUILTIN_SCHEMAS: readonly DataSchemaRecord[] = Object.freeze([
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_payroll'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'PAYROLL_DATA',
    sensitivityDefault: 'HIGHLY_SENSITIVE',
    allowedMetadata: Object.freeze(['employerLabel', 'period']),
    validationRules: Object.freeze([
      { name: 'employer', type: 'string' as const, required: true },
      { name: 'periodStart', type: 'string' as const, required: true },
      { name: 'periodEnd', type: 'string' as const, required: true },
      { name: 'grossMinor', type: 'string' as const, required: true },
      { name: 'netMinor', type: 'string' as const, required: true },
      { name: 'currency', type: 'string' as const, required: true },
      { name: 'payDate', type: 'string' as const, required: true },
    ]),
    description: 'Synthetic external payroll record. Not a Solstice ledger balance.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_transactions'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'TRANSACTION_DATA',
    sensitivityDefault: 'SENSITIVE',
    allowedMetadata: Object.freeze(['accountLabel', 'recordCount']),
    arrayField: 'transactions',
    validationRules: Object.freeze([
      { name: 'transactions', type: 'array' as const, required: true },
    ]),
    description: 'Synthetic external transaction dataset. Not authoritative banking state.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_receipt'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'RECEIPT',
    sensitivityDefault: 'PERSONAL',
    allowedMetadata: Object.freeze(['merchantLabel']),
    validationRules: Object.freeze([
      { name: 'merchant', type: 'string' as const, required: true },
      { name: 'purchasedAt', type: 'string' as const, required: true },
      { name: 'totalMinor', type: 'string' as const, required: true },
      { name: 'currency', type: 'string' as const, required: true },
    ]),
    description: 'User-uploaded synthetic receipt or document metadata.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_preference'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'PREFERENCE_DATA',
    sensitivityDefault: 'PERSONAL',
    allowedMetadata: Object.freeze(['preferenceKey']),
    validationRules: Object.freeze([
      { name: 'key', type: 'string' as const, required: true },
      { name: 'value', type: 'string' as const, required: true },
    ]),
    description: 'User-declared preference. Not identity or ledger truth.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_spending_summary'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'PURCHASE_HISTORY',
    sensitivityDefault: 'PERSONAL',
    allowedMetadata: Object.freeze(['window', 'currency']),
    validationRules: Object.freeze([
      { name: 'windowFrom', type: 'string' as const, required: true },
      { name: 'windowTo', type: 'string' as const, required: true },
      { name: 'currency', type: 'string' as const, required: true },
      { name: 'categories', type: 'array' as const, required: true },
    ]),
    description: 'Minimized derived spending summary. Lineage required.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_employment'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'USER_DECLARED_DATA',
    sensitivityDefault: 'PERSONAL',
    allowedMetadata: Object.freeze(['employerLabel']),
    validationRules: Object.freeze([
      { name: 'employer', type: 'string' as const, required: true },
      { name: 'title', type: 'string' as const, required: true },
      { name: 'startedOn', type: 'string' as const, required: true },
    ]),
    description: 'User-declared employment. Not payroll truth and not a ledger balance.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_skills'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'USER_DECLARED_DATA',
    sensitivityDefault: 'PERSONAL',
    allowedMetadata: Object.freeze(['skillKey']),
    validationRules: Object.freeze([
      { name: 'skill', type: 'string' as const, required: true },
      { name: 'level', type: 'string' as const, required: true },
    ]),
    description: 'User-declared skill. Not a verified credential.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_education'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'USER_DECLARED_DATA',
    sensitivityDefault: 'PERSONAL',
    allowedMetadata: Object.freeze(['institutionLabel']),
    validationRules: Object.freeze([
      { name: 'institution', type: 'string' as const, required: true },
      { name: 'credential', type: 'string' as const, required: true },
    ]),
    description: 'User-declared education. Not a verified transcript.',
  }),
  Object.freeze({
    schemaId: asDataSchemaId('pdsch_inference'),
    version: asDataSchemaVersion('1'),
    contentType: 'application/json',
    category: 'USER_DECLARED_DATA',
    sensitivityDefault: 'PERSONAL',
    allowedMetadata: Object.freeze(['modelLabel']),
    validationRules: Object.freeze([
      { name: 'statement', type: 'string' as const, required: true },
      { name: 'modelRef', type: 'string' as const, required: true },
    ]),
    description: 'AI inference about the subject. Never a verified personal fact.',
  }),
]);

export class DataSchemaRegistry {
  private readonly records = new Map<string, DataSchemaRecord>();

  constructor(seed: readonly DataSchemaRecord[] = BUILTIN_SCHEMAS) {
    for (const record of seed) {
      this.records.set(schemaKey(record.schemaId, record.version), record);
    }
  }

  get(schemaId: DataSchemaId, version: DataSchemaVersion): DataSchemaRecord | undefined {
    return this.records.get(schemaKey(schemaId, version));
  }

  list(): readonly DataSchemaRecord[] {
    return Object.freeze([...this.records.values()]);
  }

  register(record: DataSchemaRecord): void {
    const key = schemaKey(record.schemaId, record.version);
    if (this.records.has(key)) {
      throw new Error(`schema ${key} already exists; register a new version`);
    }
    this.records.set(key, record);
  }
}

export function schemaKey(schemaId: string, version: string): string {
  return `${schemaId}@${version}`;
}

export type SchemaValidationFailure = {
  readonly code: 'SCHEMA_NOT_FOUND' | 'SCHEMA_INVALID' | 'UNSUPPORTED_TYPE' | 'LIMIT_EXCEEDED';
  readonly message: string;
};

export function validateAgainstSchema(
  schema: DataSchemaRecord,
  payload: unknown,
): SchemaValidationFailure | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { code: 'SCHEMA_INVALID', message: 'payload must be a JSON object' };
  }
  if (containsForbiddenExecutable(payload)) {
    return { code: 'UNSUPPORTED_TYPE', message: 'payload must not contain executable objects' };
  }
  const depth = objectDepth(payload);
  if (depth > PDV_LIMITS.maxSchemaDepth) {
    return { code: 'LIMIT_EXCEEDED', message: `schema depth ${depth} exceeds ${PDV_LIMITS.maxSchemaDepth}` };
  }
  const body = payload as Record<string, unknown>;
  for (const rule of schema.validationRules) {
    if (rule.required && !(rule.name in body)) {
      return { code: 'SCHEMA_INVALID', message: `missing required field ${rule.name}` };
    }
    if (rule.name in body && !matchesType(body[rule.name], rule.type)) {
      return { code: 'SCHEMA_INVALID', message: `field ${rule.name} must be ${rule.type}` };
    }
  }
  if (schema.arrayField) {
    const rows = body[schema.arrayField];
    if (!Array.isArray(rows)) {
      return { code: 'SCHEMA_INVALID', message: `${schema.arrayField} must be an array` };
    }
    if (rows.length > PDV_LIMITS.maxRecordCount) {
      return { code: 'LIMIT_EXCEEDED', message: `record count exceeds ${PDV_LIMITS.maxRecordCount}` };
    }
    for (const row of rows) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        return { code: 'SCHEMA_INVALID', message: 'array records must be objects' };
      }
    }
  }
  return null;
}

function matchesType(value: unknown, type: SchemaFieldRule['type']): boolean {
  if (type === 'array') {
    return Array.isArray(value);
  }
  if (type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  return typeof value === type;
}

function objectDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== 'object') {
    return depth;
  }
  if (Array.isArray(value)) {
    let max = depth + 1;
    for (const item of value) {
      max = Math.max(max, objectDepth(item, depth + 1));
    }
    return max;
  }
  let max = depth + 1;
  for (const item of Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, objectDepth(item, depth + 1));
  }
  return max;
}

function containsForbiddenExecutable(value: unknown): boolean {
  if (typeof value === 'function') {
    return true;
  }
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(containsForbiddenExecutable);
  }
  return Object.values(value as Record<string, unknown>).some(containsForbiddenExecutable);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const [key, item] of entries) {
      out[key] = sortKeys(item);
    }
    return out;
  }
  return value;
}
