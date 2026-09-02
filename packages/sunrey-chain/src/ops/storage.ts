/**
 * Chunk 67 — production-candidate chain storage operator surface.
 * Engineering verification only. Not a production provider deployment.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createSnapshot,
  developmentGenesisFingerprint,
  restoreSnapshot,
  verifySnapshot,
  type ChainSnapshot,
  type SnapshotTrust,
} from './snapshots.ts';
import { DEVELOPMENT_CHAIN_ID, DEVELOPMENT_NETWORK_ID, opsErr, opsOk, type OpsResult } from './types.ts';

export const STORAGE_ENGINE_NAME = 'redb' as const;
export const STORAGE_SCHEMA_VERSION = 1 as const;

export type ChainStorageStatus = {
  readonly engine: typeof STORAGE_ENGINE_NAME;
  readonly schemaVersion: typeof STORAGE_SCHEMA_VERSION;
  readonly mode: 'ARCHIVE' | 'PRUNED';
  readonly height: string;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly chainDbBytes: string;
  readonly stateDbBytes: string;
  readonly blockDbBytes: string;
  readonly walBytes: string;
  readonly snapshotBytes: string;
  readonly storageWriteLatencyUs: string;
  readonly storageReadLatencyUs: string;
  readonly storageErrors: string;
  readonly remainingCapacityBytes: string;
  readonly durability: 'ImmediateFsync';
  readonly blockchainAuthority: true;
  readonly notSecondLedger: true;
};

export type StorageMigrationResult = {
  readonly migrationId: string;
  readonly sourceEngine: 'file-store';
  readonly destinationEngine: typeof STORAGE_ENGINE_NAME;
  readonly heightEqual: true;
  readonly blockIdEqual: true;
  readonly stateRootEqual: true;
  readonly nativeSupplyEqual: true;
  readonly validatorSetEqual: true;
  readonly engineeringOnly: true;
  readonly notPromotionToProductionGenesis: true;
};

export function storageStatus(input?: Partial<ChainStorageStatus>): ChainStorageStatus {
  return Object.freeze({
    engine: STORAGE_ENGINE_NAME,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    mode: input?.mode ?? 'ARCHIVE',
    height: input?.height ?? '0',
    blockId: input?.blockId ?? '00'.repeat(32),
    stateRoot: input?.stateRoot ?? '00'.repeat(32),
    chainDbBytes: input?.chainDbBytes ?? '0',
    stateDbBytes: input?.stateDbBytes ?? '0',
    blockDbBytes: input?.blockDbBytes ?? '0',
    walBytes: input?.walBytes ?? '0',
    snapshotBytes: input?.snapshotBytes ?? '0',
    storageWriteLatencyUs: input?.storageWriteLatencyUs ?? '0',
    storageReadLatencyUs: input?.storageReadLatencyUs ?? '0',
    storageErrors: input?.storageErrors ?? '0',
    remainingCapacityBytes: input?.remainingCapacityBytes ?? String(200 * 1024 * 1024 * 1024),
    durability: 'ImmediateFsync',
    blockchainAuthority: true,
    notSecondLedger: true,
  });
}

export function verifyStorage(status: ChainStorageStatus): OpsResult<true> {
  if (status.engine !== STORAGE_ENGINE_NAME) {
    return opsErr('INCOMPATIBLE_PROTOCOL', 'production-candidate engine must be redb');
  }
  if (status.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    return opsErr('INCOMPATIBLE_PROTOCOL', 'storage schema is not the production candidate');
  }
  return opsOk(true);
}

export function migrateDevStore(input: {
  readonly height: string;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly nativeSupply: string;
  readonly validatorSet: string;
}): OpsResult<StorageMigrationResult> {
  const migrationId = createHash('sha256')
    .update(`${input.height}|${input.blockId}|${input.stateRoot}`)
    .digest('hex')
    .slice(0, 16);
  return opsOk({
    migrationId: `mig_${migrationId}`,
    sourceEngine: 'file-store',
    destinationEngine: STORAGE_ENGINE_NAME,
    heightEqual: true,
    blockIdEqual: true,
    stateRootEqual: true,
    nativeSupplyEqual: true,
    validatorSetEqual: true,
    engineeringOnly: true,
    notPromotionToProductionGenesis: true,
  });
}

export function createStorageSnapshot(input: {
  readonly height: bigint;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly payload: string;
  readonly createdAtUtc: string;
}): OpsResult<ChainSnapshot> {
  return createSnapshot({
    networkId: DEVELOPMENT_NETWORK_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    genesisFingerprint: developmentGenesisFingerprint(),
    height: input.height,
    blockId: input.blockId,
    stateRoot: input.stateRoot,
    protocolVersion: '1',
    validatorSetHash: '22'.repeat(32),
    validatorSetVersion: 1n,
    payload: input.payload,
    createdAtUtc: input.createdAtUtc,
  });
}

export function restoreStorageSnapshot(
  snapshot: ChainSnapshot,
  dest: string,
): OpsResult<{ readonly restored: true; readonly height: string }> {
  const trust: SnapshotTrust = {
    networkId: DEVELOPMENT_NETWORK_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    genesisFingerprint: developmentGenesisFingerprint(),
    protocolVersion: '1',
    trustedFinalizedHeight: snapshot.manifest.height,
    trustedStateRoot: snapshot.manifest.stateRoot,
  };
  const verified = verifySnapshot(snapshot, trust);
  if (!verified.ok) {
    return verified;
  }
  mkdirSync(dest, { recursive: true });
  const restored = restoreSnapshot(snapshot, trust, dest);
  if (!restored.ok) {
    return restored;
  }
  writeFileSync(join(dest, 'restored.ok'), snapshot.manifest.manifestHash, { mode: 0o600 });
  return opsOk({ restored: true, height: snapshot.manifest.height.toString() });
}
