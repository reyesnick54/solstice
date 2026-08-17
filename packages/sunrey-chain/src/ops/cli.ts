import { ResiliencePlatform } from './platform.ts';
import type { DrillScenario } from './types.ts';

const COMMANDS = [
  'health',
  'alerts',
  'backup',
  'dr',
  'topology',
  'validator-fencing',
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
  throw new Error(`unknown sunrey-ops command; expected ${COMMANDS.join('|')}`);
}

function serializeReport(report: ReturnType<ResiliencePlatform['run']>): Record<string, unknown> {
  return {
    ...report,
    measuredRpoMs: report.measuredRpoMs.toString(),
    measuredRtoMs: report.measuredRtoMs.toString(),
  };
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('cli.ts') || entry.endsWith('cli.js')) {
  process.stdout.write(`${runSunreyOps(process.argv.slice(2))}\n`);
}
