import type { EncryptedEnvelope } from '../../security/src/envelope.ts';
import { sha256Hex } from '../../security/src/hash.ts';
import type { DataKeyHandle, KeyProvider } from '../../security/src/provider.ts';
import type { DataPayloadId } from './ids.ts';

/**
 * Explicit data-key hierarchy.
 *
 *   KeyProvider DATA_ENCRYPTION KEK (purpose master, versioned)
 *     → subject wrapping handle (generateDataKey per vault)
 *     → per-asset / per-version DEK (fresh DEK inside each EncryptedEnvelope)
 *     → payload ciphertext
 *
 * There is no global user-data DEK. Each encrypt() call creates a unique DEK.
 * Business code never sees raw key material.
 *
 * Crypto-shredding deletes the stored envelope (wrapped DEK + ciphertext)
 * for one asset only. Sibling assets keep their own envelopes.
 */
export type VaultKeyHierarchy = {
  readonly kekPurpose: 'DATA_ENCRYPTION';
  readonly kekKeyId: string;
  readonly kekVersion: number;
  readonly subjectKeyHandle: DataKeyHandle;
  readonly assetKeyId: string;
  readonly rotationGeneration: number;
};

export type StoredEncryptedPayload = {
  readonly payloadId: DataPayloadId;
  readonly envelope: EncryptedEnvelope;
  readonly contentSha256: string;
  readonly byteLength: number;
  readonly shredded: boolean;
};

export type EncryptedPayloadStore = {
  put(record: StoredEncryptedPayload): void;
  get(payloadId: DataPayloadId): StoredEncryptedPayload | undefined;
  delete(payloadId: DataPayloadId): boolean;
  exists(payloadId: DataPayloadId): boolean;
  integrityCheck(payloadId: DataPayloadId, expectedHash: string): boolean;
};

export class InMemoryEncryptedPayloadStore implements EncryptedPayloadStore {
  private readonly records = new Map<string, StoredEncryptedPayload>();

  put(record: StoredEncryptedPayload): void {
    this.records.set(record.payloadId, Object.freeze({ ...record, envelope: Object.freeze({ ...record.envelope }) }));
  }

  get(payloadId: DataPayloadId): StoredEncryptedPayload | undefined {
    return this.records.get(payloadId);
  }

  delete(payloadId: DataPayloadId): boolean {
    const existing = this.records.get(payloadId);
    if (!existing) {
      return false;
    }
    this.records.set(
      payloadId,
      Object.freeze({
        ...existing,
        shredded: true,
        envelope: Object.freeze({
          ...existing.envelope,
          ciphertext: '',
          wrappedDek: '',
          wrappedDekIv: '',
          wrappedDekAuthTag: '',
          iv: '',
          authTag: '',
        }),
      }),
    );
    return true;
  }

  exists(payloadId: DataPayloadId): boolean {
    const record = this.records.get(payloadId);
    return record !== undefined && !record.shredded;
  }

  integrityCheck(payloadId: DataPayloadId, expectedHash: string): boolean {
    const record = this.records.get(payloadId);
    return record !== undefined && !record.shredded && record.contentSha256 === expectedHash;
  }

  snapshot(): readonly StoredEncryptedPayload[] {
    return Object.freeze([...this.records.values()]);
  }

  restore(rows: readonly StoredEncryptedPayload[]): void {
    this.records.clear();
    for (const row of rows) {
      this.put(row);
    }
  }
}

export function hashPlaintext(bytes: Buffer): string {
  return sha256Hex(bytes);
}

export function sealVaultPayload(
  keys: KeyProvider,
  plaintext: Buffer,
): { readonly envelope: EncryptedEnvelope; readonly contentSha256: string } {
  const contentSha256 = hashPlaintext(plaintext);
  const sealed = keys.encrypt('DATA_ENCRYPTION', plaintext);
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return { envelope: sealed.value, contentSha256 };
}

export function openVaultPayload(keys: KeyProvider, envelope: EncryptedEnvelope): Buffer {
  const opened = keys.decrypt(envelope);
  if (!opened.ok) {
    throw new Error(opened.error.message);
  }
  return opened.value;
}

export function issueSubjectKeyHandle(keys: KeyProvider): DataKeyHandle {
  const handle = keys.generateDataKey('DATA_ENCRYPTION');
  if (!handle.ok) {
    throw new Error(handle.error.message);
  }
  return handle.value;
}

export function envelopeLooksLikePlaintext(envelope: EncryptedEnvelope, needle: string): boolean {
  const haystack = [
    envelope.ciphertext,
    envelope.wrappedDek,
    envelope.iv,
    envelope.authTag,
  ].join('');
  return haystack.includes(needle);
}
