#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    'packages/sunrey-chain/src/testnet/cli-main.ts',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', env: { ...process.env, SUNREY_FIXTURE_ENV: process.env.SUNREY_FIXTURE_ENV ?? 'local' } },
);
process.exit(result.status ?? 1);
