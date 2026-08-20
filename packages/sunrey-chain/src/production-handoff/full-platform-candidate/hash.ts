/**
 * Domain-separated hashes for the full-platform candidate binder.
 * Canonical evidence hashes exclude environmental / wall-clock metrics.
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';

export const BINDING_DOMAIN = 'SUNREY_FULL_PLATFORM_CANDIDATE_BINDING_V1' as const;
export const BUNDLE_HASH_DOMAIN = 'SUNREY_FULL_PLATFORM_CANDIDATE_BUNDLE_V1' as const;
export const BURN_IN_HASH_DOMAIN = 'SUNREY_FULL_PLATFORM_BURN_IN_CANONICAL_V1' as const;
export const CHECKPOINT_HASH_DOMAIN = 'SUNREY_FULL_PLATFORM_CHECKPOINT_V1' as const;
export const ENVIRONMENTAL_HASH_DOMAIN = 'SUNREY_FULL_PLATFORM_ENVIRONMENTAL_V1' as const;

export function hashOf(value: string): string {
  return sha256Hex(encodeString(value));
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
  return sha256Hex(encodeString(canonicalJson(value)));
}

export function hashDomainFields(domain: string, fields: Readonly<Record<string, string>>): string {
  const keys = Object.keys(fields).sort();
  const parts = [encodeString(domain), encodeString(String(keys.length))];
  for (const key of keys) {
    parts.push(encodeString(key), encodeString(fields[key] ?? ''));
  }
  return sha256Hex(Buffer.concat(parts));
}

export function implicitVersionRejected(versionId: string): boolean {
  const normalized = versionId.trim().toLowerCase();
  return normalized === 'latest' || normalized === 'current' || normalized === 'default';
}
