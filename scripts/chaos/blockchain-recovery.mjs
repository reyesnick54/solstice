#!/usr/bin/env node
/**
 * Chaos automation — blockchain recovery suite.
 * Restricted to non-production environments.
 */
import { ENVIRONMENT } from '../../packages/config/src/flags.ts';
import { runChaosRecoverySuite } from '../../packages/sunrey-chain/src/sync/chaos.ts';

if (ENVIRONMENT !== 'simulation') {
  console.error('[chaos:blockchain-recovery] refused — ENVIRONMENT must be simulation');
  process.exit(1);
}

const result = runChaosRecoverySuite();
const passed = result.ok && Object.values(result.value).every(Boolean);
console.log(JSON.stringify({
  scenario: 'blockchain-recovery',
  passed,
  report: result.ok ? result.value : null,
  error: result.ok ? null : result.error?.message,
}, null, 2));
process.exit(passed ? 0 : 1);
