import { createCipheriv, createDecipheriv } from 'node:crypto';

import {
  AES_256_GCM,
  AES_GCM_IV_BYTES,
  AES_GCM_KEY_BYTES,
  ENVELOPE_SCHEMA_VERSION,
} from './algorithms.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import type { KeyPurpose } from './purposes.ts';
import { secureRandomBytes } from './random.ts';

/**
 * Persistable envelope-encryption record. Safe metadata only plus ciphertext.
 * Never log plaintext. Schema is versioned so later providers can evolve.
 */
export type EncryptedEnvelope = {
  readonly schemaVersion: typeof ENVELOPE_SCHEMA_VERSION;
  readonly algorithm: typeof AES_256_GCM;
  readonly wrappingAlgorithm: typeof AES_256_GCM;
  readonly keyId: string;
  readonly keyVersion: number;
  readonly purpose: KeyPurpose;
  readonly iv: string;
  readonly authTag: string;
  readonly wrappedDek: string;
  readonly wrappedDekIv: string;
  readonly wrappedDekAuthTag: string;
  readonly ciphertext: string;
};

export type DataKey = {
  readonly plaintextDek: Buffer;
  readonly wrappedDek: string;
  readonly wrappedDekIv: string;
  readonly wrappedDekAuthTag: string;
  readonly keyId: string;
  readonly keyVersion: number;
  readonly purpose: KeyPurpose;
};

export function aesGcmEncrypt(
  key: Buffer,
  plaintext: Buffer,
): SecurityResult<{ iv: Buffer; authTag: Buffer; ciphertext: Buffer }> {
  if (key.length !== AES_GCM_KEY_BYTES) {
    return securityErr('UNSUPPORTED_ALGORITHM', 'AES-256-GCM requires a 32-byte key');
  }
  const iv = secureRandomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return securityOk({ iv, authTag: cipher.getAuthTag(), ciphertext });
}

export function aesGcmDecrypt(
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer,
): SecurityResult<Buffer> {
  if (key.length !== AES_GCM_KEY_BYTES) {
    return securityErr('UNSUPPORTED_ALGORITHM', 'AES-256-GCM requires a 32-byte key');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return securityOk(plaintext);
  } catch {
    return securityErr(
      'AUTHENTICATION_FAILED',
      'AES-256-GCM authentication failed; ciphertext is untrusted',
    );
  }
}

export function generateDek(): Buffer {
  return secureRandomBytes(AES_GCM_KEY_BYTES);
}

export function wrapDek(masterKey: Buffer, dek: Buffer): SecurityResult<{
  wrappedDek: string;
  wrappedDekIv: string;
  wrappedDekAuthTag: string;
}> {
  const sealed = aesGcmEncrypt(masterKey, dek);
  if (!sealed.ok) {
    return sealed;
  }
  return securityOk({
    wrappedDek: sealed.value.ciphertext.toString('base64'),
    wrappedDekIv: sealed.value.iv.toString('base64'),
    wrappedDekAuthTag: sealed.value.authTag.toString('base64'),
  });
}

export function unwrapDek(
  masterKey: Buffer,
  wrappedDek: string,
  wrappedDekIv: string,
  wrappedDekAuthTag: string,
): SecurityResult<Buffer> {
  try {
    return aesGcmDecrypt(
      masterKey,
      Buffer.from(wrappedDekIv, 'base64'),
      Buffer.from(wrappedDekAuthTag, 'base64'),
      Buffer.from(wrappedDek, 'base64'),
    );
  } catch {
    return securityErr('CIPHERTEXT_MALFORMED', 'wrapped DEK encoding is malformed');
  }
}

export function sealEnvelope(input: {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly purpose: KeyPurpose;
  readonly masterKey: Buffer;
  readonly plaintext: Buffer;
}): SecurityResult<EncryptedEnvelope> {
  const dek = generateDek();
  const wrapped = wrapDek(input.masterKey, dek);
  if (!wrapped.ok) {
    return wrapped;
  }
  const sealed = aesGcmEncrypt(dek, input.plaintext);
  if (!sealed.ok) {
    return sealed;
  }
  return securityOk(
    Object.freeze({
      schemaVersion: ENVELOPE_SCHEMA_VERSION,
      algorithm: AES_256_GCM,
      wrappingAlgorithm: AES_256_GCM,
      keyId: input.keyId,
      keyVersion: input.keyVersion,
      purpose: input.purpose,
      iv: sealed.value.iv.toString('base64'),
      authTag: sealed.value.authTag.toString('base64'),
      wrappedDek: wrapped.value.wrappedDek,
      wrappedDekIv: wrapped.value.wrappedDekIv,
      wrappedDekAuthTag: wrapped.value.wrappedDekAuthTag,
      ciphertext: sealed.value.ciphertext.toString('base64'),
    }),
  );
}

export function openEnvelope(
  masterKey: Buffer,
  envelope: EncryptedEnvelope,
): SecurityResult<Buffer> {
  if (envelope.schemaVersion !== ENVELOPE_SCHEMA_VERSION) {
    return securityErr('CIPHERTEXT_MALFORMED', 'unsupported envelope schema version');
  }
  if (envelope.algorithm !== AES_256_GCM || envelope.wrappingAlgorithm !== AES_256_GCM) {
    return securityErr('UNSUPPORTED_ALGORITHM', 'envelope algorithm is not AES-256-GCM');
  }
  let dek: SecurityResult<Buffer>;
  try {
    dek = unwrapDek(
      masterKey,
      envelope.wrappedDek,
      envelope.wrappedDekIv,
      envelope.wrappedDekAuthTag,
    );
  } catch {
    return securityErr('CIPHERTEXT_MALFORMED', 'envelope fields are malformed');
  }
  if (!dek.ok) {
    return dek;
  }
  try {
    return aesGcmDecrypt(
      dek.value,
      Buffer.from(envelope.iv, 'base64'),
      Buffer.from(envelope.authTag, 'base64'),
      Buffer.from(envelope.ciphertext, 'base64'),
    );
  } catch {
    return securityErr('CIPHERTEXT_MALFORMED', 'envelope ciphertext encoding is malformed');
  }
}
