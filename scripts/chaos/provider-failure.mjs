#!/usr/bin/env node
/**
 * Chaos automation — provider failure simulation.
 * Restricted to non-production environments.
 */
import { ENVIRONMENT } from '../../packages/config/src/flags.ts';
import {
  runTwentyFiveProviderOutageTest,
  runComplianceOutageTest,
} from '../../packages/external-data/src/index.ts';

if (ENVIRONMENT !== 'simulation') {
  console.error('[chaos:provider-failure] refused — ENVIRONMENT must be simulation');
  process.exit(1);
}

const results = [runTwentyFiveProviderOutageTest(), runComplianceOutageTest()];
const passed = results.every((row) => row.passed);
console.log(JSON.stringify({ scenario: 'provider-failure', results, passed }, null, 2));
process.exit(passed ? 0 : 1);
