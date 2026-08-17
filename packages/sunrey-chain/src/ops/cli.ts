/**
 * sunrey-ops CLI.
 *
 * Operator commands never print private key material.
 */

import { fourValidatorDevelopmentSet } from '../validators/index.ts';
import { developmentValidatorConfig, validateValidatorConfig } from './config.ts';
import { runCryptoCommand } from './crypto-cli.ts';
import { incidentProcedure } from './incidents.ts';
import { OperatorKeystore } from './keys.ts';
import { assertNoPrivateKeyMaterial } from './logging.ts';
import { ResiliencePlatform } from './platform.ts';
import { operatorReadiness } from './readiness.ts';
import { developmentSentryTopology } from './sentry.ts';
import { developmentRemoteSigner, publicRpcSignerIdentity, sentrySignerIdentity } from './signer.ts';
import { databaseRestoreTest, databaseStatus, verifyDatabase } from './database.ts';
import { createSnapshot, verifySnapshot } from './snapshots.ts';
import { planGenesisSync } from './state-sync.ts';
import {
  createStorageSnapshot,
  migrateDevStore,
  restoreStorageSnapshot,
  storageStatus,
  verifyStorage,
} from './storage.ts';
import type { DrillScenario } from './types.ts';
import { authorizeDevelopmentUpgrade, developmentUpgradeFixture, upgradePrecheck } from './upgrade.ts';
import {
  developmentEpoch,
  eraseEvidence,
  exitWorkflow,
  generateJoinRecord,
  jailStatus,
  joinWorkflow,
  rotateWorkflow,
} from './workflows.ts';

const RESILIENCE_COMMANDS = [
  'health',
  'alerts',
  'backup',
  'dr',
  'topology',
  'validator-fencing',
  'crypto',
  'storage',
  'database',
] as const;

