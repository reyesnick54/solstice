#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    join(root, 'packages/sunrey-chain/src/supply-chain/cli.ts'),
    'generated-lock',
  ],
  { encoding: 'utf8', cwd: root },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? '');
  process.exit(result.status ?? 1);
}
process.stdout.write(result.stdout ?? '');
console.log('generated-source drift: ok');
