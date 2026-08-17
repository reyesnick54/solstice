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
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', cwd: root },
);
process.exit(result.status ?? 1);
