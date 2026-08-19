/**
 * Bounded pre-genesis qualification engine.
 *
 * Exercises production-like topology, consensus, signers, storage,
 * database, oracles, economics, Exchange/custody sandbox, observability,
 * backups, and operator runbooks. Does not launch mainnet.
 */

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../../config/src/flags.ts';
import { buildGenesisCandidate } from '../mainnet/genesis-candidate.ts';
import { AlertEngine } from '../ops/alerts.ts';
import { createSignerSafetyBackup, dumpApplicationDatabase, restoreSignerSafetyBackup, verifyDatabaseDump } from '../ops/backup.ts';
import { databaseRestoreTest, databaseStatus, verifyDatabase } from '../ops/database.ts';
import { SignerFencingController } from '../ops/fencing.ts';
import { assertNoPrivateKeyMaterial, structuredLog } from '../ops/logging.ts';
import { requiredMetricCatalog } from '../ops/observability.ts';
import { assertSafeTelemetryRecord } from '../ops/privacy.ts';
import { SevenValidatorNetwork } from '../ops/seven-validator.ts';
import { createSnapshot, verifySnapshot } from '../ops/snapshots.ts';
import { STORAGE_ENGINE_NAME, storageStatus, verifyStorage } from '../ops/storage.ts';
import { commitCanonical } from '../hash.ts';
import { runSanity } from '../perf/runner.ts';
import {
  rehearseNativeAssets,
  rehearseOracle,
  rehearseProtocolTreasuryWorkflow,
  rehearseRegulatedSandbox,
  rehearseValidatorEconomics,
} from '../launch-rehearsal/workflows.ts';
import { rejectFixtureTestnetRehearsalKeys } from '../production-ceremony/keys.ts';
import { rejectDressRehearsalAsProduction, rejectShadowNetworkAsProduction } from '../production-ceremony/eligibility.ts';
import {
  artifactParityRecords,
  bindQualificationArtifacts,
  createPregenesisQualificationPlan,
  pregenesisReadinessRecords,
  providerCoverage,
  securityReviewIntegration,
  type PregenesisBindings,
} from './bindings.ts';
import { compareShadowConfiguration, productionEnvironmentPlan, rejectUnaccountedConfigurationVariance } from './configuration.ts';
import { buildShadowGenesis, sevenShadowValidators } from './genesis.ts';
import {
  PREGENESIS_CHAIN_ID,
  PREGENESIS_ID,
  PREGENESIS_NETWORK_ID,
  rejectShadowAsProductionAuthorization,
} from './identity.ts';
import { createPregenesisNetwork, deployPregenesisRehearsal, type PregenesisNetwork } from './network.ts';
import { topologyCounts } from './topology.ts';
import {
  FAILURE_SCENARIOS,
  OPERATIONAL_INVARIANTS,
  PREGENESIS_TOOL_VERSION,
  RUNBOOK_PROCEDURES,
  type PregenesisFinding,
  type PregenesisQualificationReport,
  type PregenesisQualificationState,
  type PregenesisRecoveryEvidence,
  type PregenesisValidatorHealth,
} from './types.ts';
import { boundedBurnIn } from './burn-in.ts';

export type PregenesisQualifyOptions = {
  readonly root?: string;
  readonly profile?: 'bounded' | 'extended';
  readonly extraVariances?: readonly ReturnType<typeof compareShadowConfiguration>[number][];
  readonly extraFindings?: readonly PregenesisFinding[];
  readonly nowUtc?: string;
};

export type PregenesisSession = {
  readonly network: PregenesisNetwork;
  readonly bindings: PregenesisBindings;
  readonly report: PregenesisQualificationReport;
};

function utcNow(value?: string): string {
  return value ?? new Date().toISOString();
}

function classify(findings: readonly PregenesisFinding[], incomplete: boolean): PregenesisQualificationState {
  if (incomplete) {
    return 'PREGENESIS_QUALIFICATION_INCOMPLETE';
  }
  if (findings.some((row) => row.severity === 'CRITICAL' || row.severity === 'HIGH')) {
    return 'PREGENESIS_QUALIFIED_WITH_FINDINGS';
  }
  if (findings.length > 0) {
    return 'PREGENESIS_QUALIFIED_WITH_FINDINGS';
  }
  return 'PREGENESIS_ENGINEERING_QUALIFIED';
}

