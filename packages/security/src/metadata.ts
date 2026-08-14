import type { EncryptionAlgorithm, HashAlgorithm, SigningAlgorithm } from './algorithms.ts';
import type { KeyStatus } from './lifecycle.ts';
import type { KeyPurpose } from './purposes.ts';

/**
 * Safe key metadata. This is not key material.
 * Private bytes, KMS plaintext, recovery phrases, and seed phrases
 * must never appear here or in PostgreSQL application tables.
 */
export type KeyMetadata = {
  readonly keyId: string;
  readonly purpose: KeyPurpose;
  readonly algorithm: SigningAlgorithm | EncryptionAlgorithm | HashAlgorithm;
  readonly version: number;
  readonly status: KeyStatus;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly retiredAt: string | null;
  readonly revokedAt: string | null;
  readonly provider: string;
  readonly publicMaterial: string | null;
  readonly providerRef: string;
};

export type KeyVersionRef = {
  readonly keyId: string;
  readonly purpose: KeyPurpose;
  readonly version: number;
};

export function freezeKeyMetadata(meta: KeyMetadata): KeyMetadata {
  return Object.freeze({ ...meta });
}
