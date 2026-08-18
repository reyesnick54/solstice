import { createHash } from 'node:crypto';

import { POST_GENESIS_DOMAIN } from './types.ts';

export function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export function commitPostGenesis(value: unknown): string {
  return sha256Hex(`${POST_GENESIS_DOMAIN}|${stable(value)}`);
}

export function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}
