/**
 * Wave 2 — recovery scenario catalog and rehearsal helpers.
 */

import { safeRestart, type RestartState } from '../ops/restart.ts';
import { planGenesisSync, planSnapshotSync } from '../ops/state-sync.ts';
import { opsOk } from '../ops/types.ts';
import type { ChainSnapshot, SnapshotTrust } from '../ops/snapshots.ts';
import { syncBlocksFromPeers, type BlockSyncInput } from './block-sync.ts';
import { verifyCanonicalSnapshot } from './snapshot-verification.ts';
import type { RecoveryScenario, RecoveryScenarioId, SyncResult } from './types.ts';

export const RECOVERY_SCENARIOS: readonly RecoveryScenario[] = Object.freeze([
  {
    id: 'ORDINARY_RESTART',
    supported: true,
    mechanism: 'Reload chain store and consensus WAL; signer safety watermark must not roll back.',
  },
  {
    id: 'VALIDATOR_DOWNTIME',
    supported: true,
    mechanism: 'Catch up via verified block sync and commit certificates; rejoin BFT after finality catches up.',
  },
  {
    id: 'LOCAL_STATE_CORRUPTION',
    supported: true,
    mechanism: 'Reject corrupt store; restore verified snapshot or replay genesis block sync from peers.',
  },
  {
    id: 'NEW_NON_VALIDATOR_JOIN',
    supported: true,
    mechanism: 'Genesis identity handshake, verified block sync or trusted snapshot + tail sync.',
  },
  {
    id: 'REPLACEMENT_VALIDATOR',
    supported: true,
    mechanism: 'Restore validator configuration and signer safety backup; sync chain state; never import keys from snapshot.',
  },
  {
    id: 'SNAPSHOT_RESTORE_BLOCK_SYNC',
    supported: true,
    mechanism: 'Verify snapshot manifest and supply; restore chain store; block-sync only heights after snapshot.',
  },
  {
    id: 'APP_DB_LOSS_CHAIN_SURVIVES',
    supported: true,
    mechanism: 'Rebuild application databases and projections from canonical chain; blockchain remains authoritative.',
  },
  {
    id: 'CHAIN_NODE_LOSS_BACKUPS_SURVIVE',
    supported: true,
    mechanism: 'Restore verified chain snapshot or replay from peers; reconcile secondary systems afterward.',
  },
]);

export const IRRECOVERABLE_CONDITIONS = Object.freeze([
  'Loss of all validator private keys with no secure backup',
  'Loss of all canonical chain history with no verified snapshot or surviving peers',
  'Accepting an unverified snapshot or peer-reported balance as truth',
]);

export function recoveryScenario(id: RecoveryScenarioId): RecoveryScenario {
  const found = RECOVERY_SCENARIOS.find((row) => row.id === id);
  if (!found) {
    throw new Error(`unknown recovery scenario ${id}`);
  }
  return found;
}

export type RecoveryRehearsalInput = {
  readonly before: RestartState;
  readonly after: RestartState;
  readonly snapshot: ChainSnapshot;
  readonly trust: SnapshotTrust;
  readonly blockSync: BlockSyncInput;
  readonly tailFinalizedHeight: bigint;
};

export type RecoveryRehearsalReport = {
  readonly restartSafe: boolean;
  readonly snapshotVerified: boolean;
  readonly snapshotSyncPlanned: boolean;
  readonly blockSyncVerified: boolean;
  readonly allScenariosDocumented: boolean;
};

export function rehearseRecovery(input: RecoveryRehearsalInput): SyncResult<RecoveryRehearsalReport> {
  const restart = safeRestart(input.before, input.after);
  const snapshot = verifyCanonicalSnapshot({ snapshot: input.snapshot, trust: input.trust });
  const snapshotSync = planSnapshotSync(input.snapshot, input.trust, input.tailFinalizedHeight);
  const blockSync = syncBlocksFromPeers(input.blockSync);
  const genesis = planGenesisSync(input.tailFinalizedHeight);
  return opsOk({
    restartSafe: restart.ok,
    snapshotVerified: snapshot.ok && snapshot.value.ok,
    snapshotSyncPlanned: snapshotSync.ok && snapshotSync.value.mode === 'TRUSTED_SNAPSHOT',
    blockSyncVerified: blockSync.ok && blockSync.value.ok,
    allScenariosDocumented: RECOVERY_SCENARIOS.length === 8 && genesis.ok,
  });
}
