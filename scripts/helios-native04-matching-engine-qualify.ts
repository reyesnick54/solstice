#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    'tests/helios-native04-matching-engine.test.ts',
  ],
  { cwd: process.cwd(), stdio: 'inherit', env: process.env },
);

assert.equal(result.status, 0, 'NATIVE04 matching engine tests must pass');
