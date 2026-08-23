#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = join(ROOT, 'packages/sunrey-chain/src/infra/preproduction/demo.ts');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const command = process.argv[2] ?? 'rehearse';
if (!existsSync(DEMO)) {
  console.error('preproduction demo missing');
  process.exit(1);
}

if (command === 'help') {
  console.log('sunrey-preproduction rehearse|validate|smoke|rollback|posture');
  process.exit(0);
}

run('node', [
  '--experimental-strip-types',
  '--disable-warning=ExperimentalWarning',
  DEMO,
]);

if (command === 'validate' && existsSync('/usr/bin/helm')) {
  run('helm', ['lint', 'infra/sunrey-production/helm/sunrey-preproduction']);
  run('helm', [
    'template',
    'sunrey-preproduction',
    'infra/sunrey-production/helm/sunrey-preproduction',
    '-f',
    'infra/sunrey-production/helm/sunrey-preproduction/values.yaml',
  ]);
}
