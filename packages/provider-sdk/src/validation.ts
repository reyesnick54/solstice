/**
 * Generic validation utilities for external provider payloads.
 * Domain-specific schemas belong with canonical domain owners.
 */

import { isUtcInstant } from '../../domain/src/time.ts';
import type { ProviderResult } from './types.ts';

const ISO_CURRENCY = /^[A-Z]{3}$/;
const ISO_COUNTRY = /^[A-Z]{2}$/;

export function requiredString(
  value: unknown,
  field: string,
): ProviderResult<string> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, code: 'REQUIRED_FIELD', message: `${field} is required` };
  }
  return { ok: true, value: value.trim() };
}

export function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function validateTimestamp(value: unknown, field: string): ProviderResult<string> {
  if (typeof value !== 'string' || !isUtcInstant(value)) {
    return { ok: false, code: 'TIMESTAMP_INVALID', message: `${field} must be a UTC instant` };
  }
  return { ok: true, value };
}

export function validateOptionalTimestamp(value: unknown, field: string): ProviderResult<string | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  return validateTimestamp(value, field);
}

export function validateFiniteNumber(value: unknown, field: string): ProviderResult<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, code: 'NUMERIC_INVALID', message: `${field} must be a finite number` };
  }
  return { ok: true, value };
}

export function validateNumericBounds(
  value: number,
  field: string,
  bounds: { readonly min?: number; readonly max?: number },
): ProviderResult<number> {
  if (bounds.min !== undefined && value < bounds.min) {
    return { ok: false, code: 'BOUNDS_INVALID', message: `${field} below minimum ${bounds.min}` };
  }
  if (bounds.max !== undefined && value > bounds.max) {
    return { ok: false, code: 'BOUNDS_INVALID', message: `${field} above maximum ${bounds.max}` };
  }
  return { ok: true, value };
}

export function validateCurrencyCode(value: unknown, field = 'currency'): ProviderResult<string> {
  const required = requiredString(value, field);
  if (!required.ok) {
    return required;
  }
  if (!ISO_CURRENCY.test(required.value)) {
    return { ok: false, code: 'CURRENCY_INVALID', message: `${field} must be ISO 4217 alpha-3` };
  }
  return required;
}

export function validateCountryCode(value: unknown, field = 'country'): ProviderResult<string> {
  const required = requiredString(value, field);
  if (!required.ok) {
    return required;
  }
  if (!ISO_COUNTRY.test(required.value)) {
    return { ok: false, code: 'COUNTRY_INVALID', message: `${field} must be ISO 3166-1 alpha-2` };
  }
  return required;
}

export function validateEnumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): ProviderResult<T> {
  const required = requiredString(value, field);
  if (!required.ok) {
    return required;
  }
  if (!(allowed as readonly string[]).includes(required.value)) {
    return {
      ok: false,
      code: 'ENUM_INVALID',
      message: `${field} must be one of: ${allowed.join(', ')}`,
    };
  }
  return { ok: true, value: required.value as T };
}

export function rejectUnexpectedNull<T>(
  value: T | null | undefined,
  field: string,
): ProviderResult<T> {
  if (value === null || value === undefined) {
    return { ok: false, code: 'UNEXPECTED_NULL', message: `${field} must not be null` };
  }
  return { ok: true, value };
}

export function validateAssetIdentifier(value: unknown, field = 'assetId'): ProviderResult<string> {
  const required = requiredString(value, field);
  if (!required.ok) {
    return required;
  }
  if (required.value.length > 128) {
    return { ok: false, code: 'ASSET_ID_INVALID', message: `${field} exceeds maximum length` };
  }
  if (!/^[A-Za-z0-9._:/-]+$/.test(required.value)) {
    return { ok: false, code: 'ASSET_ID_INVALID', message: `${field} contains invalid characters` };
  }
  return required;
}
