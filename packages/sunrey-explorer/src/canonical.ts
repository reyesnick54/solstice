import { createHash } from 'node:crypto';

import type { CanonicalProjection } from './types.ts';

export function canonicalProjectionJson(projection: CanonicalProjection): string {
  return stableStringify(projection);
}

export function canonicalProjectionHash(projection: CanonicalProjection): string {
  return createHash('sha256').update(canonicalProjectionJson(projection)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}
