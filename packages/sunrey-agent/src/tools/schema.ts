import { PRIVILEGED_MODEL_FIELDS, type ToolCallInput, type ToolJsonSchema, type ToolSchemaField } from './types.ts';

const CURRENCY = /^[A-Z]{3,16}$/;
const MINOR_UNITS = /^-?\d+$/;

export type SchemaValidationFailure = {
  readonly ok: false;
  readonly code: 'INVALID_SCHEMA' | 'PRIVILEGED_FIELD_REJECTED' | 'UNKNOWN_FIELD';
  readonly detail: string;
};

export function validateToolInput(
  schema: ToolJsonSchema,
  input: ToolCallInput,
): { readonly ok: true; readonly value: ToolCallInput } | SchemaValidationFailure {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'INVALID_SCHEMA', detail: 'tool input must be a JSON object' };
  }
  for (const field of PRIVILEGED_MODEL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      return {
        ok: false,
        code: 'PRIVILEGED_FIELD_REJECTED',
        detail: `model cannot supply privileged field ${field}; the server derives it`,
      };
    }
  }
  for (const key of Object.keys(input)) {
    if (!(key in schema.properties)) {
      return { ok: false, code: 'UNKNOWN_FIELD', detail: `unknown field ${key} is not in the tool schema` };
    }
  }
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.properties)) {
    const present = Object.prototype.hasOwnProperty.call(input, key);
    if (field.required && !present) {
      return { ok: false, code: 'INVALID_SCHEMA', detail: `missing required field ${key}` };
    }
    if (!present) {
      continue;
    }
    const checked = checkField(key, field, input[key]);
    if (!checked.ok) {
      return checked;
    }
    out[key] = checked.value;
  }
  return { ok: true, value: Object.freeze(out) };
}

function checkField(
  path: string,
  field: ToolSchemaField,
  value: unknown,
): { readonly ok: true; readonly value: unknown } | SchemaValidationFailure {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string' || value.length === 0) {
        return { ok: false, code: 'INVALID_SCHEMA', detail: `${path} must be a non-empty string` };
      }
      return { ok: true, value };
    case 'currency':
      if (typeof value !== 'string' || !CURRENCY.test(value)) {
        return { ok: false, code: 'INVALID_SCHEMA', detail: `${path} must be an alphabetic currency code` };
      }
      return { ok: true, value };
    case 'minor_units':
      if (typeof value !== 'string' || !MINOR_UNITS.test(value) || value.includes('.') || value.includes('e')) {
        return {
          ok: false,
          code: 'INVALID_SCHEMA',
          detail: `${path} must be an integer minor-unit string; floating-point money is forbidden`,
        };
      }
      return { ok: true, value };
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { ok: false, code: 'INVALID_SCHEMA', detail: `${path} must be a boolean` };
      }
      return { ok: true, value };
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { ok: false, code: 'INVALID_SCHEMA', detail: `${path} must be an integer` };
      }
      return { ok: true, value };
    case 'enum':
      if (typeof value !== 'string' || !field.enum?.includes(value)) {
        return { ok: false, code: 'INVALID_SCHEMA', detail: `${path} is not an allowed value` };
      }
      return { ok: true, value };
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, code: 'INVALID_SCHEMA', detail: `${path} must be an object` };
      }
      const nested: ToolJsonSchema = {
        type: 'object',
        additionalProperties: false,
        properties: field.properties ?? {},
      };
      return validateToolInput(nested, value as ToolCallInput);
    }
    default:
      return { ok: false, code: 'INVALID_SCHEMA', detail: `${path} has an unsupported field type` };
  }
}

export function redactToolInput(input: ToolCallInput): ToolCallInput {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/coordinate|secret|iban|accountNumber|pan|cvv/i.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactToolInput(value as ToolCallInput);
    } else {
      out[key] = value;
    }
  }
  return Object.freeze(out);
}
