import type { EncryptedEnvelope } from './envelope.ts';
import type { SecurityResult } from './errors.ts';
import type { KeyMetadata, KeyVersionRef } from './metadata.ts';
import type { KeyPurpose } from './purposes.ts';

export type Signature = {
  readonly algorithm: 'HMAC-SHA256';
  readonly hex: string;
  readonly keyId: string;
  readonly keyVersion: number;
};

export type DataKeyHandle = {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly purpose: KeyPurpose;
  readonly wrappedDek: string;
  readonly wrappedDekIv: string;
  readonly wrappedDekAuthTag: string;
};

export type PublicKeyMaterial = {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly algorithm: string;
  readonly pem: string | null;
};

/**
 * Canonical cryptographic key provider.
 *
 * Business code receives signatures, envelopes, and metadata — never raw
 * signing keys. Future cloud KMS / HSM / Vault adapters implement this port.
 */
export type KeyProvider = {
  readonly providerId: string;
  readonly environmentLabel: string;
  sign(purpose: KeyPurpose, payload: string | Buffer, version?: number): SecurityResult<Signature>;
  verify(
    purpose: KeyPurpose,
    payload: string | Buffer,
    signature: string,
    version?: number,
  ): SecurityResult<KeyVersionRef>;
  encrypt(purpose: KeyPurpose, plaintext: Buffer): SecurityResult<EncryptedEnvelope>;
  decrypt(envelope: EncryptedEnvelope): SecurityResult<Buffer>;
  generateDataKey(purpose: KeyPurpose): SecurityResult<DataKeyHandle>;
  resolveKeyVersion(purpose: KeyPurpose, version?: number): SecurityResult<KeyMetadata>;
  getPublicKey(purpose: KeyPurpose, version?: number): SecurityResult<PublicKeyMaterial>;
  rotateKey(purpose: KeyPurpose): SecurityResult<KeyMetadata>;
  retireKey(purpose: KeyPurpose, version: number): SecurityResult<KeyMetadata>;
  revokeKey(purpose: KeyPurpose, version: number): SecurityResult<KeyMetadata>;
  activateKey(purpose: KeyPurpose, version: number): SecurityResult<KeyMetadata>;
  keyStatus(purpose: KeyPurpose, version?: number): SecurityResult<KeyMetadata>;
  listKeyMetadata(purpose?: KeyPurpose): readonly KeyMetadata[];
};