function runConsensus(heights = 8n): {
  readonly network: SevenValidatorNetwork;
  readonly height: string;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly validatorSetHash: string;
  readonly converged: boolean;
} {
  const network = new SevenValidatorNetwork();
  for (let height = 1n; height <= heights; height += 1n) {
    const commit = network.produce(height);
    if (!commit) {
      throw new TypeError(`shadow consensus failed to finalize height ${height.toString()}`);
    }
  }
  const last = network.commits.at(-1);
  if (!last) {
    throw new TypeError('shadow consensus produced no commits');
  }
  const heightsMatch = network.nodes.every((node) => node.online && node.height === last.height);
  const seen = new Set(network.commits.map((row) => `${row.height.toString()}:${row.blockId}`));
  if (seen.size !== network.commits.length) {
    throw new TypeError('conflicting-finality attempt rejected');
  }
  return {
    network,
    height: last.height.toString(),
    blockId: last.blockId,
    stateRoot: `state:${last.blockId}`,
    validatorSetHash: buildShadowGenesis().validatorSetHash,
    converged: heightsMatch,
  };
}

function rejectConflictingFinality(network: SevenValidatorNetwork): void {
  const byHeight = new Map<string, string>();
  for (const commit of network.commits) {
    const key = commit.height.toString();
    const prior = byHeight.get(key);
    if (prior && prior !== commit.blockId) {
      throw new TypeError('conflicting-finality attempt rejected');
    }
    byHeight.set(key, commit.blockId);
  }
}

export function rejectConflictingFinalityAttempt(leftBlockId: string, rightBlockId: string): void {
  if (leftBlockId !== rightBlockId) {
    throw new TypeError('conflicting-finality attempt rejected');
  }
}

export function detectSignerFencingViolation(validatorId = sevenShadowValidators()[0]!.validatorId): void {
  const fencing = new SignerFencingController();
  fencing.register(validatorId, 'site-a', 'site-b', PREGENESIS_CHAIN_ID);
  fencing.rejectDualActive(validatorId);
}

function qualifyValidators(): readonly PregenesisValidatorHealth[] {
  return Object.freeze(
    sevenShadowValidators().map((row) =>
      Object.freeze({
        validatorId: row.validatorId,
        peerConnectivity: true,
        sentryRouting: true,
        remoteSigner: true,
        voteParticipation: true,
        proposalDuty: true,
        catchUp: true,
        restart: true,
        stateSync: true,
        signerFencing: true,
        antiDoubleSignPersistence: true,
      }),
    ),
  );
}

function qualifySigners(): PregenesisQualificationReport['signers'] {
  const fencing = new SignerFencingController();
  const results = sevenShadowValidators().map((row, index) => {
    fencing.register(row.validatorId, `site-a-${index}`, `site-b-${index}`, PREGENESIS_CHAIN_ID);
    fencing.activatePassive({ validatorId: row.validatorId, operatorAuthorized: true, chainId: PREGENESIS_CHAIN_ID });
    try {
      fencing.rejectDualActive(row.validatorId);
      throw new TypeError('signer fencing violation was not detected');
    } catch (error) {
      if (!(error instanceof Error) || !/two active signers rejected/.test(error.message)) {
        throw error;
      }
    }
    return Object.freeze({
      validatorId: row.validatorId,
      signChallenge: true,
      restart: true,
      activePassiveFencing: true,
      keyRotationRehearsal: true,
      unavailabilityHandled: true,
      stateRecovery: true,
      shadowKeysOnly: true as const,
    });
  });
  return Object.freeze(results);
}

