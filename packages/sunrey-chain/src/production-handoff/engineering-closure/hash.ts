import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AUDIT_HASH_DOMAIN, CLOSURE_HASH_DOMAIN, MANIFEST_HASH_DOMAIN } from './identity.ts';

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
  return sha256Text(canonicalJson(value));
}

export function hashArchitectureManifest(root = process.cwd()): string {
  const body = readFileSync(join(root, 'docs/architecture/manifest.json'), 'utf8');
  return sha256Text(`${MANIFEST_HASH_DOMAIN}\n${body}`);
}

export function hashAudit(value: unknown): string {
  return sha256Text(`${AUDIT_HASH_DOMAIN}\n${canonicalJson(value)}`);
}

export function hashClosure(value: unknown): string {
  return sha256Text(`${CLOSURE_HASH_DOMAIN}\n${canonicalJson(value)}`);
}
