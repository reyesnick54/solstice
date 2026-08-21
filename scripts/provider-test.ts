#!/usr/bin/env node
import { runCertificationHarness } from './phase-d-provider-harness.ts';

const result = runCertificationHarness('provider:test');
console.log(JSON.stringify(result, null, 2));
if (result.contractTests !== 'CONTRACT_TEST_PASS') {
  process.exit(1);
}