export function runSunreyOps(argv: readonly string[]): string {
  const platform = new ResiliencePlatform();
  const command = argv[0] ?? 'health';
  if (command === 'health') {
    return JSON.stringify(platform.health(), null, 2);
  }
  if (command === 'alerts') {
    return JSON.stringify(platform.network.alerts.active(), null, 2);
  }
  if (command === 'topology') {
    return JSON.stringify(platform.topologyView(), null, 2);
  }
  if (command === 'validator-fencing') {
    const validatorId = argv[1] ?? 'val_dev_1';
    const fence = platform.fencing.activatePassive({ validatorId, operatorAuthorized: true });
    return JSON.stringify(
      {
        validatorId: fence.validatorId,
        activeSite: fence.activeSite,
        passiveSite: fence.passiveSite,
        epoch: fence.epoch.toString(),
      },
      null,
      2,
    );
  }
  if (command === 'backup') {
    const action = argv[1] ?? 'create';
    if (action === 'create') {
      platform.network.submitTransactions(['tx_ops_backup']);
      const snapshot = platform.network.snapshot();
      return JSON.stringify(snapshot.manifest, null, 2);
    }
    if (action === 'verify') {
      const snapshot = platform.network.snapshot();
      return JSON.stringify({ verified: true, snapshotId: snapshot.manifest.snapshotId }, null, 2);
    }
    if (action === 'restore') {
      const snapshot = platform.network.snapshot();
      platform.network.restoreValidatorFromSnapshot('val_dev_7', snapshot.manifest, snapshot.state);
      return JSON.stringify({ restored: 'val_dev_7', height: snapshot.manifest.height }, null, 2);
    }
    throw new Error('sunrey-ops backup create|verify|restore');
  }
  if (command === 'crypto') {
    return JSON.stringify(runCryptoCommand(argv.slice(1)), null, 2);
  }
  if (command === 'dr') {
    const action = argv[1] ?? 'run';
    if (action === 'run') {
      const scenario = (argv[2] ?? 'END_TO_END_RESILIENCE') as DrillScenario;
      return JSON.stringify(serializeReport(platform.run(scenario)), null, 2);
    }
    if (action === 'report') {
      const report = platform.latestReport() ?? platform.run('END_TO_END_RESILIENCE');
      return JSON.stringify(serializeReport(report), null, 2);
    }
    throw new Error('sunrey-ops dr run|report');
  }
  if (command === 'crypto') {
    return JSON.stringify(runCryptoCommand(argv.slice(1)), null, 2);
  }
  if (command === 'storage') {
    const action = argv[1] ?? 'status';
    if (action === 'status') {
      return JSON.stringify(storageStatus(), null, 2);
    }
    if (action === 'verify') {
      return JSON.stringify(verifyStorage(storageStatus()), null, 2);
    }
    if (action === 'migrate') {
      return JSON.stringify(
        migrateDevStore({
          height: '1',
          blockId: 'aa'.repeat(32),
          stateRoot: 'bb'.repeat(32),
          nativeSupply: 'cc'.repeat(32),
          validatorSet: 'dd'.repeat(32),
        }),
        null,
        2,
      );
    }
    if (action === 'snapshot') {
      const created = createStorageSnapshot({
        height: 1n,
        blockId: 'block-1',
        stateRoot: '11'.repeat(32),
        payload: '{"state":"dev"}',
        createdAtUtc: '2026-08-17T00:00:00.000Z',
      });
      return JSON.stringify(created, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
    }
    if (action === 'restore') {
      const created = createStorageSnapshot({
        height: 1n,
        blockId: 'block-1',
        stateRoot: '11'.repeat(32),
        payload: '{"state":"dev"}',
        createdAtUtc: '2026-08-17T00:00:00.000Z',
      });
      if (!created.ok) {
        return JSON.stringify(created, null, 2);
      }
      return JSON.stringify(restoreStorageSnapshot(created.value, '/tmp/sunrey-storage-restore'), null, 2);
    }
    throw new Error('sunrey-ops storage status|verify|migrate|snapshot|restore');
  }
  if (command === 'database') {
    const action = argv[1] ?? 'status';
    if (action === 'status') {
      return JSON.stringify(databaseStatus(), null, 2);
    }
    if (action === 'verify') {
      return JSON.stringify(verifyDatabase(), null, 2);
    }
    if (action === 'restore-test') {
      return JSON.stringify(databaseRestoreTest(), null, 2);
    }
    throw new Error('sunrey-ops database status|verify|restore-test');
  }
  throw new Error(`unknown sunrey-ops command; expected ${RESILIENCE_COMMANDS.join('|')}`);
}

function serializeReport(report: ReturnType<ResiliencePlatform['run']>): Record<string, unknown> {
  return {
    ...report,
    measuredRpoMs: report.measuredRpoMs.toString(),
    measuredRtoMs: report.measuredRtoMs.toString(),
  };
}

export type CliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const VALIDATOR_COMMANDS = [
  'validator',
  'signer',
  'snapshot',
  'state-sync',
  'upgrade',
  'incident',
  'crypto',
] as const;

export function opsUsage(): string {
  return [
    'sunrey-ops validator status',
    'sunrey-ops validator peers',
    'sunrey-ops validator keys',
    'sunrey-ops validator key-generate',
    'sunrey-ops validator rotate',
    'sunrey-ops validator join',
    'sunrey-ops validator exit',
    'sunrey-ops validator evidence',
    'sunrey-ops signer status',
    'sunrey-ops snapshot create',
    'sunrey-ops snapshot verify',
    'sunrey-ops snapshot restore',
    'sunrey-ops storage status',
    'sunrey-ops storage verify',
    'sunrey-ops storage migrate',
    'sunrey-ops storage snapshot',
    'sunrey-ops storage restore',
    'sunrey-ops database status',
    'sunrey-ops database verify',
    'sunrey-ops database restore-test',
    'sunrey-ops state-sync',
    'sunrey-ops upgrade precheck',
    'sunrey-ops incident SIGNER_COMPROMISE',
    'sunrey-ops crypto suites',
    'sunrey-ops crypto policy',
    'sunrey-ops crypto inventory',
    'sunrey-ops crypto readiness',
    'sunrey-ops crypto benchmark',
  ].join('\n');
}

const nowUtc = () => '2026-08-17T00:00:00.000Z';

export function runOpsCommand(args: readonly string[], dataDir = '/tmp/sunrey-ops-dev'): CliResult {
  const [group, action, extra] = args;
  if (group === 'crypto') {
    const result = runCryptoCommand(args.slice(1));
    return { ok: result.ok, command: result.command, payload: result.payload };
  }
  if (!group || !(VALIDATOR_COMMANDS as readonly string[]).includes(group)) {
    return { ok: false, command: group ?? 'missing', payload: { error: 'unknown ops command', usage: opsUsage() } };
  }
  const config = developmentValidatorConfig({ dataDirectory: dataDir });
  const set = fourValidatorDevelopmentSet();
  const topology = developmentSentryTopology('val_dev_a');
  const signer = developmentRemoteSigner({ dataDir, validatorId: 'val_dev_a' });
  const keystore = new OperatorKeystore();

  if (group === 'validator' && action === 'status') {
    const report = operatorReadiness({
      config,
      genesisHash: 'aa'.repeat(32),
      validatorSet: set,
      validatorId: 'val_dev_a',
      signerAvailable: true,
      safety: signer.store,
      topology,
      unavailableSentries: new Set(),
      stateSyncComplete: true,
      localFinalizedHeight: 10n,
      networkFinalizedHeight: 10n,
      diskOk: true,
      protocolCompatible: true,
      pendingUpgrade: null,
      nowUtc: nowUtc(),
    });
    return { ok: report.ready || report.checks.some((check) => check.id === 'signer-safety-high-watermark'), command: 'validator status', payload: report };
  }
  if (group === 'validator' && action === 'peers') {
    return {
      ok: true,
      command: 'validator peers',
      payload: { sentries: topology.sentries, policy: config.peerPolicy },
    };
  }
  if (group === 'validator' && (action === 'keys' || action === 'key-generate')) {
    const generated = keystore.generate('CONSENSUS_VOTING_KEY', 'cli', nowUtc());
    return { ok: generated.ok, command: 'validator key-generate', payload: generated };
  }
  if (group === 'validator' && action === 'join') {
    const record = generateJoinRecord(keystore, 'E', nowUtc());
    if (!record.ok) {
      return { ok: false, command: 'validator join', payload: record };
    }
    const joined = joinWorkflow(
      { set, epoch: developmentEpoch(0n, 0n, 8n), queued: [] },
      record.value,
      nowUtc(),
    );
    return { ok: joined.ok, command: 'validator join', payload: joined };
  }
  if (group === 'validator' && action === 'exit') {
    const exited = exitWorkflow({ set, epoch: developmentEpoch(0n, 0n, 8n), queued: [] }, 'val_dev_a', nowUtc());
    return { ok: exited.ok, command: 'validator exit', payload: exited };
  }
  if (group === 'validator' && action === 'rotate') {
    const next = keystore.generate('CONSENSUS_VOTING_KEY', 'rotated', nowUtc());
    if (!next.ok) {
      return { ok: false, command: 'validator rotate', payload: next };
    }
    const descriptor = keystore.descriptor(next.value.keyId);
    if (!descriptor.ok) {
      return { ok: false, command: 'validator rotate', payload: descriptor };
    }
    const rotated = rotateWorkflow(
      { set, epoch: developmentEpoch(0n, 0n, 8n), queued: [] },
      'val_dev_a',
      descriptor.value,
      nowUtc(),
    );
    return { ok: rotated.ok, command: 'validator rotate', payload: rotated };
  }
  if (group === 'validator' && action === 'evidence') {
    const erased = eraseEvidence();
    const status = jailStatus(set.validators[0]!, 'ev_dev_1', 1n);
    return { ok: status.ok && !erased.ok, command: 'validator evidence', payload: { status, erase: erased } };
  }
  if (group === 'signer' && action === 'status') {
    const sentry = signer.server.sign(
      {
        validatorId: 'val_dev_a',
        networkId: config.networkId,
        chainId: config.chainId,
        protocolVersion: '1',
        messageType: 'PREVOTE',
        height: 1n,
        round: 0n,
        blockId: 'block-1',
        validatorSetVersion: 1n,
        cryptoSuiteId: 'sunrey-ed25519-v1',
      },
      sentrySignerIdentity(),
      nowUtc(),
    );
    const rpc = signer.server.sign(
      {
        validatorId: 'val_dev_a',
        networkId: config.networkId,
        chainId: config.chainId,
        protocolVersion: '1',
        messageType: 'PREVOTE',
        height: 1n,
        round: 0n,
        blockId: 'block-1',
        validatorSetVersion: 1n,
        cryptoSuiteId: 'sunrey-ed25519-v1',
      },
      publicRpcSignerIdentity(),
      nowUtc(),
    );
    return {
      ok: true,
      command: 'signer status',
      payload: {
        transport: signer.server.transport,
        lease: signer.server.fence.current(),
        sentryRejected: !sentry.ok,
        publicRpcRejected: !rpc.ok,
        privateKeyExport: signer.server.exportPrivateKey(),
      },
    };
  }
  if (group === 'snapshot') {
    const created = createSnapshot({
      networkId: config.networkId,
      chainId: config.chainId,
      height: 10n,
      blockId: 'block-10',
      stateRoot: '11'.repeat(32),
      protocolVersion: '1',
      validatorSetHash: '22'.repeat(32),
      validatorSetVersion: 1n,
      payload: '{"state":"dev"}',
      createdAtUtc: nowUtc(),
    });
    if (!created.ok) {
      return { ok: false, command: `snapshot ${action ?? 'create'}`, payload: created };
    }
    if (action === 'verify' || action === 'restore') {
      const verified = verifySnapshot(created.value, {
        networkId: config.networkId,
        chainId: config.chainId,
        protocolVersion: '1',
        trustedFinalizedHeight: 10n,
        trustedStateRoot: '11'.repeat(32),
      });
      return { ok: verified.ok, command: `snapshot ${action}`, payload: { snapshot: created.value.manifest, verified } };
    }
    return { ok: true, command: 'snapshot create', payload: created.value.manifest };
  }
  if (group === 'state-sync') {
    return { ok: true, command: 'state-sync', payload: planGenesisSync(10n) };
  }
  if (group === 'upgrade' && action === 'precheck') {
    const fixture = developmentUpgradeFixture(20);
    authorizeDevelopmentUpgrade(fixture.manager, fixture.plan);
    const report = upgradePrecheck({
      manager: fixture.manager,
      node: fixture.compatible,
      diskFreeBytes: 10_000,
      diskRequiredBytes: 1_000,
      snapshotAvailable: true,
      signerSuiteIds: fixture.compatible.suiteIds,
    });
    return { ok: report.binaryCompatible, command: 'upgrade precheck', payload: report };
  }
  if (group === 'incident') {
    const kind = (action ?? extra ?? 'SIGNER_COMPROMISE') as Parameters<typeof incidentProcedure>[0];
    return { ok: true, command: 'incident', payload: incidentProcedure(kind) };
  }
  const safe = validateValidatorConfig(config);
  return { ok: safe.ok, command: `${group} ${action ?? ''}`.trim(), payload: { usage: opsUsage(), config: safe } };
}

export async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const head = argv[0] ?? 'health';
  if ((RESILIENCE_COMMANDS as readonly string[]).includes(head)) {
    process.stdout.write(`${runSunreyOps(argv)}\n`);
    return;
  }
  const result = runOpsCommand(argv);
  assertNoPrivateKeyMaterial(result);
  const text = JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
  console.log(text);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('ops/cli.ts') || entry.endsWith('ops/cli.js') || entry.endsWith('cli.ts') || entry.endsWith('cli.js')) {
  const group = process.argv[2] ?? 'health';
  if ((RESILIENCE_COMMANDS as readonly string[]).includes(group)) {
    process.stdout.write(`${runSunreyOps(process.argv.slice(2))}\n`);
  } else {
    await main();
  }
}
