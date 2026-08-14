import { createHash } from 'node:crypto';

/**
 * Canonical SHA-256 hex digest. Deterministic. Used by Evidence Vault
 * integrity hashing and migration checksums. Not a MAC and not keyed.
 */
export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
