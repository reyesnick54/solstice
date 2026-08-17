import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import {
  allChaosFaults,
  analyzeVotingPower,
  assertEngineeringLabel,
  assertExplorerCannotMutate,
  assertNoIndependentFinality,
  assertRpcCannotSign,
  assertSafeTelemetryRecord,
  backupRecoveryStrategies,
  createSignerSafetyBackup,
  createVerifiedSnapshot,
  dashboardDefinitions,
  decryptBackup,
  developmentMultiDomainProfile,
  dumpApplicationDatabase,
  encryptBackup,
  LocalFilesystemBackupStorage,
  MetricRegistry,
  requiredMetricCatalog,
  ResiliencePlatform,
  restoreSignerSafetyBackup,
  runChaosScenario,
  runDrill,
  runSunreyOps,
  S3CompatibleTestProvider,
  sealIncidentEvidence,
  SignerFencingController,
  SimulatedResilienceNetwork,
  StructuredLogSink,
  TraceCollector,
  verifyDatabaseDump,
  verifySnapshot,
} from './ops/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 55 SunRey resilience and disaster recovery', () => {
  it('distributes seven validators across three domains without independent finality', () => {
    const profile = developmentMultiDomainProfile();
    assert.equal(profile.validators.length, 7);
    assert.equal(profile.domains.length, 3);
    assert.equal(profile.votingPower.valid, true);
    assert.deepEqual(profile.votingPower.independentFinalityDomains, []);
    assertNoIndependentFinality();
    const concentrated = analyzeVotingPower([
      { validatorId: 'val_dev_1', domainId: 'fd_alpha', votingPower: 5n, signerTrustZone: 'z' },
      { validatorId: 'val_dev_2', domainId: 'fd_bravo', votingPower: 1n, signerTrustZone: 'z' },
      { validatorId: 'val_dev_3', domainId: 'fd_charlie', votingPower: 1n, signerTrustZone: 'z' },
    ]);
    assert.equal(concentrated.valid, false);
    assert.throws(() => assertNoIndependentFinality(concentrated.byDomain ? [
      { validatorId: 'val_dev_1', domainId: 'fd_alpha', votingPower: 5n, signerTrustZone: 'z' },
      { validatorId: 'val_dev_2', domainId: 'fd_bravo', votingPower: 1n, signerTrustZone: 'z' },
      { validatorId: 'val_dev_3', domainId: 'fd_charlie', votingPower: 1n, signerTrustZone: 'z' },
    ] : []));
  });

  it('collects required metrics without private key labels', () => {
    const network = new SimulatedResilienceNetwork();
    const names = new Set(network.metrics.snapshot().map((row) => row.name));
    for (const name of requiredMetricCatalog()) {
      assert.equal(names.has(name), true, name);
    }
    for (const sample of network.metrics.snapshot()) {
      assertSafeTelemetryRecord(sample, 'metrics');
    }
    const metrics = new MetricRegistry();
    assert.throws(() => metrics.observe('signer_health', 1n, { privateKey: 'secret' }));
  });

  it('keeps traces and logs free of PDV, KYC, and secrets', () => {
    const traces = new TraceCollector();
    const logs = new StructuredLogSink();
    const parent = traces.start('sdk_submission', 'sdk');
    traces.start('rpc', 'rpc', parent);
    logs.emit({
      service: 'rpc',
      requestId: 'req_1',
      traceId: parent.traceId,
      severity: 'INFO',
      eventCode: 'RPC_ACCEPT',
      message: 'accepted',
      blockHeight: '1',
      transactionId: 'tx_safe',
    });
    logs.security('SIGNER_REJECTION', 'signer rejected conflicting vote', 'req_2', parent.traceId);
    logs.security('WRONG_NETWORK_ACCESS', 'wrong network', 'req_3', parent.traceId);
    logs.security('INVALID_CRYPTO_SUITE', 'unknown suite', 'req_4', parent.traceId);
    logs.security('SUSPICIOUS_RPC_BEHAVIOR', 'rate anomaly', 'req_5', parent.traceId);
    logs.security('VALIDATOR_EVIDENCE', 'equivocation evidence', 'req_6', parent.traceId);
    logs.security('CUSTODY_SECURITY_HALT', 'vault halt', 'req_7', parent.traceId);
    logs.security('ORACLE_PROVIDER_SUSPENSION', 'provider suspended', 'req_8', parent.traceId);
    logs.security('INTEROP_CLIENT_FREEZE', 'client frozen', 'req_9', parent.traceId);
    for (const span of traces.spans()) {
      assertSafeTelemetryRecord(span, 'traces');
    }
    for (const record of logs.records()) {
      assertSafeTelemetryRecord(record, 'logs');
    }
    assert.throws(() => traces.start('bad', 'pdv', undefined, { pdvRaw: 'pdv:raw:record' }));
    assert.throws(() =>
      logs.emit({
        service: 'pdv',
        requestId: 'req_x',
        traceId: 'trace',
        severity: 'INFO',
        eventCode: 'LEAK',
        message: 'pdv:raw:nope',
      }),
    );
  });

  it('validates dashboards, alerts, SLOs, and backup classes', () => {
    const platform = new ResiliencePlatform();
    assert.deepEqual(
      platform.validateObservabilityConfigs(),
      ['otel-collector.yaml', 'prometheus/alerts.json', 'grafana/dashboards'],
    );
    assert.equal(dashboardDefinitions().length, 11);
    assertEngineeringLabel();
    assert.equal(backupRecoveryStrategies().length, 8);
    const slos = readFileSync(join(ROOT, 'packages/sunrey-chain/ops/slos.json'), 'utf8');
    assert.equal(slos.includes('ENGINEERING_TEST_TARGETS'), true);
  });

  it('encrypts backups with BACKUP_ENCRYPTION and verifies snapshots', () => {
    const keys = createSimulationKeyProvider();
    const snapshot = createVerifiedSnapshot({
      snapshotId: 'snap_1',
      height: 3n,
      blockId: 'block',
      stateRoot: 'root',
      state: '{"height":"3"}',
    });
    verifySnapshot(snapshot.manifest, snapshot.state);
    const envelope = encryptBackup(keys, snapshot.state);
    assert.equal(envelope.purpose, 'BACKUP_ENCRYPTION');
    assert.deepEqual(decryptBackup(keys, envelope), snapshot.state);
    assert.throws(() => verifySnapshot({ ...snapshot.manifest, stateRoot: 'tampered' }, snapshot.state));
    assert.throws(() =>
      verifySnapshot({ ...snapshot.manifest, chainId: 'chn_other' }, snapshot.state),
    );
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-ops-backup-'));
    try {
      const store = new LocalFilesystemBackupStorage(dir);
      store.put({
        objectId: snapshot.manifest.snapshotId,
        backupClass: 'BLOCKCHAIN_STATE',
        contentType: 'application/octet-stream',
        sha256: snapshot.manifest.stateSha256,
        bytes: snapshot.state,
      });
      assert.equal(store.get(snapshot.manifest.snapshotId).sha256, snapshot.manifest.stateSha256);
      const remote = new S3CompatibleTestProvider();
      remote.put({
        objectId: 'cfg',
        backupClass: 'ENCRYPTED_CONFIGURATION',
        contentType: 'application/octet-stream',
        sha256: snapshot.manifest.stateSha256,
        bytes: snapshot.state,
      });
      assert.equal(remote.get('cfg').objectId, 'cfg');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects stale signer-safety restore and dual active signers', () => {
    const backup = createSignerSafetyBackup({
      validatorId: 'val_dev_1',
      trustedHighWatermark: 4n,
      lastRound: 1n,
      createdAtUtc: '2026-08-17T00:00:00.000Z',
    });
    restoreSignerSafetyBackup({
      backup,
      currentValidatorId: 'val_dev_1',
      currentChainId: 'chn_sunrey_local_dev',
      knownHighWatermark: 4n,
      nowUtc: '2026-08-17T00:01:00.000Z',
      maxAgeMs: 120_000n,
      operatorAuthorized: true,
    });
    assert.throws(() =>
      restoreSignerSafetyBackup({
        backup,
        currentValidatorId: 'val_dev_1',
        currentChainId: 'chn_sunrey_local_dev',
        knownHighWatermark: 9n,
        nowUtc: '2026-08-17T00:01:00.000Z',
        maxAgeMs: 120_000n,
        operatorAuthorized: true,
      }),
    );
    const fencing = new SignerFencingController();
    fencing.register('val_dev_1', 'site_a', 'site_b');
    fencing.activatePassive({ validatorId: 'val_dev_1', operatorAuthorized: true });
    assert.throws(() => fencing.rejectDualActive('val_dev_1'));
  });

  it('detects tampered database backups and refuses invented journals', () => {
    const dump = dumpApplicationDatabase({
      ledgerPositions: [{ account: 'alice', amount: '5' }],
      custodyMetadata: [{ vault: 'vault_a', amount: '5' }],
    });
    verifyDatabaseDump(dump);
    assert.throws(() => verifyDatabaseDump({ ...dump, sha256: '00' }));
    const network = new SimulatedResilienceNetwork();
    network.submitTransactions(['tx_1']);
    network.applicationDb.custodyMetadata = [{ vault: 'vault_a', amount: '999', height: '1' }];
    assert.throws(() => network.reconcileApplication());
  });

  it('keeps RPC and Explorer failovers off the consensus and mutation path', () => {
    const network = new SimulatedResilienceNetwork();
    assertRpcCannotSign(network.rpc);
    assertExplorerCannotMutate(network.explorers);
    network.applyFault('KILL_RPC_NODE', 'rpc_alpha_a');
    assert.equal(network.healthyRpc().some((row) => row.instanceId === 'rpc_alpha_a'), false);
    assert.equal(network.healthyRpc().length > 0, true);
    network.submitRelayerPacket('pkt_1');
    assert.equal(network.relayerSeen.size, 1);
  });

  it('runs chaos faults and the seven-validator disaster-recovery suite', () => {
    const network = new SimulatedResilienceNetwork();
    for (const fault of allChaosFaults()) {
      runChaosScenario(new SimulatedResilienceNetwork(), fault);
    }
    const domain = runDrill('FAILURE_DOMAIN_LOSS');
    assert.equal(domain.report.finalState, 'RECOVERED');
    assert.equal(domain.report.alertsFired.includes('CONSENSUS_FINALITY_DELAY'), true);
    const partition = runDrill('NO_QUORUM_PARTITION');
    assert.equal(partition.report.finalState, 'RECOVERED');
    assert.equal(partition.report.integrityChecks.includes('no_conflicting_finality'), true);
    const db = runDrill('DATABASE_LOSS');
    assert.equal(db.report.integrityChecks.includes('ledger_custody_match'), true);
    const chain = runDrill('CHAIN_STATE_LOSS');
    assert.equal(chain.report.integrityChecks.includes('state_root_match'), true);
    const explorer = runDrill('EXPLORER_LOSS');
    assert.equal(explorer.report.integrityChecks.includes('explorer_rebuild_from_chain'), true);
    const signer = runDrill('SIGNER_FAILURE');
    assert.equal(signer.report.integrityChecks.includes('one_signer_active'), true);
    const end = runDrill('END_TO_END_RESILIENCE');
    assert.equal(end.report.finalState, 'RECOVERED');
    assert.equal(end.report.integrityChecks.includes('all_validator_state_roots_agree'), true);
    assert.equal(typeof end.report.measuredRtoMs, 'bigint');
  });

  it('exposes sunrey-ops commands and seals incident evidence without secrets', () => {
    const health = JSON.parse(runSunreyOps(['health'])) as { readonly validators: number };
    assert.equal(health.validators, 7);
    JSON.parse(runSunreyOps(['topology']));
    JSON.parse(runSunreyOps(['alerts']));
    JSON.parse(runSunreyOps(['backup', 'create']));
    JSON.parse(runSunreyOps(['dr', 'run', 'END_TO_END_RESILIENCE']));
    JSON.parse(runSunreyOps(['validator-fencing', 'val_dev_1']));
    const platform = new ResiliencePlatform(new FrozenClock(asUtcInstant('2026-08-17T00:00:00.000Z')));
    const record = sealIncidentEvidence(platform.evidence, 'OPS_SIGNER_INCIDENT', {
      validatorId: 'val_dev_1',
      action: 'fencing',
    });
    assert.equal(record.kind, 'OPS_SIGNER_INCIDENT');
    assert.throws(() =>
      sealIncidentEvidence(platform.evidence, 'OPS_VALIDATOR_COMPROMISE', {
        privateKey: 'leak',
      }),
    );
  });

  it('does not create competing ops packages or mention live networks in ops source', () => {
    assert.equal(readFileSync(join(ROOT, 'packages/sunrey-chain/src/ops/types.ts'), 'utf8').includes('testnet'), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/observability')), false);
    assert.equal(existsSync(join(ROOT, 'packages/disaster-recovery')), false);
  });
});
