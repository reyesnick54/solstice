/**
 * Deterministic SHA-256 digest of raw provider payloads.
 *
 * Proves what SunRey received — not that provider content is objectively true.
 */

import { sha256Hex } from '../../security/src/hash.ts';

export const RAW_PAYLOAD_HASH_ALGORITHM = 'sha256' as const;

export type RawPayloadHash = {
  readonly algorithm: typeof RAW_PAYLOAD_HASH_ALGORITHM;
  readonly digest: string;
};

/**
 * Canonical JSON serialization for hashing: sorted keys, no whitespace.
 * Non-JSON payloads should be hashed as UTF-8 strings or Buffers directly.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function hashRawPayload(payload: string | Buffer): RawPayloadHash {
  return Object.freeze({
    algorithm: RAW_PAYLOAD_HASH_ALGORITHM,
    digest: sha256Hex(payload),
  });
}

export function hashRawJsonPayload(value: unknown): RawPayloadHash {
  return hashRawPayload(canonicalJsonStringify(value));
}

function sortKeys(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeys(entry));
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortKeys(record[key]);
  }
  return sorted;
}
