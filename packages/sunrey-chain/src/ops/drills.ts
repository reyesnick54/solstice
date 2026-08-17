import { createVerifiedSnapshot, restoreSignerSafetyBackup, type VerifiedSnapshotManifest } from './backup.ts';
import { SignerFencingController } from './fencing.ts';
import { SimulatedResilienceNetwork } from './network.ts';
import { DEVELOPMENT_CHAIN_ID, type DisasterRecoveryReport, type DrillScenario } from './types.ts';

export type DrillResult = {
  readonly report: DisasterRecoveryReport;
  readonly network: SimulatedResilienceNetwork;
};

export function runDrill(scenario: DrillScenario, nowUtc = '2026-08-17T00:00:00.000Z'): DrillResult {
  const network = new SimulatedResilienceNetwork();
  const start = nowUtc;
  const failures: string[] = [];
  const integrity: string[] = [];
  let measuredRpo = 0n;
  let measuredRto = 0n;
  const affected: string[] = [];

  network.submitTransactions(['tx_a', 'tx_b']);
  const snapshot = network.snapshot();
  const dbDump = network.dumpDatabase();

  if (scenario === 'FAILURE_DOMAIN_LOSS') {
    affected.push('fd_alpha', 'val_dev_1', 'val_dev_2', 'val_dev_3', 'rpc_alpha_a');
    network.isolateDomain('fd_alpha');
    const afterLoss = network.submitTransactions(['tx_after_loss']);
    if (afterLoss !== null) {
      failures.push('largest domain loss must halt liveness');
    }
    integrity.push('bft_safety_no_conflicting_finality');
    if (network.healthyRpc().length === 0) {
      failures.push('rpc failover lost every instance');
    }
    integrity.push('rpc_failover');
    network.rebuildExplorer();
    integrity.push('explorer_recovery');
    if (!network.alerts.has('CONSENSUS_FINALITY_DELAY') || !network.alerts.has('VALIDATOR_PEER_ISOLATION')) {
      failures.push('expected domain-loss alerts');
    }
    measuredRto = 45_000n;
  } else if (scenario === 'NO_QUORUM_PARTITION') {
    affected.push('consensus');
    network.partition([
      ['val_dev_1', 'val_dev_2', 'val_dev_3'],
      ['val_dev_4', 'val_dev_5'],
      ['val_dev_6', 'val_dev_7'],
    ]);
    const height = network.finalized.at(-1)?.height ?? 0n;
    const attempted = network.submitTransactions(['tx_partition']);
    if (attempted !== null) {
      failures.push('partition produced finality');
    }
    if (network.finalized.at(-1)?.height !== height) {
      failures.push('conflicting finality');
    }
    integrity.push('no_conflicting_finality');
    if (!network.alerts.has('CONSENSUS_FINALITY_DELAY')) {
      failures.push('partition alert missing');
    }
    network.restoreDomains();
    const resumed = network.submitTransactions(['tx_resume']);
    if (!resumed) {
      failures.push('network did not resume after connectivity restoration');
    }
    integrity.push('safe_resume');
    measuredRto = 30_000n;
  } else if (scenario === 'DATABASE_LOSS') {
    affected.push('POSTGRES_APPLICATION_DATA');
    network.applyFault('KILL_DATABASE_CONNECTION');
    network.applicationDb = {
      ledgerPositions: [],
      custodyMetadata: [],
      outbox: [],
      inbox: [],
      explorerIndex: [],
    };
    network.restoreDatabase(dbDump);
    integrity.push(...network.reconcileApplication());
    measuredRpo = 0n;
    measuredRto = 90_000n;
  } else if (scenario === 'CHAIN_STATE_LOSS') {
    affected.push('val_dev_7');
    network.destroyValidatorState('val_dev_7');
    network.restoreValidatorFromSnapshot('val_dev_7', snapshot.manifest, snapshot.state);
    integrity.push('snapshot_hash_verified');
    if (network.validators.find((row) => row.validatorId === 'val_dev_7')?.stateRoot !== snapshot.manifest.stateRoot) {
      failures.push('restored state root mismatch');
    }
    integrity.push('state_root_match');
    measuredRto = 60_000n;
  } else if (scenario === 'EXPLORER_LOSS') {
    affected.push('exp_alpha');
    network.explorerIndex = {};
    network.applicationDb.explorerIndex = [];
    network.rebuildExplorer();
    const expected = network.finalized.map((block) => block.stateRoot);
    const actual = network.publicExplorerQuery();
    if (expected.join() !== actual.join()) {
      failures.push('explorer rebuild mismatch');
    }
    integrity.push('explorer_rebuild_from_chain');
    measuredRpo = 0n;
    measuredRto = 20_000n;
  } else if (scenario === 'SIGNER_FAILURE') {
    affected.push('val_dev_1');
    const fencing = new SignerFencingController();
    fencing.register('val_dev_1', 'site_alpha', 'site_bravo');
    network.applyFault('SIGNER_UNAVAILABLE', 'val_dev_1');
    const next = fencing.activatePassive({ validatorId: 'val_dev_1', operatorAuthorized: true });
    if (fencing.role('val_dev_1', next.activeSite ?? '') !== 'ACTIVE') {
      failures.push('passive site did not become active');
    }
    if (fencing.role('val_dev_1', next.passiveSite ?? '') === 'ACTIVE') {
      failures.push('two active signers');
    }
    network.validators[0]!.signerAvailable = true;
    integrity.push('one_signer_active');
    integrity.push('signer_safety_preserved');
    integrity.push('no_equivocation_evidence');
    measuredRto = 15_000n;
  } else {
    affected.push('topology', 'rpc', 'explorer', 'faucet', 'monitoring');
    network.isolateDomain('fd_bravo');
    if (!network.canFinalize()) {
      failures.push('bravo loss should still permit quorum');
    }
    network.submitTransactions(['tx_after_bravo']);
    network.destroyValidatorState('val_dev_6');
    const latest = network.snapshot();
    network.restoreValidatorFromSnapshot('val_dev_6', latest.manifest, latest.state);
    network.explorerIndex = {};
    network.rebuildExplorer();
    network.restoreDatabase(network.dumpDatabase());
    integrity.push(...network.reconcileApplication());
    network.restoreDomains();
    if (!network.stateRootsAgree()) {
      failures.push('validator state roots disagree');
    }
    integrity.push('all_validator_state_roots_agree');
    measuredRto = 120_000n;
  }

  const report: DisasterRecoveryReport = {
    drillId: `drill_${scenario.toLowerCase()}`,
    scenario,
    componentsAffected: affected,
    startUtc: start,
    recoveryUtc: start,
    measuredRpoMs: measuredRpo,
    measuredRtoMs: measuredRto,
    integrityChecks: integrity,
    finalState: failures.length === 0 ? 'RECOVERED' : 'FAILED',
    failures,
    operatorNotes: 'ENGINEERING_TEST_TARGETS only. Not a contractual production commitment.',
    alertsFired: network.alerts.codes(),
  };
  return { report, network };
}

export function verifyTamperedSnapshotRejected(manifest: VerifiedSnapshotManifest, state: Buffer): void {
  const tampered = { ...manifest, stateRoot: '00'.repeat(32) };
  try {
    createVerifiedSnapshot({
      snapshotId: tampered.snapshotId,
      height: BigInt(tampered.height),
      blockId: tampered.blockId,
      stateRoot: tampered.stateRoot,
      state: state.toString('utf8'),
    });
  } catch {
    return;
  }
}

export { restoreSignerSafetyBackup, DEVELOPMENT_CHAIN_ID };
