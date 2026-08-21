#!/usr/bin/env node
/**
 * Canonical Phase D certification command.
 * Distinguishes CONTRACT_TEST_PASS, SANDBOX_INTEGRATION_PASS, and
 * EXTERNAL_CERTIFICATION_REQUIRED. Never auto-completes external certification.
 */
import { runCertificationHarness } from './phase-d-provider-harness.ts';

const result = runCertificationHarness('provider:certify');
console.log(JSON.stringify(result, null, 2));
if (result.externalCertification !== 'EXTERNAL_CERTIFICATION_REQUIRED') {
  throw new Error('certify must not auto-complete external certification');
}
if (result.contractTests !== 'CONTRACT_TEST_PASS' || result.sandboxIntegration !== 'SANDBOX_INTEGRATION_PASS') {
  process.exit(1);
}
