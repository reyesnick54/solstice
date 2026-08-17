import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EncryptedEnvelope } from '../../../security/src/envelope.ts';
import type { KeyProvider } from '../../../security/src/provider.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import {
  BACKUP_CLASSES,
  DEVELOPMENT_CHAIN_ID,
  DEVELOPMENT_NETWORK_ID,
  type BackupClass,
  type BackupStorageKind,
  type RecoveryStrategy,
} from './types.ts';

export function backupRecoveryStrategies(): readonly RecoveryStrategy[] {
  return Object.freeze([
    {
      backupClass: 'BLOCKCHAIN_STATE',
      strategy: 'Verified snapshot manifest, state bytes, height, block id, state root, protocol version.',
      rebuildable: false,
      requiresEncryption: false,
      restoreVerification: 'Recompute state and manifest hashes; reject wrong-chain and tamper.',
    },
    {
      backupClass: 'CONSENSUS_WAL',
      strategy: 'Append-only WAL copy; restore never rewinds signer or finalized height.',
      rebuildable: false,
      requiresEncryption: false,
      restoreVerification: 'Replay WAL and compare committed height.',
    },
    {
      backupClass: 'SIGNER_SAFETY',
      strategy: 'Encrypted high-watermark backup. Restore is fenced and monotonic.',
      rebuildable: false,
      requiresEncryption: true,
      restoreVerification: 'Validator, chain, watermark, integrity, age, and operator authorization.',
    },
    {
      backupClass: 'VALIDATOR_CONFIGURATION',
      strategy: 'Non-secret validator placement and cell topology.',
      rebuildable: true,
      requiresEncryption: false,
      restoreVerification: 'Topology hash match.',
    },
    {
      backupClass: 'EXPLORER_INDEX',
      strategy: 'Optional. Prefer full rebuild from finalized chain.',
      rebuildable: true,
      requiresEncryption: false,
      restoreVerification: 'Public query outputs match rebuilt index.',
    },
    {
      backupClass: 'POSTGRES_APPLICATION_DATA',
      strategy: 'Logical dump with transaction-consistent snapshot, manifest, and encryption.',
      rebuildable: false,
      requiresEncryption: true,
      restoreVerification: 'Hash, migrate, integrity, ledger/custody/outbox checks. No invented journals.',
    },
    {
      backupClass: 'CUSTODY_METADATA',
      strategy: 'Encrypted operational metadata. Canonical quantity remains on chain.',
      rebuildable: false,
      requiresEncryption: true,
      restoreVerification: 'Reconcile to finalized holdings. No automatic balancing entries.',
    },
    {
      backupClass: 'ENCRYPTED_CONFIGURATION',
      strategy: 'Envelope-encrypted operator configuration. No vendor credentials in source.',
      rebuildable: true,
      requiresEncryption: true,
      restoreVerification: 'Decrypt with BACKUP_ENCRYPTION and compare hash.',
    },
  ]);
}

export function recoveryStrategy(backupClass: BackupClass): RecoveryStrategy {
  const found = backupRecoveryStrategies().find((row) => row.backupClass === backupClass);
  if (!found) {
    throw new Error(`missing recovery strategy for ${backupClass}`);
  }
  return found;
}

export type BackupObject = {
  readonly objectId: string;
  readonly backupClass: BackupClass;
  readonly contentType: string;
  readonly sha256: string;
  readonly bytes: Buffer;
};

export interface BackupStorageProvider {
  readonly kind: BackupStorageKind;
  put(object: BackupObject): void;
  get(objectId: string): BackupObject;
  list(): readonly BackupObject[];
}

