#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

import assert from 'node:assert/strict';

import {
  HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED,
  defaultM24QualificationChecks,
  evaluateM24ExecutionQualification,
} from '../packages/platform/src/helios/multi-asset/m24/index.ts';

const test = spawnSync(
  'node',
  [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    'tests/helios-multi-asset-m24-execution-settlement-reconciliation.test.ts',
  ],
  { stdio: 'inherit', cwd: process.cwd() },
);

if (test.status !== 0) {
  process.exit(test.status ?? 1);
}

const result = evaluateM24ExecutionQualification(defaultM24QualificationChecks());
assert.equal(
  result.marker,
  HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED,
  result.blockers.join('; '),
);
process.exit(0);
