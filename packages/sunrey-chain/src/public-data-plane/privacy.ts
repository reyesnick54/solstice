import { FORBIDDEN_PUBLIC_FIELDS, HUMAN_INFORMATION_PUBLIC_FIELDS } from './types.ts';

const FORBIDDEN = new Set<string>(FORBIDDEN_PUBLIC_FIELDS);
const HUMAN_OK = new Set<string>(HUMAN_INFORMATION_PUBLIC_FIELDS);

export function stripPrivatePublicSurface<T>(value: T): T {
  return project(value, 0) as T;
}

export function containsForbiddenPublicField(value: unknown): boolean {
  return walkForbidden(value, 0);
}

export function humanInformationPublicProjection(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (HUMAN_OK.has(key)) {
      out[key] = nested;
    }
  }
  return out;
}

function project(value: unknown, depth: number): unknown {
  if (depth > 8 || value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => project(item, depth + 1));
  }
  if (typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(key) || isForbiddenName(key)) {
      continue;
    }
    out[key] = project(nested, depth + 1);
  }
  return out;
}

function walkForbidden(value: unknown, depth: number): boolean {
  if (depth > 8 || value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => walkForbidden(item, depth + 1));
  }
  if (typeof value !== 'object') {
    return false;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(key) || isForbiddenName(key)) {
      return true;
    }
    if (walkForbidden(nested, depth + 1)) {
      return true;
    }
  }
  return false;
}

function isForbiddenName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/-/g, '_');
  return (
    normalized.includes('kyc') ||
    normalized.includes('pdv') ||
    normalized.includes('private_case') ||
    normalized.includes('provider_credential') ||
    normalized.includes('custody_private') ||
    normalized.includes('restricted_security') ||
    normalized === 'private_key'
  );
}
