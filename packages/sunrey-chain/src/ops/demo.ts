import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fourValidatorDevelopmentSet } from '../validators/index.ts';
import { runOpsCommand } from './cli.ts';
import { developmentValidatorConfig } from './config.ts';
import { developmentRemoteSigner } from './signer.ts';
import { runRollingUpgrade } from './testnet.ts';
import { developmentEpoch, exitWorkflow, joinWorkflow, generateJoinRecord } from './workflows.ts';
import { OperatorKeystore } from './keys.ts';

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
