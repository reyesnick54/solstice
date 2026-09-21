#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED,
  defaultM24QualificationChecks,
  evaluateM24ExecutionQualification,
} from '../packages/platform/src/helios/multi-asset/m24/index.ts';

const result = evaluateM24ExecutionQualification(defaultM24QualificationChecks());
assert.equal(
  result.marker,
  HELIOS_MULTI_ASSET_M24_EXECUTION_SETTLEMENT_RECONCILIATION_QUALIFIED,
  result.blockers.join('; '),
);
process.exit(0);
