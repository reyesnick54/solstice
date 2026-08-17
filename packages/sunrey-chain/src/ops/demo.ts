import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fourValidatorDevelopmentSet } from '../validators/index.ts';
import { runOpsCommand, runSunreyOps } from './cli.ts';
import { developmentValidatorConfig } from './config.ts';
import { OperatorKeystore } from './keys.ts';
import { ResiliencePlatform } from './platform.ts';
import { runRollingUpgrade } from './seven-validator.ts';
import { developmentRemoteSigner } from './signer.ts';
import { developmentEpoch, exitWorkflow, generateJoinRecord, joinWorkflow } from './workflows.ts';

export function runOpsDemo(): Record<string, unknown> {
  const platform = new ResiliencePlatform();
  platform.validateObservabilityConfigs();
  const healthy = platform.health();
  const report = platform.run('END_TO_END_RESILIENCE');
  return {
    environment: 'simulation',
    health: healthy,
    report: {
      drillId: report.drillId,
      finalState: report.finalState,
      measuredRpoMs: report.measuredRpoMs.toString(),
      measuredRtoMs: report.measuredRtoMs.toString(),
      integrityChecks: report.integrityChecks,
      failures: report.failures,
    },
  };
}


export function runValidatorOpsDemo(): void {
  const dir = mkdtempSync(join(tmpdir(), 'sunrey-ops-demo-'));
  try {
    const config = developmentValidatorConfig({ dataDirectory: dir });
    const signer = developmentRemoteSigner({ dataDir: dir, validatorId: 'val_dev_a' });
    const keystore = new OperatorKeystore();
    const record = generateJoinRecord(keystore, 'E', '2026-08-17T00:00:00.000Z');
    if (!record.ok) {
      throw new Error(record.error.message);
    }
    const joined = joinWorkflow(
      { set: fourValidatorDevelopmentSet(), epoch: developmentEpoch(0n, 0n, 8n), queued: [] },
      record.value,
      '2026-08-17T00:00:00.000Z',
    );
    if (!joined.ok) {
      throw new Error(joined.error.message);
    }
    const exited = exitWorkflow(joined.value.registry, 'val_dev_a', '2026-08-17T00:00:00.000Z');
    if (!exited.ok) {
      throw new Error(exited.error.message);
    }
    const rolling = runRollingUpgrade();
    const status = runOpsCommand(['validator', 'status'], dir);
    console.log('SunRey validator operator demo');
    console.log(`  trust zone role ${config.role} sentries=${config.sentryPeers.length}`);
    console.log(`  remote signer ${signer.server.transport} active=${signer.server.fence.current()?.mode}`);
    console.log(`  join ${joined.value.receipt.status} exit ${exited.value.receipt.status}`);
    console.log(`  rolling upgrade safety=${rolling.safety} quorum=${rolling.quorumHeld} autoActivate=${rolling.newBinaryDidNotAutoActivate}`);
    console.log(`  cli ${status.command} ok=${status.ok}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('demo.ts') || entry.endsWith('demo.js')) {
  console.log('SunRey multi-failure-domain resilience demo');
  console.log('ENVIRONMENT=simulation  ENGINEERING_TEST_TARGETS only');
  const result = runOpsDemo();
  console.log(JSON.stringify(result, null, 2));
  console.log('sunrey-ops health');
  console.log(runSunreyOps(['health']));
  runValidatorOpsDemo();
}
