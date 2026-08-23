import { createHash } from 'node:crypto';

import { PRODUCTION_GATE_HASH_DOMAIN } from './types.ts';

export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => {
    if (typeof inner === 'bigint') {
      return inner.toString();
    }
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(inner as Record<string, unknown>).sort()) {
        sorted[key] = (inner as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return inner;
  });
}

export function hashCanonical(value: unknown): string {
  return sha256Text(`${PRODUCTION_GATE_HASH_DOMAIN}\n${canonicalJson(value)}`);
}
