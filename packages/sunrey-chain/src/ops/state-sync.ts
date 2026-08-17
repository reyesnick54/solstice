import { verifySnapshot, type ChainSnapshot, type SnapshotTrust } from './snapshots.ts';
import { opsErr, opsOk, type OpsResult, type StateSyncMode } from './types.ts';

export type StateSyncPlan = {
  readonly mode: StateSyncMode;
  readonly fromHeight: bigint;
  readonly toHeight: bigint;
  readonly verifiedBlocks: number;
  readonly trusted: boolean;
};

export function planGenesisSync(finalizedHeight: bigint): OpsResult<StateSyncPlan> {
  if (finalizedHeight < 0n) {
    return opsErr('UNSAFE_CONFIG', 'finalized height cannot be negative');
  }
  return opsOk({
    mode: 'GENESIS_BLOCK_SYNC',
    fromHeight: 0n,
    toHeight: finalizedHeight,
    verifiedBlocks: Number(finalizedHeight),
    trusted: true,
  });
}

export function planSnapshotSync(
  snapshot: ChainSnapshot,
  trust: SnapshotTrust,
  subsequentFinalizedHeight: bigint,
): OpsResult<StateSyncPlan> {
  const verified = verifySnapshot(snapshot, trust);
  if (!verified.ok) {
    return verified;
  }
  if (subsequentFinalizedHeight < snapshot.manifest.height) {
    return opsErr('SNAPSHOT_TAMPER', 'subsequent blocks cannot be behind the snapshot height');
  }
  return opsOk({
    mode: 'TRUSTED_SNAPSHOT',
    fromHeight: snapshot.manifest.height,
    toHeight: subsequentFinalizedHeight,
    verifiedBlocks: Number(subsequentFinalizedHeight - snapshot.manifest.height),
    trusted: true,
  });
}

export function refuseUnverifiedProvider(): OpsResult<never> {
  return opsErr(
    'SNAPSHOT_TAMPER',
    'do not trust a snapshot provider without cryptographic verification',
  );
}
