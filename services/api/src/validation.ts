import { PlatformApiError } from './errors.ts';

export type JsonValue = string | number | boolean | null | JsonValue[] | { readonly [key: string]: JsonValue };

export type FieldSchema =
  | { readonly kind: 'string'; readonly min?: number; readonly max?: number; readonly pattern?: RegExp }
  | { readonly kind: 'integer'; readonly min?: number; readonly max?: number }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'object'; readonly properties: Readonly<Record<string, FieldSchema>>; readonly required?: readonly string[] }
  | { readonly kind: 'enum'; readonly values: readonly string[] };

export type RequestSchema = {
  readonly params?: Readonly<Record<string, FieldSchema>>;
  readonly query?: Readonly<Record<string, FieldSchema>>;
  readonly headers?: Readonly<Record<string, FieldSchema>>;
  readonly body?: FieldSchema;
};

export type ValidatedInput = {
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: JsonValue | undefined;
};

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function collect(
  path: string,
  schema: FieldSchema,
  value: unknown,
  errors: { field: string; code: string; message: string }[],
): void {
  switch (schema.kind) {
    case 'string': {
      if (typeof value !== 'string') {
        errors.push({ field: path, code: 'TYPE', message: `expected string, got ${typeName(value)}` });
        return;
      }
      if (schema.min !== undefined && value.length < schema.min) {
        errors.push({ field: path, code: 'MIN_LENGTH', message: `must be at least ${schema.min} characters` });
      }
      if (schema.max !== undefined && value.length > schema.max) {
        errors.push({ field: path, code: 'MAX_LENGTH', message: `must be at most ${schema.max} characters` });
      }
      if (schema.pattern && !schema.pattern.test(value)) {
        errors.push({ field: path, code: 'PATTERN', message: 'does not match required pattern' });
      }
      return;
    }
    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push({ field: path, code: 'TYPE', message: `expected integer, got ${typeName(value)}` });
        return;
      }
      if (schema.min !== undefined && value < schema.min) {
        errors.push({ field: path, code: 'MIN', message: `must be >= ${schema.min}` });
      }
      if (schema.max !== undefined && value > schema.max) {
        errors.push({ field: path, code: 'MAX', message: `must be <= ${schema.max}` });
      }
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        errors.push({ field: path, code: 'TYPE', message: `expected boolean, got ${typeName(value)}` });
      }
      return;
    }
    case 'enum': {
      if (typeof value !== 'string' || !schema.values.includes(value)) {
        errors.push({ field: path, code: 'ENUM', message: `must be one of ${schema.values.join(', ')}` });
      }
      return;
    }
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ field: path, code: 'TYPE', message: `expected object, got ${typeName(value)}` });
        return;
      }
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (!(key in record)) {
          errors.push({ field: path === '' ? key : `${path}.${key}`, code: 'REQUIRED', message: 'is required' });
        }
      }
      for (const [key, child] of Object.entries(schema.properties)) {
        if (key in record) {
          collect(path === '' ? key : `${path}.${key}`, child, record[key], errors);
        }
      }
      return;
    }
  }
}

export function validateRequest(schema: RequestSchema, input: ValidatedInput): void {
  const errors: { field: string; code: string; message: string }[] = [];
  if (schema.params) {
    collect('params', { kind: 'object', properties: schema.params }, input.params, errors);
  }
  if (schema.query) {
    collect('query', { kind: 'object', properties: schema.query }, input.query, errors);
  }
  if (schema.headers) {
    collect('headers', { kind: 'object', properties: schema.headers }, input.headers, errors);
  }
  if (schema.body) {
    if (input.body === undefined) {
      errors.push({ field: 'body', code: 'REQUIRED', message: 'request body is required' });
    } else {
      collect('body', schema.body, input.body, errors);
    }
  }
  if (errors.length > 0) {
    throw new PlatformApiError({
      code: 'VALIDATION_FAILED',
      message: 'request validation failed',
      category: 'VALIDATION',
      retryable: false,
      httpStatus: 400,
      fieldErrors: errors,
    });
  }
}

export function parseJsonBody(raw: string): JsonValue {
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    throw new PlatformApiError({
      code: 'INVALID_JSON',
      message: 'request body is not valid JSON',
      category: 'VALIDATION',
      retryable: false,
      httpStatus: 400,
    });
  }
}
