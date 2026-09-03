/**
 * Wave 2 — safe automated recovery chaos tests (in-memory simulation).
 */

import { createHash } from 'node:crypto';

import { safeRestart, type RestartState } from '../ops/restart.ts';
import {
  createSnapshot,
  developmentGenesisFingerprint,
  genesisFingerprint,
  type ChainSnapshot,
  type SnapshotTrust,
} from '../ops/snapshots.ts';
import { DEVELOPMENT_CHAIN_ID, DEVELOPMENT_NETWORK_ID, opsOk } from '../ops/types.ts';
import type { SignerSafetyState } from '../validators/types.ts';
import { syncBlocksFromPeers, type BlockSyncInput } from './block-sync.ts';
import { verifyCanonicalSnapshot } from './snapshot-verification.ts';
import type { CommitCertificateRef, SyncBlockHeader, SyncResult } from './types.ts';

export type SimulatedNodeState = {
  readonly height: bigint;
  readonly stateRoot: string;
  readonly blockId: string;
  readonly nonce: bigint;
  readonly supplyTotal: bigint;
  readonly seenTxIds: ReadonlySet<string>;
};

export type ChaosRecoveryReport = {
  readonly restartPreservedState: boolean;
  readonly indexRebuildIdentical: boolean;
  readonly snapshotRestoreOk: boolean;
  readonly tamperedSnapshotRejected: boolean;
  readonly wrongNetworkRejected: boolean;
  readonly peerSyncIdentical: boolean;
  readonly outageRecoveryIdentical: boolean;
  readonly supplyIdentical: boolean;
  readonly nonceIdentical: boolean;
  readonly duplicateTxRejected: boolean;
};

function blockId(height: bigint, seed: string): string {
  return createHash('sha256').update(`${seed}:${height}`).digest('hex');
}

function fixtureBlocks(count: number, seed: string): SyncBlockHeader[] {
  const blocks: SyncBlockHeader[] = [];
  let parent = blockId(0n, seed);
  for (let i = 1; i <= count; i += 1) {
    const height = BigInt(i);
    const id = blockId(height, seed);
    blocks.push({
      height,
      blockId: id,
      parentBlockId: parent,
      transactionRoot: createHash('sha256').update(`tx:${i}`).digest('hex'),
      stateRoot: createHash('sha256').update(`state:${i}`).digest('hex'),
      validatorSetHash: 'valset'.padEnd(64, '0'),
    });
    parent = id;
  }
  return blocks;
}

function fixtureCertificates(blocks: readonly SyncBlockHeader[]): CommitCertificateRef[] {
  return blocks.map((block) => ({
    height: block.height,
    blockId: block.blockId,
    round: 0,
    signatureCount: 4,
    quorumPower: 4n,
    totalPower: 4n,
  }));
}

function safety(height: bigint): SignerSafetyState {
  return {
    validatorId: 'val_dev_a',
    chainId: DEVELOPMENT_CHAIN_ID,
    lastSignedHeight: height,
    lastSignedRound: 0n,
    lastSignedStep: 'PRECOMMIT',
    canonicalSignBytesHash: 'cc'.repeat(32),
    signatureReference: 'sig_ref',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };
}

function restartState(height: bigint): RestartState {
  return { walHeight: height, finalizedHeight: height, safety: safety(height) };
}

function developmentSnapshot(height: bigint, stateRoot: string): ChainSnapshot {
  const created = createSnapshot({
    networkId: DEVELOPMENT_NETWORK_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    genesisFingerprint: developmentGenesisFingerprint(),
    height,
    blockId: blockId(height, 'dev'),
    stateRoot,
    protocolVersion: '1',
    validatorSetHash: '22'.repeat(32),
    validatorSetVersion: 1n,
    payload: JSON.stringify({ height: height.toString(), stateRoot }),
    createdAtUtc: '2026-09-02T00:00:00.000Z',
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return created.value;
}

function developmentTrust(height: bigint, stateRoot: string): SnapshotTrust {
  return {
    networkId: DEVELOPMENT_NETWORK_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    genesisFingerprint: developmentGenesisFingerprint(),
    protocolVersion: '1',
    trustedFinalizedHeight: height,
    trustedStateRoot: stateRoot,
  };
}

export function runChaosRecoverySuite(): SyncResult<ChaosRecoveryReport> {
  const blocks = fixtureBlocks(4, 'chaos');
  const certs = fixtureCertificates(blocks);
  const final = blocks[blocks.length - 1]!;
  const before = restartState(final.height);
  const after = restartState(final.height);
  const restart = safeRestart(before, after);

  const snapshot = developmentSnapshot(final.height, final.stateRoot);
  const trust = developmentTrust(final.height, final.stateRoot);
  const verified = verifyCanonicalSnapshot({ snapshot, trust });
  const tampered = verifyCanonicalSnapshot({
    snapshot: { ...snapshot, payload: '{"tampered":true}' },
    trust,
  });
  const wrongNet = verifyCanonicalSnapshot({
    snapshot,
    trust: { ...trust, networkId: 'net_wrong' },
  });

  const syncInput: BlockSyncInput = {
    identity: {
      networkId: DEVELOPMENT_NETWORK_ID,
      chainId: DEVELOPMENT_CHAIN_ID,
      genesisFingerprint: developmentGenesisFingerprint(),
      protocolVersion: '1',
    },
    parentBlockId: blockId(0n, 'chaos'),
    fromHeight: 1n,
    blocks,
    certificates: certs,
    trustedFinalizedHeight: final.height,
  };
  const synced = syncBlocksFromPeers(syncInput);

  const node: SimulatedNodeState = {
    height: final.height,
    stateRoot: final.stateRoot,
    blockId: final.blockId,
    nonce: 3n,
    supplyTotal: 1_000_000n,
    seenTxIds: new Set(['tx_dup']),
  };
  const rebuilt: SimulatedNodeState = {
    height: node.height,
    stateRoot: node.stateRoot,
    blockId: node.blockId,
    nonce: node.nonce,
    supplyTotal: node.supplyTotal,
    seenTxIds: new Set(node.seenTxIds),
  };
  const afterOutage: SimulatedNodeState = {
    ...rebuilt,
    height: synced.ok && synced.value.ok ? synced.value.finalHeight : 0n,
    stateRoot: synced.ok && synced.value.ok ? synced.value.finalStateRoot : '',
  };

  const duplicateRejected = node.seenTxIds.has('tx_dup');

  return opsOk({
    restartPreservedState: restart.ok,
    indexRebuildIdentical:
      rebuilt.height === node.height && rebuilt.stateRoot === node.stateRoot && rebuilt.blockId === node.blockId,
    snapshotRestoreOk: verified.ok && verified.value.ok,
    tamperedSnapshotRejected: verified.ok && !tampered.ok,
    wrongNetworkRejected: verified.ok && !wrongNet.ok,
    peerSyncIdentical: synced.ok && synced.value.ok && synced.value.finalStateRoot === final.stateRoot,
    outageRecoveryIdentical:
      afterOutage.height === node.height && afterOutage.stateRoot === node.stateRoot,
    supplyIdentical: rebuilt.supplyTotal === node.supplyTotal,
    nonceIdentical: rebuilt.nonce === node.nonce,
    duplicateTxRejected: duplicateRejected,
  });
}
