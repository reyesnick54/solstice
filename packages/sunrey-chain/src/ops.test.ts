import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { CANONICAL_VALIDATOR_SUITE_ID, fourValidatorDevelopmentSet, type ConsensusSignRequest } from './validators/index.ts';
import { verifySnapshot as verifyBackupSnapshot } from './ops/backup.ts';
import {
  LocalFilesystemBackupStorage,
  MetricRegistry,
  OperatorKeystore,
  OperatorPeerPolicy,
  RemoteSignerServer,
  ResiliencePlatform,
  S3CompatibleTestProvider,
  SEVEN_VALIDATOR_IDS,
  SevenValidatorNetwork,
  SignerFence,
  SignerFencingController,
  SignerSafetyStore,
  SimulatedResilienceNetwork,
  StructuredLogSink,
  TraceCollector,
  allChaosFaults,
  analyzeVotingPower,
  assertEngineeringLabel,
  assertExplorerCannotMutate,
  assertNoIndependentFinality,
  assertNoPrivateKeyMaterial,
  assertRpcCannotSign,
  assertSafeTelemetryRecord,
  authenticateSignerClient,
  authorizeDevelopmentUpgrade,
  availableSentryCount,
  backupRecoveryStrategies,
  compareSafetyWatermark,
  createSignerSafetyBackup,
  createSnapshot,
  createVerifiedSnapshot,
  dashboardDefinitions,
  decryptBackup,
  developmentEpoch,
  developmentMultiDomainProfile,
  developmentRemoteSigner,
  developmentSentryConfig,
  developmentSentryTopology,
  developmentUpgradeFixture,
  developmentValidatorConfig,
  dumpApplicationDatabase,
  encryptBackup,
  eraseEvidence,
  evaluateDisk,
  exitWorkflow,
  generateJoinRecord,
  gracefulShutdownPreserves,
  incidentProcedure,
  integrityHash,
  jailRecord,
  jailStatus,
  joinWorkflow,
  kubernetesManifest,
  operatorReadiness,
  opsUsage,
  planGenesisSync,
  planSnapshotSync,
  prune,
  publicRpcSignerIdentity,
  recommendedLimits,
  refuseUnverifiedProvider,
  replaceWorkflow,
  reportIncompatibleBinary,
  requiredMetricCatalog,
  restoreSignerSafetyBackup,
  restoreSnapshot,
  rotateWorkflow,
  runChaosScenario,
  runDrill,
  runOpsCommand,
  runRollingUpgrade,
  runSunreyOps,
  safeRestart,
  sealIncidentEvidence,
  sentryCanSign,
  sentrySignerIdentity,
  structuredLog,
  systemdUnit,
  upgradePrecheck,
  validateSentryTopology,
  validateSignRequest,
  validateValidatorConfig,
  verifyChainSnapshot,
  verifyDatabaseDump,
  warnDiskPressure,
} from './ops/index.ts';
import { MaintenanceMode } from './ops/maintenance.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const NOW = '2026-08-17T00:00:00.000Z';

function request(
  validatorId: string,
  overrides: Partial<ConsensusSignRequest> = {},
): ConsensusSignRequest {
  return {
    validatorId,
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    protocolVersion: '1',
    messageType: 'PREVOTE',
    height: 3n,
    round: 1n,
    blockId: 'block-3',
    validatorSetVersion: 1n,
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
    ...overrides,
  };
}

function failedCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  assert.equal(result.ok, false);
  assert.ok(result.error);
  return result.error.code;
}

function withDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'sunrey-ops-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
    assert.equal(dashboardDefinitions().length, 13);
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
    verifyBackupSnapshot(snapshot.manifest, snapshot.state);
    const envelope = encryptBackup(keys, snapshot.state);
    assert.equal(envelope.purpose, 'BACKUP_ENCRYPTION');
    assert.deepEqual(decryptBackup(keys, envelope), snapshot.state);
    assert.throws(() => verifyBackupSnapshot({ ...snapshot.manifest, stateRoot: 'tampered' }, snapshot.state));
    assert.throws(() =>
      verifyBackupSnapshot({ ...snapshot.manifest, chainId: 'chn_other' }, snapshot.state),
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

describe('Chunk 54 SunRey validator operator infrastructure', () => {
  it('rejects unsafe validator configuration and forbidden hosted services', () => {
    const dir = '/tmp/sunrey-ops-cfg';
    const safe = developmentValidatorConfig({ dataDirectory: dir });
    assert.equal(validateValidatorConfig(safe).ok, true);
    const publicRpc = developmentValidatorConfig({
      dataDirectory: dir,
      rpc: { host: '0.0.0.0', port: 26657, public: true },
    });
    assert.equal(validateValidatorConfig(publicRpc).ok, false);
    const explorer = developmentValidatorConfig({
      dataDirectory: dir,
      hostedServices: ['PUBLIC_EXPLORER'],
    });
    assert.equal(validateValidatorConfig(explorer).ok, false);
    const oneSentry = developmentValidatorConfig({
      dataDirectory: dir,
      sentryPeers: [{ peerId: 'only', kind: 'SENTRY', address: '10.0.0.11:26656', persistent: true }],
    });
    assert.equal(validateValidatorConfig(oneSentry).ok, false);
  });

  it('requires two sentries and forbids sentry signing', () => {
    const topology = developmentSentryTopology();
    assert.equal(validateSentryTopology(topology).ok, true);
    assert.equal(validateSentryTopology({ ...topology, sentries: topology.sentries.slice(0, 1) }).ok, false);
    const sentry = developmentSentryConfig(topology, 0);
    assert.equal(sentry.hasConsensusVotingKey, false);
    assert.equal(failedCode(sentryCanSign(sentry)), 'SENTRY_CANNOT_SIGN');
  });

  it('sentry cannot sign and public RPC cannot reach the signer', () => {
    withDir((dir) => {
      const { server } = developmentRemoteSigner({ dataDir: dir, validatorId: 'val_dev_a' });
      const req = request('val_dev_a');
      const sentry = server.sign(req, sentrySignerIdentity(), NOW);
      assert.equal(sentry.ok, false);
      if (!sentry.ok) {
        assert.equal(sentry.error.code, 'SENTRY_CANNOT_SIGN');
      }
      const rpc = server.sign(req, publicRpcSignerIdentity(), NOW);
      assert.equal(rpc.ok, false);
      if (!rpc.ok) {
        assert.equal(rpc.error.code, 'PUBLIC_RPC_CANNOT_REACH_SIGNER');
      }
    });
  });

  it('rejects wrong validator, network, and chain', () => {
    withDir((dir) => {
      const { server } = developmentRemoteSigner({ dataDir: dir, validatorId: 'val_dev_a' });
      const client = {
        clientId: 'validator-client-a',
        role: 'VALIDATOR' as const,
        certificateFingerprint: 'a'.repeat(64),
      };
      const wrongValidator = server.sign(request('val_dev_b'), client, NOW);
      assert.equal(wrongValidator.ok, false);
      if (!wrongValidator.ok) {
        assert.equal(wrongValidator.error.code, 'WRONG_VALIDATOR');
      }
      const wrongNetwork = server.sign(request('val_dev_a', { networkId: 'net_other' }), client, NOW);
      assert.equal(wrongNetwork.ok, false);
      if (!wrongNetwork.ok) {
        assert.equal(wrongNetwork.error.code, 'WRONG_NETWORK');
      }
      const wrongChain = server.sign(request('val_dev_a', { chainId: 'chn_other' }), client, NOW);
      assert.equal(wrongChain.ok, false);
      if (!wrongChain.ok) {
        assert.equal(wrongChain.error.code, 'WRONG_CHAIN');
      }
    });
  });

  it('signs through the remote signer without exporting private keys', () => {
    withDir((dir) => {
      const { server, client } = developmentRemoteSigner({ dataDir: dir, validatorId: 'val_dev_a' });
      const signed = client.sign(request('val_dev_a'));
      assert.equal(signed.ok, true);
      const exported = server.exportPrivateKey();
      assert.equal(exported.ok, false);
      if (!exported.ok) {
        assert.equal(exported.error.code, 'PRIVATE_KEY_EXPORT_FORBIDDEN');
      }
    });
  });

  it('protects signer safety against rollback and corruption', () => {
    withDir((dir) => {
      const { server, store } = developmentRemoteSigner({ dataDir: dir, validatorId: 'val_dev_a' });
      const client = {
        clientId: 'validator-client-a',
        role: 'VALIDATOR' as const,
        certificateFingerprint: 'a'.repeat(64),
      };
      const first = server.sign(request('val_dev_a', { height: 5n, round: 2n, messageType: 'PRECOMMIT' }), client, NOW);
      assert.equal(first.ok, true);
      const backup = store.backup(NOW);
      assert.equal(backup.ok, true);
      if (!backup.ok) {
        return;
      }
      const current = store.safety.load();
      assert.ok(current);
      const older = {
        ...current,
        lastSignedHeight: 4n,
        lastSignedRound: 0n,
        lastSignedStep: 'PREVOTE' as const,
      };
      const rolled = store.restore(older, backup.value);
      assert.equal(rolled.ok, false);
      if (!rolled.ok) {
        assert.equal(rolled.error.code, 'SIGNER_ROLLBACK');
      }
      const same = store.restore(current, backup.value);
      assert.equal(same.ok, true);
      assert.equal(compareSafetyWatermark(current, current), 0);
      assert.equal(integrityHash(current).length, 64);
    });
  });

  it('fences a duplicate active signer', () => {
    const fence = new SignerFence(() => NOW);
    const first = fence.acquire('val_dev_a', 'region-a', 60_000);
    assert.equal(first.ok, true);
    const second = fence.acquire('val_dev_a', 'region-b', 60_000);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'DUPLICATE_ACTIVE_SIGNER');
    }
    withDir((dir) => {
      const store = new SignerSafetyStore(dir, 'val_dev_a', 'chn_sunrey_local_dev');
      const a = new RemoteSignerServer({
        transport: 'MTLS',
        policy: {
          networkId: 'net_sunrey_local_dev',
          chainId: 'chn_sunrey_local_dev',
          validatorId: 'val_dev_a',
          cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
          validatorSetVersion: 1n,
          allowedClientIds: ['validator-client-a'],
        },
        store,
        fence,
        inner: developmentRemoteSigner({ dataDir: join(dir, 'inner'), validatorId: 'val_dev_a' }).client,
        holderId: 'region-b',
      });
      const activated = a.activate();
      assert.equal(activated.ok, false);
    });
  });

  it('generates keys through the provider and never exports private material', () => {
    const keystore = new OperatorKeystore();
    const generated = keystore.generate('CONSENSUS_VOTING_KEY', 'ops', NOW);
    assert.equal(generated.ok, true);
    if (generated.ok) {
      assert.equal(generated.value.privateMaterialExported, false);
      assert.equal(generated.value.purpose, 'VALIDATOR_CONSENSUS_SIGNING');
      assert.equal(generated.value.suiteId, CANONICAL_VALIDATOR_SUITE_ID);
      assert.equal(keystore.exportPrivate(generated.value.keyId).ok, false);
      assert.equal(keystore.hasPrivate(generated.value.keyId), true);
      assertNoPrivateKeyMaterial(generated.value);
    }
  });

  it('runs join, rotate, exit, replace, and jail workflows', () => {
    const keystore = new OperatorKeystore();
    const incoming = generateJoinRecord(keystore, 'E', NOW);
    assert.equal(incoming.ok, true);
    if (!incoming.ok) {
      return;
    }
    const registry = { set: fourValidatorDevelopmentSet(), epoch: developmentEpoch(0n, 0n, 8n), queued: [] };
    const joined = joinWorkflow(registry, incoming.value, NOW);
    assert.equal(joined.ok, true);
    if (!joined.ok) {
      return;
    }
    assert.equal(joined.value.receipt.status, 'ACTIVE');
    const next = keystore.generate('CONSENSUS_VOTING_KEY', 'future', NOW);
    assert.equal(next.ok, true);
    if (!next.ok) {
      return;
    }
    const descriptor = keystore.descriptor(next.value.keyId);
    assert.equal(descriptor.ok, true);
    if (!descriptor.ok) {
      return;
    }
    const rotated = rotateWorkflow(joined.value.registry, incoming.value.validatorId, descriptor.value, NOW);
    assert.equal(rotated.ok, true);
    if (rotated.ok) {
      assert.equal(rotated.value.receipt.steps.every((step) => step.status === 'DONE'), true);
    }
    const replacement = generateJoinRecord(keystore, 'F', NOW);
    assert.equal(replacement.ok, true);
    if (!replacement.ok) {
      return;
    }
    const replaced = replaceWorkflow(joined.value.registry, 'val_dev_b', replacement.value, NOW);
    assert.equal(replaced.ok, true);
    const exited = exitWorkflow(joined.value.registry, 'val_dev_a', NOW);
    assert.equal(exited.ok, true);
    if (exited.ok) {
      assert.equal(exited.value.receipt.status, 'EXITED');
    }
    const jailed = jailRecord(fourValidatorDevelopmentSet().validators[0]!, 9n, 1n, NOW);
    assert.equal(jailed.ok, true);
    if (jailed.ok) {
      const status = jailStatus(jailed.value, 'ev_final_1', 1n);
      assert.equal(status.ok, true);
      if (status.ok) {
        assert.equal(status.value.recoveryEligible, true);
      }
    }
    assert.equal(failedCode(eraseEvidence()), 'EVIDENCE_IMMUTABLE');
  });

  it('verifies snapshots and rejects tamper or wrong-network restores', () => {
    const created = createSnapshot({
      networkId: 'net_sunrey_local_dev',
      chainId: 'chn_sunrey_local_dev',
      height: 10n,
      blockId: 'block-10',
      stateRoot: '11'.repeat(32),
      protocolVersion: '1',
      validatorSetHash: '22'.repeat(32),
      validatorSetVersion: 1n,
      payload: '{"state":"ok"}',
      createdAtUtc: NOW,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const trust = {
      networkId: 'net_sunrey_local_dev',
      chainId: 'chn_sunrey_local_dev',
      protocolVersion: '1',
      trustedFinalizedHeight: 10n,
      trustedStateRoot: '11'.repeat(32),
    };
    assert.equal(verifyChainSnapshot(created.value, trust).ok, true);
    const tampered = { ...created.value, payload: '{"state":"evil"}' };
    assert.equal(verifyChainSnapshot(tampered, trust).ok, false);
    const wrongNet = verifyChainSnapshot(created.value, { ...trust, networkId: 'net_other' });
    assert.equal(wrongNet.ok, false);
    if (!wrongNet.ok) {
      assert.equal(wrongNet.error.code, 'WRONG_NETWORK_SNAPSHOT');
    }
    withDir((dir) => {
      const restored = restoreSnapshot(created.value, trust, dir);
      assert.equal(restored.ok, true);
    });
    assert.equal(failedCode(refuseUnverifiedProvider()), 'SNAPSHOT_TAMPER');
    const genesis = planGenesisSync(10n);
    assert.equal(genesis.ok, true);
    const snapSync = planSnapshotSync(created.value, trust, 12n);
    assert.equal(snapSync.ok, true);
  });

  it('reports upgrade precheck and old-protocol binary incompatibility', () => {
    const fixture = developmentUpgradeFixture(20);
    authorizeDevelopmentUpgrade(fixture.manager, fixture.plan);
    const ready = upgradePrecheck({
      manager: fixture.manager,
      node: fixture.compatible,
      diskFreeBytes: 8_000,
      diskRequiredBytes: 1_000,
      snapshotAvailable: true,
      signerSuiteIds: fixture.compatible.suiteIds,
    });
    assert.equal(ready.binaryCompatible, true);
    assert.equal(ready.pendingUpgrade, 'upg_ops_v2');
    const incompatible = reportIncompatibleBinary(fixture.plan);
    assert.equal(incompatible.ok, false);
    if (!incompatible.ok) {
      assert.equal(incompatible.error.code, 'INCOMPATIBLE_BINARY');
    }
  });

  it('runs a seven-validator rolling upgrade without auto-activation', () => {
    const result = runRollingUpgrade();
    assert.equal(result.newBinaryDidNotAutoActivate, true);
    assert.equal(result.beforeActivation.every((commit) => commit.protocolVersion === 1), true);
    assert.equal(result.atActivation?.protocolVersion, 2);
    assert.equal(result.quorumHeld, true);
    assert.equal(result.safety, true);
    assert.equal(result.afterLagCatchup, true);
  });

  it('keeps BFT safety across sentry, restart, and offline-validator failures', () => {
    const topology = developmentSentryTopology();
    assert.equal(availableSentryCount(topology, new Set([topology.sentries[0]!.sentryId])), 1);
    assert.equal(availableSentryCount(topology, new Set(topology.sentries.map((row) => row.sentryId))), 0);
    const net = new SevenValidatorNetwork();
    net.produce(1n);
    net.nodes[0]!.online = false;
    assert.equal(net.produce(2n) !== null, true);
    net.nodes[1]!.online = false;
    assert.equal(net.produce(3n) !== null, true);
    assert.equal(net.safetyHolds(), true);
    net.nodes[2]!.online = false;
    assert.equal(net.produce(4n), null);
    assert.equal(net.safetyHolds(), true);
    withDir((dir) => {
      const { store, server } = developmentRemoteSigner({ dataDir: dir, validatorId: 'val_dev_a' });
      const client = {
        clientId: 'validator-client-a',
        role: 'VALIDATOR' as const,
        certificateFingerprint: 'a'.repeat(64),
      };
      assert.equal(server.sign(request('val_dev_a'), client, NOW).ok, true);
      const state = store.safety.load();
      assert.ok(state);
      const restarted = safeRestart(
        { walHeight: 3n, finalizedHeight: 2n, safety: state },
        { walHeight: 3n, finalizedHeight: 2n, safety: state },
      );
      assert.equal(restarted.ok, true);
    });
    const limits = recommendedLimits();
    const pressure = warnDiskPressure(
      { chainDbBytes: 90, walBytes: 5, snapshotBytes: 4, logBytes: 1, capacityBytes: 100 },
      { ...limits, diskWarnRatio: 0.8, diskBytes: 100 },
    );
    assert.equal(pressure.ok, false);
    assert.equal(prune('consensus-wal', false).ok, false);
    assert.equal(evaluateDisk({ chainDbBytes: 1, walBytes: 1, snapshotBytes: 1, logBytes: 1, capacityBytes: 100 }, limits).warn, false);
  });

  it('enforces peer policy without changing voting power', () => {
    const policy = new OperatorPeerPolicy(developmentValidatorConfig({ dataDirectory: '/tmp/x' }).peerPolicy);
    assert.equal(policy.register({ peerId: 'sentry_a', kind: 'SENTRY', address: '10.0.0.11:26656', persistent: true }).ok, true);
    assert.equal(policy.connect('sentry_a').ok, true);
    assert.equal(failedCode(policy.applyVotingPowerChange()), 'PEER_CANNOT_CHANGE_VOTING_POWER');
  });

  it('emits structured logs and refuses private key material', () => {
    const record = structuredLog({
      level: 'info',
      event: 'consensus.round',
      height: 3n,
      round: 1n,
      step: 'PREVOTE',
      peerState: '2 sentries',
      consensusEvent: 'prevote',
      upgradeState: 'none',
      nowUtc: NOW,
    });
    assert.equal(record.height, '3');
    assert.throws(() => structuredLog({
      level: 'error',
      event: 'leak',
      signerError: 'seedHex=deadbeef',
      nowUtc: NOW,
    }));
  });

  it('produces readiness, supervision profiles, and incident procedures', () => {
    withDir((dir) => {
      const config = developmentValidatorConfig({ dataDirectory: dir });
      const { store, server } = developmentRemoteSigner({ dataDir: dir, validatorId: 'val_dev_a' });
      server.sign(request('val_dev_a'), {
        clientId: 'validator-client-a',
        role: 'VALIDATOR',
        certificateFingerprint: 'a'.repeat(64),
      }, NOW);
      const report = operatorReadiness({
        config,
        genesisHash: 'aa'.repeat(32),
        validatorSet: fourValidatorDevelopmentSet(),
        validatorId: 'val_dev_a',
        signerAvailable: true,
        safety: store,
        topology: developmentSentryTopology(),
        unavailableSentries: new Set(),
        stateSyncComplete: true,
        localFinalizedHeight: 10n,
        networkFinalizedHeight: 10n,
        diskOk: true,
        protocolCompatible: true,
        pendingUpgrade: null,
        nowUtc: NOW,
      });
      assert.equal(report.ready, true);
      const unit = systemdUnit('validator', '/usr/bin/sunrey-node', config.resourceLimits);
      assert.match(unit, /Restart=on-failure/);
      const manifest = kubernetesManifest(config);
      assert.equal((manifest.spec as { replicas: number }).replicas, 1);
      assert.ok(gracefulShutdownPreserves(config).some((path) => path.includes('signer-safety')));
      assert.equal(incidentProcedure('DOUBLE_SIGN_SUSPECTED').preserveEvidence, true);
      const maintenance = new MaintenanceMode();
      maintenance.enable();
      assert.equal(maintenance.assertWritable('sign').ok, false);
    });
  });

  it('exposes the operator CLI without private keys', () => {
    withDir((dir) => {
      for (const args of [
        ['validator', 'status'],
        ['validator', 'peers'],
        ['validator', 'keys'],
        ['validator', 'join'],
        ['validator', 'exit'],
        ['validator', 'rotate'],
        ['validator', 'evidence'],
        ['signer', 'status'],
        ['snapshot', 'create'],
        ['snapshot', 'verify'],
        ['snapshot', 'restore'],
        ['state-sync'],
        ['upgrade', 'precheck'],
      ] as const) {
        const result = runOpsCommand(args, dir);
        assertNoPrivateKeyMaterial(result);
        assert.equal(typeof result.command, 'string');
      }
      assert.match(opsUsage(), /sunrey-ops validator status/);
    });
  });

  it('does not create a competing ops package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/validator-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sentry')), false);
    assert.equal(existsSync(join(ROOT, 'packages/remote-signer')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/ops/index.ts')), true);
  });

  it('authenticates signer clients over established transports', () => {
    const policy = {
      networkId: 'net_sunrey_local_dev',
      chainId: 'chn_sunrey_local_dev',
      validatorId: 'val_dev_a',
      cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
      validatorSetVersion: 1n,
      allowedClientIds: ['validator-client-a'],
    };
    assert.equal(
      authenticateSignerClient(
        { clientId: 'stranger', role: 'VALIDATOR', certificateFingerprint: 'd'.repeat(64) },
        policy,
      ).ok,
      false,
    );
    assert.equal(validateSignRequest(request('val_dev_a', { cryptoSuiteId: 'unknown' }), policy).ok, false);
  });
});