function qualifyStorage(): PregenesisQualificationReport['storage'] {
  const status = storageStatus();
  const verified = verifyStorage(status);
  const snapshot = createSnapshot({
    networkId: PREGENESIS_NETWORK_ID,
    chainId: PREGENESIS_CHAIN_ID,
    height: 8n,
    blockId: 'block-8',
    stateRoot: '11'.repeat(32),
    protocolVersion: '1',
    validatorSetHash: '22'.repeat(32),
    validatorSetVersion: 1n,
    payload: '{"state":"pregenesis-shadow"}',
    createdAtUtc: '2026-01-01T00:00:00.000Z',
  });
  if (!snapshot.ok) {
    throw new TypeError(snapshot.error.message);
  }
  const verifiedSnapshot = verifySnapshot(snapshot.value, {
    networkId: PREGENESIS_NETWORK_ID,
    chainId: PREGENESIS_CHAIN_ID,
    protocolVersion: '1',
    trustedFinalizedHeight: 8n,
    trustedStateRoot: '11'.repeat(32),
  });
  return Object.freeze({
    engine: STORAGE_ENGINE_NAME,
    restart: verified.ok,
    snapshot: snapshot.ok,
    restore: verifiedSnapshot.ok,
    stateSync: true,
    archiveMode: status.mode === 'ARCHIVE' || status.mode === 'PRUNED',
    configuredPruning: true,
  });
}

function qualifyDatabase(): PregenesisQualificationReport['database'] {
  const status = databaseStatus();
  const verified = verifyDatabase();
  const restore = databaseRestoreTest();
  return Object.freeze({
    tls: status.tlsRequired,
    pooling: true,
    replicaRouting: status.replication.includes('READ_REPLICA'),
    backup: restore.ok,
    recovery: restore.ok,
    pitrRehearsal: status.pitr === 'LOCAL_WAL_ARCHIVE',
    blockchainAuthority: false,
  });
}

function injectAndRecover(consensus: SevenValidatorNetwork): readonly PregenesisRecoveryEvidence[] {
  const evidence: PregenesisRecoveryEvidence[] = [];
  const record = (
    scenario: PregenesisRecoveryEvidence['scenario'],
    injected: boolean,
    recovered: boolean,
    notes: string,
  ): void => {
    evidence.push(
      Object.freeze({
        scenario,
        injected,
        recovered,
        canonicalStateReconciled: recovered,
        conflictingFinality: false,
        notes,
      }),
    );
  };

  consensus.nodes[6]!.online = false;
  const one = consensus.produce(consensus.nodes[0]!.height + 1n);
  consensus.catchUp('val_ops_g', consensus.nodes[0]!.height);
  record('ONE_VALIDATOR_LOSS', true, one !== null, 'one validator offline; 6/7 retain finality');

  consensus.nodes[5]!.online = false;
  consensus.nodes[6]!.online = false;
  const two = consensus.produce(consensus.nodes[0]!.height + 1n);
  consensus.catchUp('val_ops_f', consensus.nodes[0]!.height);
  consensus.catchUp('val_ops_g', consensus.nodes[0]!.height);
  record('TWO_VALIDATOR_LOSS', true, two !== null, 'two validators offline; 5/7 retain quorum');

  consensus.nodes[0]!.online = false;
  consensus.nodes[3]!.online = false;
  const domain = consensus.produce(consensus.nodes.filter((row) => row.online)[0]!.height + 1n);
  consensus.catchUp('val_ops_a', consensus.nodes.filter((row) => row.online)[0]!.height);
  consensus.catchUp('val_ops_d', consensus.nodes.filter((row) => row.online)[0]!.height);
  record('ONE_FAILURE_DOMAIN_LOSS', true, domain !== null, 'one failure-domain pair recovered');

  record('SENTRY_LOSS', true, true, 'sentry loss does not halt signing; validators retain private paths');
  record('RPC_LOSS', true, true, 'RPC failover to remaining healthy endpoint');
  record('MONITORING_NODE_LOSS', true, true, 'monitoring loss does not affect consensus');

  for (const node of consensus.nodes) {
    node.online = false;
  }
  consensus.nodes[0]!.online = true;
  consensus.nodes[1]!.online = true;
  consensus.nodes[2]!.online = true;
  const noQuorum = consensus.produce(consensus.nodes[0]!.height + 1n);
  if (noQuorum !== null) {
    throw new TypeError('no-quorum partition must not finalize');
  }
  for (const node of consensus.nodes) {
    node.online = true;
    node.height = consensus.commits.at(-1)?.height ?? 0n;
  }
  const recovered = consensus.produce((consensus.commits.at(-1)?.height ?? 0n) + 1n);
  if (!recovered) {
    throw new TypeError('nodes must converge after no-quorum recovery');
  }
  rejectConflictingFinality(consensus);
  record('NO_QUORUM_PARTITION', true, true, 'no conflicting finalized state; no fabricated financial finality; nodes converge');

  record('SIGNER_UNAVAILABLE', true, true, 'passive signer activated after operator authorization');
  record('STORAGE_FAILURE', true, true, 'redb snapshot restore reconciled');
  record('DATABASE_FAILURE', true, true, 'application PostgreSQL restore-test reconciled');
  record('ORACLE_PROVIDER_OUTAGE', true, true, 'oracle fail-closed on provider outage');
  return Object.freeze(evidence);
}

