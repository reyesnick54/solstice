#!/usr/bin/env node
/**
 * Single operator workflow: generate configuration, ceremony inputs,
 * genesis, launch the local cluster simulation, and verify.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    'packages/sunrey-chain/src/testnet/demo.ts',
  ],
  { stdio: 'inherit', env: { ...process.env, SUNREY_FIXTURE_ENV: process.env.SUNREY_FIXTURE_ENV ?? 'local' } },
);
process.exit(result.status ?? 1);
