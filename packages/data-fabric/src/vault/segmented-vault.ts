import { createHash, randomUUID } from 'node:crypto';

import {
  assertKernelAuthorization,
  type KernelAuthorization,
  type PersonalDataCategory,
} from '@solstice/kernel';
import { LIVE_DATA_MARKET_ENABLED } from '@solstice/flags';

import type { CategoryKeyProvider } from '../keys/provider.ts';
import type { VaultStorage } from '../storage/interface.ts';
import {
  classifySyntheticWrite,
  rejectUnclassified,
  type ClassifiedAttributes,
  type ClassifiedSyntheticRecord,
  type UnclassifiedWrite,
} from './record.ts';

export type VaultWriteInput = {
  readonly recordId?: string;
  readonly subjectRef: string;
  readonly category: PersonalDataCategory;
  readonly attributes: ClassifiedAttributes;
  readonly classifiedAt: string;
  readonly provenance: 'SYNTHETIC';
};

export type VaultWriteReceipt = {
  readonly recordId: string;
  readonly category: PersonalDataCategory;
  readonly keyId: string;
  readonly plaintextSha256: string;
  readonly storedAt: string;
};

/**
 * Segmented Personal Data Vault.
 *
 * Each category is an independently keyed domain. There is no method that
 * accepts two categories. Internal decrypt is package-private and is only
 * invoked by the clean room. Public API never returns raw records.
 */
export class SegmentedPersonalDataVault {
  readonly #keys: CategoryKeyProvider;
  readonly #storage: VaultStorage;

  constructor(keys: CategoryKeyProvider, storage: VaultStorage) {
    this.#keys = keys;
    this.#storage = storage;
    if (LIVE_DATA_MARKET_ENABLED !== false) {
      throw new Error('LIVE_DATA_MARKET_ENABLED must remain false');
    }
  }

  keyRef(category: PersonalDataCategory) {
    return this.#keys.keyRefFor(category);
  }

  recordCount(category: PersonalDataCategory): number {
    return this.#storage.storeFor(category).list().length;
  }

  recordHashes(category: PersonalDataCategory): readonly string[] {
    return this.#storage.storeFor(category).list().map((row) => row.envelope.plaintextSha256);
  }

  /** @kernelGated */
  storeClassifiedRecord(
    authorization: KernelAuthorization,
    input: VaultWriteInput,
  ): VaultWriteReceipt {
    assertKernelAuthorization(authorization, 'STORE_PERSONAL_DATA');
    if (LIVE_DATA_MARKET_ENABLED !== false) {
      throw new Error('LIVE_DATA_MARKET_ENABLED must remain false');
    }
    if (input.provenance !== 'SYNTHETIC') {
      rejectUnclassified(input as UnclassifiedWrite);
    }
    const classified = classifySyntheticWrite({
      recordId: input.recordId ?? `syn_${randomUUID()}`,
      subjectRef: input.subjectRef,
      category: input.category,
      attributes: input.attributes,
      classifiedAt: input.classifiedAt,
      provenance: 'SYNTHETIC',
    });
    const plaintext = Buffer.from(canonicalAttributes(classified), 'utf8');
    const envelope = this.#keys.wrap(classified.category, plaintext);
    const storedAt = classified.classifiedAt;
    this.#storage.storeFor(classified.category).append({
      recordId: classified.recordId,
      subjectRef: hashSubjectRef(classified.subjectRef),
      envelope,
      storedAt,
    });
    return Object.freeze({
      recordId: classified.recordId,
      category: classified.category,
      keyId: envelope.keyId,
      plaintextSha256: envelope.plaintextSha256,
      storedAt,
    });
  }

  /**
   * Clean-room-only compute. Requires RUN_CLEAN_ROOM KernelAuthorization.
   * The callback must return an aggregate-only value. There is no public
   * method that returns decrypted rows to an external caller.
   */
  computeInCategory<T>(
    authorization: KernelAuthorization,
    category: PersonalDataCategory,
    fn: (rows: readonly DecryptedRow[]) => T,
  ): T {
    assertKernelAuthorization(authorization, 'RUN_CLEAN_ROOM');
    const stored = this.#storage.storeFor(category).list();
    const rows: DecryptedRow[] = stored.map((row) => {
      const plaintext = this.#keys.unwrap(category, row.envelope);
      const parsed = JSON.parse(Buffer.from(plaintext).toString('utf8')) as {
        readonly recordId: string;
        readonly subjectRef: string;
        readonly category: PersonalDataCategory;
        readonly attributes: ClassifiedAttributes;
      };
      return Object.freeze({
        recordId: row.recordId,
        subjectRef: parsed.subjectRef,
        category,
        attributes: Object.freeze({ ...parsed.attributes }),
        plaintextSha256: row.envelope.plaintextSha256,
      });
    });
    return fn(Object.freeze(rows));
  }
}

export type DecryptedRow = {
  readonly recordId: string;
  readonly subjectRef: string;
  readonly category: PersonalDataCategory;
  readonly attributes: ClassifiedAttributes;
  readonly plaintextSha256: string;
};

function hashSubjectRef(subjectRef: string): string {
  return createHash('sha256').update(subjectRef, 'utf8').digest('hex');
}

function canonicalAttributes(record: ClassifiedSyntheticRecord): string {
  const attrs: Record<string, string> = {};
  for (const key of Object.keys(record.attributes).sort()) {
    const value = record.attributes[key]!;
    attrs[key] = typeof value === 'bigint' ? `${value.toString()}n` : value;
  }
  return JSON.stringify({
    recordId: record.recordId,
    subjectRef: record.subjectRef,
    category: record.category,
    attributes: attrs,
    provenance: 'SYNTHETIC',
  });
}