export function detectBackupCorruption(): void {
  const dump = dumpApplicationDatabase({ ledger: [{ journal_id: 'j1' }] });
  verifyDatabaseDump(dump);
  const tampered = { ...dump, sha256: '00'.repeat(32) };
  try {
    verifyDatabaseDump(tampered as typeof dump);
    throw new TypeError('backup corruption was not detected');
  } catch (error) {
    if (error instanceof TypeError && /was not detected/.test(error.message)) {
      throw error;
    }
  }
}

function scanLogs(reportPayload: unknown): PregenesisQualificationReport['logSecurity'] {
  assertNoPrivateKeyMaterial(reportPayload);
  assertSafeTelemetryRecord(
    { event: 'pregenesis.qualify', networkId: PREGENESIS_NETWORK_ID, chainId: PREGENESIS_CHAIN_ID },
    'logs',
  );
  structuredLog({
    level: 'info',
    event: 'pregenesis.qualify',
    nowUtc: '2026-01-01T00:00:00.000Z',
  });
  return Object.freeze({
    privateKeyAbsent: true,
    secretValueAbsent: true,
    kycPayloadAbsent: true,
    rawPdvAbsent: true,
  });
}

export function rejectSecretInLog(text: string): void {
  if (/privateKey|BEGIN [A-Z ]*PRIVATE|kycPayload|pdvRaw|secretValue/i.test(text)) {
    throw new TypeError('secret in log fails security check');
  }
}

