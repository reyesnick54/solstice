import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertBackupBoundariesDistinct,
  EVIDENCE_VAULT_BACKUP_BOUNDARY,
  IRRECOVERABLE_CONDITIONS,
  RECOVERY_SCENARIOS,
  reconcileSecondaryToChain,
  rejectDatabaseRewrite,
  rejectPeerReportedBalance,
  rehearseRecovery,
  runChaosRecoverySuite,
  syncBlocksFromPeers,
  VALIDATOR_KEY_BACKUP_BOUNDARY,
  verifyCanonicalSnapshot,
  verifySnapshotSupply,
  WAVE2_BACKUP_BOUNDARIES,
} from './sync/index.ts';
import {
  createSnapshot,
  developmentGenesisFingerprint,
} from './ops/snapshots.ts';
import { DEVELOPMENT_CHAIN_ID, DEVELOPMENT_NETWORK_ID } from './ops/types.ts';
import type { SignerSafetyState } from './validators/types.ts';

const NOW = '2026-09-02T00:00:00.000Z';

function safety(height: bigint): SignerSafetyState {
  return {
    validatorId: 'val_dev_a',
    chainId: DEVELOPMENT_CHAIN_ID,
    lastSignedHeight: height,
    lastSignedRound: 0n,
    lastSignedStep: 'PRECOMMIT',
    canonicalSignBytesHash: 'cc'.repeat(32),
    signatureReference: 'sig_ref',
    updatedAt: NOW,
  };
}

