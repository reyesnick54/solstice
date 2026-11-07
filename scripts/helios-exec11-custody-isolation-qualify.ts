#!/usr/bin/env node
/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC11 qualification script.
 */

import assert from 'node:assert/strict';

import {
  HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED,
  evaluateExec11CustodyIsolationQualification,
} from '../packages/custody/src/execution-connectivity/exec11/index.ts';

const result = evaluateExec11CustodyIsolationQualification();
assert.equal(result.qualified, true, `blockers: ${result.blockers.join(', ')}`);
assert.equal(result.marker, HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED);
console.log(result.marker);