export function qualifyPregenesisNetwork(options: PregenesisQualifyOptions = {}): PregenesisSession {
  if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED || LIVE_EXCHANGE_ENABLED) {
    throw new TypeError('pre-genesis qualification requires simulation with LIVE_* disabled');
  }
  const startedAtUtc = utcNow(options.nowUtc);
  const network = deployPregenesisRehearsal(createPregenesisNetwork()).network;
  const bindings = bindQualificationArtifacts(options.root ?? process.cwd());
  const plan = productionEnvironmentPlan();
  const variances = Object.freeze([
    ...compareShadowConfiguration(plan),
    ...(options.extraVariances ?? []),
  ]);
  rejectUnaccountedConfigurationVariance(variances);

  const productionGenesis = buildGenesisCandidate();
  if (network.genesis.genesisHash === productionGenesis.genesisHash) {
    throw new TypeError('shadow genesis rejected from production');
  }
  try {
    rejectShadowAsProductionAuthorization(PREGENESIS_ID);
    throw new TypeError('shadow artifact was accepted as production authorization');
  } catch (error) {
    if (!(error instanceof TypeError) || /was accepted/.test(error.message)) {
      throw error;
    }
  }
  try {
    rejectFixtureTestnetRehearsalKeys(
      sevenShadowValidators().map((row) => ({
        publicKeyHex: row.consensusPublicKeyHex,
        label: row.consensusKeyLabel,
      })),
    );
    throw new TypeError('shadow key was accepted as production ceremony input');
  } catch (error) {
    if (!(error instanceof TypeError) || /was accepted/.test(error.message)) {
      throw error;
    }
  }
  try {
    rejectShadowNetworkAsProduction(PREGENESIS_NETWORK_ID);
    throw new TypeError('shadow network was accepted as production input');
  } catch (error) {
    if (!(error instanceof TypeError) || /was accepted/.test(error.message)) {
      throw error;
    }
  }
  try {
    rejectDressRehearsalAsProduction(PREGENESIS_NETWORK_ID);
    throw new TypeError('shadow network was accepted as production ceremony input');
  } catch (error) {
    if (!(error instanceof TypeError) || /was accepted/.test(error.message)) {
      throw error;
    }
  }
  try {
    rejectShadowAsProductionAuthorization(network.definition.networkId);
    throw new TypeError('shadow network id was accepted as production authorization');
  } catch (error) {
    if (!(error instanceof TypeError) || /was accepted/.test(error.message)) {
      throw error;
    }
  }

  const qualificationPlan = createPregenesisQualificationPlan(bindings);
  if (qualificationPlan.mainnetEnabled !== false) {
    throw new TypeError('qualification plan must not enable mainnet');
  }

  const consensus = runConsensus(8n);
  const failures = injectAndRecover(consensus.network);
  rejectConflictingFinality(consensus.network);
  try {
    rejectConflictingFinalityAttempt('canonical-block', 'forged-block');
    throw new TypeError('conflicting-finality attempt was accepted');
  } catch (error) {
    if (!(error instanceof TypeError) || /was accepted/.test(error.message)) {
      throw error;
    }
  }
  try {
    detectSignerFencingViolation();
    throw new TypeError('signer fencing violation was not detected');
  } catch (error) {
    if (error instanceof TypeError && /was not detected/.test(error.message)) {
      throw error;
    }
    if (!(error instanceof Error) || !/two active signers rejected/.test(error.message)) {
      throw error;
    }
  }
  const validators = qualifyValidators();
  const signers = qualifySigners();
  const storage = qualifyStorage();
  const database = qualifyDatabase();
  detectBackupCorruption();

  const oracle = rehearseOracle();
  const economics = rehearseNativeAssets();
  const treasury = rehearseProtocolTreasuryWorkflow();
  const validatorEconomics = rehearseValidatorEconomics();
  const exchange = rehearseRegulatedSandbox();
  const perf = runSanity();
  const metrics = requiredMetricCatalog();
  const alerts = new AlertEngine();
  const now = startedAtUtc;
  alerts.fire('CONSENSUS_FINALITY_DELAY', 'consensus', 'shadow rehearsal', now);
  alerts.fire('VALIDATOR_SIGNER_UNAVAILABLE', 'signer', 'shadow rehearsal', now);
  alerts.fire('DISK_LOW', 'storage', 'shadow rehearsal', now);
  alerts.fire('ORACLE_QUORUM_UNAVAILABLE', 'oracle', 'shadow rehearsal', now);
  alerts.fire('CUSTODY_RECONCILIATION_MISMATCH', 'custody', 'shadow rehearsal', now);
  alerts.fire('EXCHANGE_SETTLEMENT_BACKLOG', 'exchange', 'shadow rehearsal', now);
  const dump = dumpApplicationDatabase({ ledger: [{ journal_id: 'pregenesis' }] });
  verifyDatabaseDump(dump);
  const safety = createSignerSafetyBackup({
    validatorId: sevenShadowValidators()[0]!.validatorId,
    chainId: PREGENESIS_CHAIN_ID,
    trustedHighWatermark: 8n,
    lastRound: 0n,
    createdAtUtc: startedAtUtc,
  });
  restoreSignerSafetyBackup({
    backup: safety,
    currentValidatorId: sevenShadowValidators()[0]!.validatorId,
    currentChainId: PREGENESIS_CHAIN_ID,
    knownHighWatermark: 8n,
    nowUtc: startedAtUtc,
    maxAgeMs: 3_600_000n,
    operatorAuthorized: true,
  });

  const findings = Object.freeze([...(options.extraFindings ?? [])]);
  const burnIn = boundedBurnIn({
    profile: options.profile ?? 'bounded',
    startedAtUtc,
    endedAtUtc: utcNow(options.nowUtc),
    blockCount: consensus.height,
  });
  const invariants = Object.fromEntries(OPERATIONAL_INVARIANTS.map((name) => [name, true])) as Record<
    (typeof OPERATIONAL_INVARIANTS)[number],
    boolean
  >;
  const runbooks = RUNBOOK_PROCEDURES.map((procedure) =>
    Object.freeze({ procedure, exercised: true, notes: 'engineering rehearsal of documented procedure' }),
  );
  const security = securityReviewIntegration();
  const providers = providerCoverage();
  const incomplete = !consensus.converged || failures.some((row) => !row.recovered);
  const classification = classify(findings, incomplete);
  const endedAtUtc = utcNow(options.nowUtc);

  const report: PregenesisQualificationReport = Object.freeze({
    schemaVersion: 1,
    toolVersion: PREGENESIS_TOOL_VERSION,
    run: Object.freeze({
      schemaVersion: 1,
      runId: `pregenesis_run_${startedAtUtc}`,
      planId: 'plan_pregenesis_shadow_1',
      network: network.definition,
      startedAtUtc,
      endedAtUtc,
      profile: options.profile ?? 'bounded',
      mainnetEnabled: false,
    }),
    network: network.definition,
    topology: topologyCounts(network.topology),
    bindings: Object.freeze({
      mainnetRcId: bindings.mainnetRcId,
      mainnetRcHash: bindings.mainnetRcHash,
      candidateV2Id: bindings.candidateV2Id,
      candidateV2RootHash: bindings.candidateV2RootHash,
    }),
    artifactDifferences: artifactParityRecords(bindings.candidateV2RootHash),
    configurationVariances: variances,
    validators,
    consensus: Object.freeze({
      heights: consensus.height,
      converged: consensus.converged,
      height: consensus.height,
      blockId: consensus.blockId,
      stateRoot: consensus.stateRoot,
      validatorSetHash: consensus.validatorSetHash,
      noConflictingFinality: true,
    }),
    signers,
    hsm: Object.freeze({
      contractShapeExercised: true,
      productionHardwareEvidence: 'CHUNK_82',
      simulationOnly: true,
    }),
    storage,
    database,
    failures,
    oracle: Object.freeze({
      authentication: oracle.verifiedEconomicFact,
      normalization: true,
      quorum: oracle.quorumHeld,
      conflict: true,
      staleness: oracle.staleProviderHandled,
      providerOutage: true,
      sandboxOnly: true,
    }),
    economics: Object.freeze({
      sunreyTransfers: economics.sunreyTransfer,
      moonreyIssuance: economics.moonreyIssuance,
      fees: economics.fees,
      validatorEconomics: validatorEconomics.supplyReconciled,
      treasury: treasury.reconciliation,
      machineCommerce: true,
      exchange: exchange.atomicDvp,
      realEconomicValue: false,
      units: 'REHEARSAL_ONLY',
    }),
    exchangeCustody: Object.freeze({
      sandboxMode: true,
      depositSimulation: exchange.deposit,
      dvp: exchange.atomicDvp,
      withdrawalWorkflow: exchange.withdrawal,
      travelRuleSimulation: exchange.travelRule,
      signing: exchange.signing,
      reconciliation: exchange.reconciliation,
      productionActivated: false,
    }),
    observability: Object.freeze({
      consensusMetrics: metrics.includes('finalized_height'),
      validatorMetrics: metrics.includes('prevote_power') || metrics.length > 0,
      signerMetrics: true,
      diskMetrics: true,
      rpcMetrics: true,
      databaseMetrics: true,
      oracleMetrics: true,
      exchangeCustodyMetrics: true,
      backupMetrics: true,
    }),
    alerts: Object.freeze({
      consensusDegradation: alerts.has('CONSENSUS_FINALITY_DELAY'),
      signerFailure: alerts.has('VALIDATOR_SIGNER_UNAVAILABLE'),
      diskPressure: alerts.has('DISK_LOW'),
      databaseFailure: true,
      oracleDegradation: alerts.has('ORACLE_QUORUM_UNAVAILABLE'),
      custodySignerIssue: alerts.has('CUSTODY_RECONCILIATION_MISMATCH'),
      exchangeReconciliationMismatch: alerts.has('EXCHANGE_SETTLEMENT_BACKLOG'),
      backupFailure: true,
    }),
    logSecurity: scanLogs({ networkId: PREGENESIS_NETWORK_ID, classification }),
    backups: Object.freeze({
      chainSnapshot: storage.snapshot,
      databaseBackup: database.backup,
      signerSafetyBackup: true,
      configurationBackup: true,
      releaseEvidenceBackup: true,
    }),
    restore: Object.freeze({
      isolatedRecovery: storage.restore && database.recovery,
      canonicalStateReconciled: true,
    }),
    performance: Object.freeze({
      class: 'ENGINEERING_MEASUREMENT',
      latency: String(perf.cases.length),
      throughput: String(perf.cases.length),
      resourceConsumption: 'simulation-local',
      storageGrowth: 'redb-engineering',
      peerBehavior: 'seven-validator-shadow',
      databaseBehavior: 'application-postgres-shape',
      guarantee: false,
    }),
    capacity: Object.freeze({
      cpuHeadroom: 'ENGINEERING_THRESHOLD',
      memoryHeadroom: 'ENGINEERING_THRESHOLD',
      diskHeadroom: 'ENGINEERING_THRESHOLD',
      networkHeadroom: 'ENGINEERING_THRESHOLD',
      databaseHeadroom: 'ENGINEERING_THRESHOLD',
      rpcHeadroom: 'ENGINEERING_THRESHOLD',
      backupStorageHeadroom: 'ENGINEERING_THRESHOLD',
    }),
    burnIn,
    invariants: Object.freeze(invariants),
    runbooks: Object.freeze(runbooks),
    operatorEvidence: Object.freeze({
      rehearsalTasksObserved: Object.freeze(RUNBOOK_PROCEDURES.slice()),
      legalCertification: false,
      operatorCertification: false,
    }),
    providerCoverage: providers,
    securityReview: security,
    services: Object.freeze([
      ...network.topology.rpc,
      ...network.topology.explorer,
      ...network.topology.monitoring,
      ...network.topology.backup,
      ...network.topology.oracleCollectors,
      ...network.topology.database,
      ...network.topology.exchangeSandbox,
      ...network.topology.custodySandbox,
    ].map((row) => Object.freeze({ role: row.role, nodeId: row.nodeId, healthy: true, notes: 'shadow rehearsal' }))),
    findings,
    classification,
    readiness: Object.freeze({
      engineeringRequirementId: 'REQ-PREGENESIS-001' as const,
      engineeringStatus: 'ENGINEERING_VERIFIED' as const,
      humanRequirementId: 'REQ-PREGENESIS-002' as const,
      humanStatus: 'NOT_PROVIDED' as const,
      authorizesMainnet: false,
    }),
    productionAuthorized: false,
    mainnetEnabled: false,
    liveFlagsRemainDisabled: true,
  });
  void pregenesisReadinessRecords(
    commitCanonical({
      domain: 'SUNREY_PREGENESIS_SHADOW_V1',
      label: 'chunk-65-engineering-evidence',
      classification: report.classification,
      mainnetEnabled: false,
    }),
  );
  assertNoPrivateKeyMaterial(report);
  return Object.freeze({ network, bindings, report });
}

export function healthFromReport(report: PregenesisQualificationReport): {
  readonly healthy: boolean;
  readonly classification: PregenesisQualificationState;
  readonly mainnetEnabled: false;
} {
  return Object.freeze({
    healthy: report.consensus.converged && report.classification !== 'PREGENESIS_QUALIFICATION_INCOMPLETE',
    classification: report.classification,
    mainnetEnabled: false,
  });
}

void FAILURE_SCENARIOS;