export class LocalFilesystemBackupStorage implements BackupStorageProvider {
  readonly kind = 'LOCAL_FILESYSTEM' as const;
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
    mkdirSync(root, { recursive: true });
  }

  put(object: BackupObject): void {
    const meta = {
      objectId: object.objectId,
      backupClass: object.backupClass,
      contentType: object.contentType,
      sha256: object.sha256,
    };
    writeFileSync(join(this.#root, `${object.objectId}.meta.json`), JSON.stringify(meta));
    writeFileSync(join(this.#root, `${object.objectId}.bin`), object.bytes);
  }

  get(objectId: string): BackupObject {
    const meta = JSON.parse(readFileSync(join(this.#root, `${objectId}.meta.json`), 'utf8')) as Omit<
      BackupObject,
      'bytes'
    >;
    const bytes = readFileSync(join(this.#root, `${objectId}.bin`));
    const sha256 = sha256Hex(bytes);
    if (sha256 !== meta.sha256) {
      throw new Error('backup object hash mismatch after storage');
    }
    return { ...meta, bytes };
  }

  list(): readonly BackupObject[] {
    return [];
  }
}

export class S3CompatibleTestProvider implements BackupStorageProvider {
  readonly kind = 'S3_COMPATIBLE_TEST_PROVIDER' as const;
  readonly #objects = new Map<string, BackupObject>();

  put(object: BackupObject): void {
    this.#objects.set(object.objectId, object);
  }

  get(objectId: string): BackupObject {
    const found = this.#objects.get(objectId);
    if (!found) {
      throw new Error(`backup object ${objectId} missing`);
    }
    if (sha256Hex(found.bytes) !== found.sha256) {
      throw new Error('backup object hash mismatch after storage');
    }
    return found;
  }

  list(): readonly BackupObject[] {
    return [...this.#objects.values()];
  }
}

export type VerifiedSnapshotManifest = {
  readonly snapshotId: string;
  readonly chainId: string;
  readonly networkId: string;
  readonly height: string;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly protocolVersion: string;
  readonly stateSha256: string;
  readonly manifestSha256: string;
};

export function snapshotManifestHash(manifest: Omit<VerifiedSnapshotManifest, 'manifestSha256'>): string {
  return sha256Hex(
    [
      manifest.snapshotId,
      manifest.chainId,
      manifest.networkId,
      manifest.height,
      manifest.blockId,
      manifest.stateRoot,
      manifest.protocolVersion,
      manifest.stateSha256,
    ].join('\n'),
  );
}

export function createVerifiedSnapshot(input: {
  readonly snapshotId: string;
  readonly chainId?: string;
  readonly networkId?: string;
  readonly height: bigint;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly protocolVersion?: string;
  readonly state: string;
}): { readonly manifest: VerifiedSnapshotManifest; readonly state: Buffer } {
  const state = Buffer.from(input.state, 'utf8');
  const unsigned = {
    snapshotId: input.snapshotId,
    chainId: input.chainId ?? DEVELOPMENT_CHAIN_ID,
    networkId: input.networkId ?? DEVELOPMENT_NETWORK_ID,
    height: input.height.toString(),
    blockId: input.blockId,
    stateRoot: input.stateRoot,
    protocolVersion: input.protocolVersion ?? '1',
    stateSha256: sha256Hex(state),
  };
  return {
    manifest: { ...unsigned, manifestSha256: snapshotManifestHash(unsigned) },
    state,
  };
}

export function verifySnapshot(manifest: VerifiedSnapshotManifest, state: Buffer, expectedChainId = DEVELOPMENT_CHAIN_ID): void {
  if (manifest.chainId !== expectedChainId) {
    throw new Error('wrong-chain backup rejected');
  }
  if (sha256Hex(state) !== manifest.stateSha256) {
    throw new Error('tampered snapshot rejected');
  }
  const expected = snapshotManifestHash({
    snapshotId: manifest.snapshotId,
    chainId: manifest.chainId,
    networkId: manifest.networkId,
    height: manifest.height,
    blockId: manifest.blockId,
    stateRoot: manifest.stateRoot,
    protocolVersion: manifest.protocolVersion,
    stateSha256: manifest.stateSha256,
  });
  if (expected !== manifest.manifestSha256) {
    throw new Error('tampered snapshot rejected');
  }
}

export function encryptBackup(provider: KeyProvider, plaintext: Buffer): EncryptedEnvelope {
  const sealed = provider.encrypt('BACKUP_ENCRYPTION', plaintext);
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  if (sealed.value.purpose !== 'BACKUP_ENCRYPTION') {
    throw new Error('backup encryption must use BACKUP_ENCRYPTION');
  }
  return sealed.value;
}

export function decryptBackup(provider: KeyProvider, envelope: EncryptedEnvelope): Buffer {
  if (envelope.purpose !== 'BACKUP_ENCRYPTION') {
    throw new Error('backup encryption must use BACKUP_ENCRYPTION');
  }
  const opened = provider.decrypt(envelope);
  if (!opened.ok) {
    throw new Error(opened.error.message);
  }
  return opened.value;
}

export type SignerSafetyBackup = {
  readonly validatorId: string;
  readonly chainId: string;
  readonly trustedHighWatermark: string;
  readonly lastRound: string;
  readonly createdAtUtc: string;
  readonly integrity: string;
};

export function createSignerSafetyBackup(input: {
  readonly validatorId: string;
  readonly chainId?: string;
  readonly trustedHighWatermark: bigint;
  readonly lastRound: bigint;
  readonly createdAtUtc: string;
}): SignerSafetyBackup {
  const chainId = input.chainId ?? DEVELOPMENT_CHAIN_ID;
  const integrity = sha256Hex(
    `${input.validatorId}:${chainId}:${input.trustedHighWatermark.toString()}:${input.lastRound.toString()}:${input.createdAtUtc}`,
  );
  return Object.freeze({
    validatorId: input.validatorId,
    chainId,
    trustedHighWatermark: input.trustedHighWatermark.toString(),
    lastRound: input.lastRound.toString(),
    createdAtUtc: input.createdAtUtc,
    integrity,
  });
}

export function restoreSignerSafetyBackup(input: {
  readonly backup: SignerSafetyBackup;
  readonly currentValidatorId: string;
  readonly currentChainId: string;
  readonly knownHighWatermark: bigint;
  readonly nowUtc: string;
  readonly maxAgeMs: bigint;
  readonly operatorAuthorized: boolean;
}): SignerSafetyBackup {
  if (!input.operatorAuthorized) {
    throw new Error('signer-safety restore requires operator authorization');
  }
  if (input.backup.validatorId !== input.currentValidatorId) {
    throw new Error('signer-safety restore rejected: validator mismatch');
  }
  if (input.backup.chainId !== input.currentChainId) {
    throw new Error('wrong-chain backup rejected');
  }
  const expected = createSignerSafetyBackup({
    validatorId: input.backup.validatorId,
    chainId: input.backup.chainId,
    trustedHighWatermark: BigInt(input.backup.trustedHighWatermark),
    lastRound: BigInt(input.backup.lastRound),
    createdAtUtc: input.backup.createdAtUtc,
  });
  if (expected.integrity !== input.backup.integrity) {
    throw new Error('signer-safety backup integrity check failed');
  }
  const age = BigInt(Date.parse(input.nowUtc) - Date.parse(input.backup.createdAtUtc));
  if (age > input.maxAgeMs) {
    throw new Error('stale signer-safety restore rejected');
  }
  if (BigInt(input.backup.trustedHighWatermark) < input.knownHighWatermark) {
    throw new Error('stale signer-safety restore rejected');
  }
  return input.backup;
}

export type ApplicationDatabaseDump = {
  readonly dumpId: string;
  readonly consistent: true;
  readonly tables: Readonly<Record<string, readonly Record<string, string>[]>>;
  readonly sha256: string;
};

export function dumpApplicationDatabase(tables: Record<string, readonly Record<string, string>[]>): ApplicationDatabaseDump {
  const body = JSON.stringify(tables);
  return Object.freeze({
    dumpId: createHash('sha256').update(body).digest('hex').slice(0, 16),
    consistent: true,
    tables: Object.freeze({ ...tables }),
    sha256: sha256Hex(Buffer.from(body, 'utf8')),
  });
}

export function verifyDatabaseDump(dump: ApplicationDatabaseDump): void {
  const recomputed = sha256Hex(Buffer.from(JSON.stringify(dump.tables), 'utf8'));
  if (recomputed !== dump.sha256) {
    throw new Error('tampered DB backup detected');
  }
}

export function assertBackupClassCatalog(): void {
  if (backupRecoveryStrategies().length !== BACKUP_CLASSES.length) {
    throw new Error('backup class catalog is incomplete');
  }
}
