/**
 * Deterministic fingerprints for MD11 manifests and replay outputs.
 */

import { createHash } from 'node:crypto';

export function sha256Hex(parts: readonly string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part);
    hash.update('\n');
  }
  return hash.digest('hex');
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
}
