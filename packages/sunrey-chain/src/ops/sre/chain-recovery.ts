import type { SignerSafetyState } from '../../validators/types.ts';
import { createSnapshot, developmentGenesisFingerprint, verifySnapshot, type SnapshotTrust } from '../snapshots.ts';
import { planGenesisSync, planSnapshotSync, refuseUnverifiedProvider } from '../state-sync.ts';
import { safeRestart } from '../restart.ts';
import { DEVELOPMENT_CHAIN_ID, DEVELOPMENT_NETWORK_ID } from '../types.ts';

export type ChainRecoveryPlan = {
  readonly snapshots: true;
  readonly validatorRecovery: true;
  readonly rpcRecovery: true;
  readonly networkRestartRejoin: true;
  readonly genesisProtection: true;
  readonly unverifiedProviderAccepted: false;
  readonly productionActive: false;
};

export function chainRecoveryPlan(): ChainRecoveryPlan {
  return Object.freeze({
    snapshots: true,
    validatorRecovery: true,
    rpcRecovery: true,
    networkRestartRejoin: true,
    genesisProtection: true,
    unverifiedProviderAccepted: false,
    productionActive: false,
  });
}

export function rehearseChainRecovery(nowUtc = '2026-08-23T00:00:00.000Z'): {
  readonly snapshotVerified: boolean;
  readonly genesisProtected: boolean;
  readonly unverifiedRefused: boolean;
  readonly restartSafe: boolean;
} {
  const created = createSnapshot({
    networkId: DEVELOPMENT_NETWORK_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    genesisFingerprint: developmentGenesisFingerprint(),
    height: 4n,
    blockId: 'block_4',
    stateRoot: 'aa'.repeat(32),
    protocolVersion: '1',
    validatorSetHash: 'bb'.repeat(32),
    validatorSetVersion: 1n,
    payload: '{"height":4,"finalized":true}',
    createdAtUtc: nowUtc,
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  const trust: SnapshotTrust = {
    networkId: DEVELOPMENT_NETWORK_ID,
    chainId: DEVELOPMENT_CHAIN_ID,
    genesisFingerprint: developmentGenesisFingerprint(),
    protocolVersion: '1',
    trustedFinalizedHeight: 4n,
    trustedStateRoot: 'aa'.repeat(32),
  };
  const verified = verifySnapshot(created.value, trust);
  const genesis = planGenesisSync(4n);
  const snapshotSync = planSnapshotSync(created.value, trust, 6n);
  const unverified = refuseUnverifiedProvider();
  const safety: SignerSafetyState = {
    validatorId: 'val_dev_a',
    chainId: DEVELOPMENT_CHAIN_ID,
    lastSignedHeight: 4n,
    lastSignedRound: 1n,
    lastSignedStep: 'PRECOMMIT',
    canonicalSignBytesHash: 'cc'.repeat(32),
    signatureReference: 'sig_ref',
    updatedAt: nowUtc,
  };
  const restart = safeRestart(
    { walHeight: 4n, finalizedHeight: 4n, safety },
    { walHeight: 4n, finalizedHeight: 4n, safety },
  );
  return Object.freeze({
    snapshotVerified: verified.ok && snapshotSync.ok,
    genesisProtected: genesis.ok && genesis.value.mode === 'GENESIS_BLOCK_SYNC',
    unverifiedRefused: !unverified.ok,
    restartSafe: restart.ok,
  });
}
