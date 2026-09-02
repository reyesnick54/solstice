#!/usr/bin/env node
/**
 * Chaos automation — network delay simulation (in-process).
 * Restricted to non-production environments.
 */
import { ENVIRONMENT } from '../../packages/config/src/flags.ts';
import { runAllChaosScenarios } from '../../packages/sunrey-chain/src/ops/sre/chaos.ts';

if (ENVIRONMENT !== 'simulation') {
  console.error('[chaos:network-delay] refused — ENVIRONMENT must be simulation');
  process.exit(1);
}

const scenarios = runAllChaosScenarios().filter((row) =>
  row.scenario === 'PROVIDER_TIMEOUT' || row.scenario === 'QUEUE_INTERRUPTION',
);
const passed = scenarios.every((row) => row.financialIntegritySurvived && row.inventedJournals === false);
console.log(JSON.stringify({ scenario: 'network-delay', scenarios, passed }, null, 2));
process.exit(passed ? 0 : 1);
