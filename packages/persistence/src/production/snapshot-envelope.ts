/**
 * Versioned durable snapshot envelopes for fixture file stores.
 * Corruption fails closed. FILE_NOT_FOUND is the only empty-init path.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { canonicalJson } from '../canonical.ts';

export const SNAPSHOT_ENVELOPE_VERSION = 1 as const;

export const STORE_KINDS = ['CUSTODY', 'EXCHANGE', 'PAYMENT', 'PROVIDER', 'AGENT'] as const;
export type DurableStoreKind = (typeof STORE_KINDS)[number];

export const DURABLE_FAILURE_CODES = [
  'FILE_NOT_FOUND',
  'CORRUPT_JSON',
  'SCHEMA_INVALID',
  'CHECKSUM_MISMATCH',
  'PARTIAL_WRITE',
  'UNKNOWN_SCHEMA_VERSION',
  'UNSUPPORTED_SCHEMA_VERSION',
  'STALE_REVISION',
  'ILLEGAL_TRANSITION',
] as const;
export type DurableFailureCode = (typeof DURABLE_FAILURE_CODES)[number];

export type DurableSnapshotEnvelope<T> = {
  readonly schemaVersion: typeof SNAPSHOT_ENVELOPE_VERSION;
  readonly storeKind: DurableStoreKind;
  readonly createdAt: string;
  readonly sequence: number;
  readonly contentHash: string;
  readonly payload: T;
};

export class DurableStoreError extends Error {
  readonly code: DurableFailureCode;

  constructor(code: DurableFailureCode, message: string) {
    super(message);
    this.name = 'DurableStoreError';
    this.code = code;
  }
}

export type SnapshotPersistOptions = {
  readonly injectCrash?: 'BEFORE_RENAME' | 'AFTER_TMP_WRITE';
};

export function snapshotContentHash(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function wrapSnapshot<T>(input: {
  readonly storeKind: DurableStoreKind;
  readonly sequence: number;
  readonly createdAt: string;
  readonly payload: T;
}): DurableSnapshotEnvelope<T> {
  return Object.freeze({
    schemaVersion: SNAPSHOT_ENVELOPE_VERSION,
    storeKind: input.storeKind,
    createdAt: input.createdAt,
    sequence: input.sequence,
    contentHash: snapshotContentHash(input.payload),
    payload: input.payload,
  });
}

export function persistEnvelopeAtomic(
  path: string,
  envelope: DurableSnapshotEnvelope<unknown>,
  options: SnapshotPersistOptions = {},
): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  const text = `${canonicalJson(envelope)}\n`;
  writeFileSync(tmp, text, { mode: 0o600 });
  if (options.injectCrash === 'BEFORE_RENAME' || options.injectCrash === 'AFTER_TMP_WRITE') {
    throw new DurableStoreError(
      'PARTIAL_WRITE',
      `${path}: injected crash left a partial snapshot write`,
    );
  }
  renameSync(tmp, path);
}

export type LoadedSnapshot<T> =
  | { readonly kind: 'EMPTY' }
  | { readonly kind: 'ENVELOPE'; readonly envelope: DurableSnapshotEnvelope<T> };

export function loadEnvelopeOrEmpty<T>(
  path: string,
  expectedKind: DurableStoreKind,
  validatePayload: (payload: unknown) => payload is T,
): LoadedSnapshot<T> {
  const tmp = `${path}.tmp`;
  const mainExists = existsSync(path);
  const tmpExists = existsSync(tmp);
  if (!mainExists && tmpExists) {
    throw new DurableStoreError('PARTIAL_WRITE', `${path}: leftover tmp file without a completed snapshot`);
  }
  if (!mainExists) {
    return { kind: 'EMPTY' };
  }
  let stat;
  try {
    stat = statSync(path);
  } catch {
    throw new DurableStoreError('PARTIAL_WRITE', `${path}: snapshot disappeared during read`);
  }
  if (stat.size === 0) {
    throw new DurableStoreError('PARTIAL_WRITE', `${path}: empty snapshot file`);
  }
  const text = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new DurableStoreError('CORRUPT_JSON', `${path}: snapshot JSON could not be parsed`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new DurableStoreError('SCHEMA_INVALID', `${path}: snapshot root must be an object`);
  }
  const record = parsed as Record<string, unknown>;
  if (!('schemaVersion' in record) || !('storeKind' in record) || !('contentHash' in record) || !('payload' in record)) {
    throw new DurableStoreError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `${path}: historical unversioned snapshot cannot be reinterpreted`,
    );
  }
  if (typeof record.schemaVersion !== 'number' || !Number.isInteger(record.schemaVersion)) {
    throw new DurableStoreError('UNKNOWN_SCHEMA_VERSION', `${path}: schemaVersion is missing or not an integer`);
  }
  if (record.schemaVersion !== SNAPSHOT_ENVELOPE_VERSION) {
    throw new DurableStoreError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `${path}: schemaVersion ${String(record.schemaVersion)} is not supported`,
    );
  }
  if (record.storeKind !== expectedKind) {
    throw new DurableStoreError('SCHEMA_INVALID', `${path}: storeKind ${String(record.storeKind)} !== ${expectedKind}`);
  }
  if (typeof record.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(record.contentHash)) {
    throw new DurableStoreError('SCHEMA_INVALID', `${path}: contentHash must be a 64-char hex digest`);
  }
  if (typeof record.createdAt !== 'string' || typeof record.sequence !== 'number') {
    throw new DurableStoreError('SCHEMA_INVALID', `${path}: createdAt/sequence metadata is invalid`);
  }
  const expectedHash = snapshotContentHash(record.payload);
  if (expectedHash !== record.contentHash) {
    throw new DurableStoreError('CHECKSUM_MISMATCH', `${path}: contentHash does not match payload`);
  }
  if (!validatePayload(record.payload)) {
    throw new DurableStoreError('SCHEMA_INVALID', `${path}: payload failed ${expectedKind} schema validation`);
  }
  return {
    kind: 'ENVELOPE',
    envelope: Object.freeze({
      schemaVersion: SNAPSHOT_ENVELOPE_VERSION,
      storeKind: expectedKind,
      createdAt: record.createdAt,
      sequence: record.sequence,
      contentHash: record.contentHash,
      payload: record.payload,
    }),
  };
}

export const NATIVE_ASSETS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type NativeOperationalAssetId = (typeof NATIVE_ASSETS)[number];

export function isNativeOperationalAssetId(value: unknown): value is NativeOperationalAssetId {
  return value === 'SUNREY_COIN' || value === 'MOONREY_COIN';
}

export function assertNativeAsset(value: unknown, field: string): NativeOperationalAssetId {
  if (!isNativeOperationalAssetId(value)) {
    throw new DurableStoreError('SCHEMA_INVALID', `${field} must be SUNREY_COIN or MOONREY_COIN`);
  }
  return value;
}