describe('Wave 2 — state sync and recovery', () => {
  it('verifies block sync with ancestry, finality, and state transitions', () => {
    const genesis = '00'.repeat(32);
    const block1 = '11'.repeat(32);
    const block2 = '22'.repeat(32);
    const report = syncBlocksFromPeers({
      identity: {
        networkId: DEVELOPMENT_NETWORK_ID,
        chainId: DEVELOPMENT_CHAIN_ID,
        genesisFingerprint: developmentGenesisFingerprint(),
        protocolVersion: '1',
      },
      parentBlockId: genesis,
      fromHeight: 1n,
      blocks: [
        {
          height: 1n,
          blockId: block1,
          parentBlockId: genesis,
          transactionRoot: 'aa'.repeat(32),
          stateRoot: 'bb'.repeat(32),
          validatorSetHash: 'cc'.repeat(32),
        },
        {
          height: 2n,
          blockId: block2,
          parentBlockId: block1,
          transactionRoot: 'dd'.repeat(32),
          stateRoot: 'ee'.repeat(32),
          validatorSetHash: 'cc'.repeat(32),
        },
      ],
      certificates: [
        { height: 1n, blockId: block1, round: 0, signatureCount: 4, quorumPower: 4n, totalPower: 4n },
        { height: 2n, blockId: block2, round: 0, signatureCount: 4, quorumPower: 4n, totalPower: 4n },
      ],
      trustedFinalizedHeight: 2n,
    });
    assert.equal(report.ok, true);
    if (report.ok) {
      assert.equal(report.value.ok, true);
      assert.equal(report.value.verifiedBlocks, 2);
      assert.equal(report.value.finalStateRoot, 'ee'.repeat(32));
    }
  });

  it('rejects peer-reported balances and tampered snapshots', () => {
    assert.equal(rejectPeerReportedBalance().ok, false);
    const created = createSnapshot({
      networkId: DEVELOPMENT_NETWORK_ID,
      chainId: DEVELOPMENT_CHAIN_ID,
      genesisFingerprint: developmentGenesisFingerprint(),
      height: 3n,
      blockId: 'block_3',
      stateRoot: 'aa'.repeat(32),
      protocolVersion: '1',
      validatorSetHash: 'bb'.repeat(32),
      validatorSetVersion: 1n,
      payload: '{"height":3}',
      createdAtUtc: NOW,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const trust = {
      networkId: DEVELOPMENT_NETWORK_ID,
      chainId: DEVELOPMENT_CHAIN_ID,
      genesisFingerprint: developmentGenesisFingerprint(),
      protocolVersion: '1',
      trustedFinalizedHeight: 3n,
      trustedStateRoot: 'aa'.repeat(32),
    };
    const ok = verifyCanonicalSnapshot({ snapshot: created.value, trust });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.ok, true);
    }
    const tampered = verifyCanonicalSnapshot({
      snapshot: { ...created.value, payload: '{"evil":true}' },
      trust,
    });
    assert.equal(tampered.ok, true);
    if (tampered.ok) {
      assert.equal(tampered.value.ok, false);
    }
    const wrongNet = verifyCanonicalSnapshot({
      snapshot: created.value,
      trust: { ...trust, networkId: 'net_other' },
    });
    assert.equal(wrongNet.ok, true);
    if (wrongNet.ok) {
      assert.equal(wrongNet.value.ok, false);
    }
  });

  it('validates supply invariants during snapshot verification', () => {
    const supplyOk = verifySnapshotSupply([
      {
        assetId: 'SUNREY_COIN',
        genesisAllocated: 1000n,
        issuedPostGenesis: 0n,
        burned: 0n,
        circulating: 1000n,
        locked: 0n,
        escrowed: 0n,
        feeReserved: 0n,
      },
    ]);
    assert.equal(supplyOk.ok, true);
    const supplyBad = verifySnapshotSupply([
      {
        assetId: 'SUNREY_COIN',
        genesisAllocated: 1000n,
        issuedPostGenesis: 0n,
        burned: 0n,
        circulating: 900n,
        locked: 0n,
        escrowed: 0n,
        feeReserved: 0n,
      },
    ]);
    assert.equal(supplyBad.ok, false);
  });

  it('reconciles secondary systems against canonical chain state only', () => {
    const report = reconcileSecondaryToChain({
      chainBalances: [{ accountOrKey: 'acct_a', assetId: 'SUNREY_COIN', quantity: 100n }],
      secondaryBalances: [
        { target: 'LEDGER', accountOrKey: 'acct_a', assetId: 'SUNREY_COIN', quantity: 100n },
        { target: 'WALLET_INDEX', accountOrKey: 'acct_b', assetId: 'SUNREY_COIN', quantity: 5n },
      ],
    });
    assert.equal(report.ok, true);
    if (report.ok) {
      assert.equal(report.value.ok, false);
      assert.equal(report.value.authority, 'BLOCKCHAIN_CANONICAL');
      assert.equal(report.value.mismatches.length, 1);
      assert.equal(report.value.mismatches[0]?.target, 'WALLET_INDEX');
    }
    assert.equal(rejectDatabaseRewrite().ok, false);
  });

  it('documents distinct backup boundaries and irrecoverable conditions', () => {
    assert.equal(assertBackupBoundariesDistinct(), true);
    assert.equal(WAVE2_BACKUP_BOUNDARIES.length >= 7, true);
    assert.equal(VALIDATOR_KEY_BACKUP_BOUNDARY.commitToRepository, false);
    assert.equal(EVIDENCE_VAULT_BACKUP_BOUNDARY.includesEvidenceVault, true);
    assert.equal(RECOVERY_SCENARIOS.length, 8);
    assert.equal(IRRECOVERABLE_CONDITIONS.length >= 3, true);
  });

  it('runs chaos recovery suite with identical state after recovery', () => {
    const chaos = runChaosRecoverySuite();
    assert.equal(chaos.ok, true);
    if (!chaos.ok) {
      return;
    }
    const r = chaos.value;
    assert.equal(r.restartPreservedState, true);
    assert.equal(r.indexRebuildIdentical, true);
    assert.equal(r.snapshotRestoreOk, true);
    assert.equal(r.tamperedSnapshotRejected, true);
    assert.equal(r.wrongNetworkRejected, true);
    assert.equal(r.peerSyncIdentical, true);
    assert.equal(r.outageRecoveryIdentical, true);
    assert.equal(r.supplyIdentical, true);
    assert.equal(r.nonceIdentical, true);
    assert.equal(r.duplicateTxRejected, true);
  });

  it('rehearses end-to-end recovery workflow', () => {
    const created = createSnapshot({
      networkId: DEVELOPMENT_NETWORK_ID,
      chainId: DEVELOPMENT_CHAIN_ID,
      genesisFingerprint: developmentGenesisFingerprint(),
      height: 2n,
      blockId: '22'.repeat(32),
      stateRoot: 'aa'.repeat(32),
      protocolVersion: '1',
      validatorSetHash: 'bb'.repeat(32),
      validatorSetVersion: 1n,
      payload: '{"height":2}',
      createdAtUtc: NOW,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const trust = {
      networkId: DEVELOPMENT_NETWORK_ID,
      chainId: DEVELOPMENT_CHAIN_ID,
      genesisFingerprint: developmentGenesisFingerprint(),
      protocolVersion: '1',
      trustedFinalizedHeight: 4n,
      trustedStateRoot: 'aa'.repeat(32),
    };
    const report = rehearseRecovery({
      before: { walHeight: 2n, finalizedHeight: 2n, safety: safety(2n) },
      after: { walHeight: 2n, finalizedHeight: 2n, safety: safety(2n) },
      snapshot: created.value,
      trust,
      blockSync: {
        identity: {
          networkId: DEVELOPMENT_NETWORK_ID,
          chainId: DEVELOPMENT_CHAIN_ID,
          genesisFingerprint: developmentGenesisFingerprint(),
          protocolVersion: '1',
        },
        parentBlockId: '22'.repeat(32),
        fromHeight: 3n,
        blocks: [
          {
            height: 3n,
            blockId: '33'.repeat(32),
            parentBlockId: '22'.repeat(32),
            transactionRoot: 'aa'.repeat(32),
            stateRoot: 'bb'.repeat(32),
            validatorSetHash: 'cc'.repeat(32),
          },
          {
            height: 4n,
            blockId: '44'.repeat(32),
            parentBlockId: '33'.repeat(32),
            transactionRoot: 'dd'.repeat(32),
            stateRoot: 'ee'.repeat(32),
            validatorSetHash: 'cc'.repeat(32),
          },
        ],
        certificates: [
          { height: 3n, blockId: '33'.repeat(32), round: 0, signatureCount: 4, quorumPower: 4n, totalPower: 4n },
          { height: 4n, blockId: '44'.repeat(32), round: 0, signatureCount: 4, quorumPower: 4n, totalPower: 4n },
        ],
        trustedFinalizedHeight: 4n,
      },
      tailFinalizedHeight: 4n,
    });
    assert.equal(report.ok, true);
    if (report.ok) {
      assert.equal(report.value.restartSafe, true);
      assert.equal(report.value.snapshotVerified, true);
      assert.equal(report.value.snapshotSyncPlanned, true);
      assert.equal(report.value.blockSyncVerified, true);
    }
  });
});
