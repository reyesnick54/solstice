#!/usr/bin/env node
/**
 * Wave 9 — reliability, chaos, and disaster-recovery qualification runner.
 * Safe synthetic sandbox/test environments only.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { captureEnvironment } from '../performance/lib/env-metadata.ts';
import { buildWave9Report, wave9ResultsDir, writeWave9Report } from '../performance/wave9/lib/report.ts';

const SMOKE_SUITES = [
  'baselines',
  'rate-limit',
  'event-backlog',
  'blockchain-failure',
  'provider-failure',
  'policy-auth-failure',
  'exchange-failure',
  'bottlenecks',
];

const FULL_SUITES = [
  ...SMOKE_SUITES,
  'load-profiles',
  'database-failure',
  'full-stack-restart',
  'backup-restore',
  'regional-failure',
];

function parseArgs(argv) {
  const profileAt = argv.indexOf('--profile');
  const profile = profileAt >= 0 && argv[profileAt + 1] === 'smoke' ? 'smoke' : 'full';
  const suiteAt = argv.indexOf('--suite');
  let suites = profile === 'smoke' ? [...SMOKE_SUITES] : [...FULL_SUITES];
  if (suiteAt >= 0 && argv[suiteAt + 1]) {
    suites = argv[suiteAt + 1].split(',').map((value) => value.trim());
  }
  const outAt = argv.indexOf('--out');
  const outDir = outAt >= 0 && argv[outAt + 1] ? argv[outAt + 1] : wave9ResultsDir();
  return { profile, suites, outDir };
}

async function runSuite(name) {
  switch (name) {
    case 'baselines': {
      const { runPerformanceBaselines } = await import('../performance/wave9/scenarios/baselines.ts');
      return runPerformanceBaselines();
    }
    case 'load-profiles': {
      const { runLoadProfiles } = await import('../performance/wave9/scenarios/load-profiles.ts');
      return runLoadProfiles();
    }
    case 'rate-limit': {
      const { runRateLimitBehavior } = await import('../performance/wave9/scenarios/rate-limit.ts');
      return runRateLimitBehavior();
    }
    case 'event-backlog': {
      const { runEventBacklogScenarios } = await import('../performance/wave9/scenarios/event-backlog.ts');
      return runEventBacklogScenarios();
    }
    case 'database-failure': {
      const { runDatabaseFailureScenarios } = await import('../performance/wave9/scenarios/database-failure.ts');
      return runDatabaseFailureScenarios();
    }
    case 'blockchain-failure': {
      const { runBlockchainFailureScenarios } = await import('../performance/wave9/scenarios/blockchain-failure.ts');
      return runBlockchainFailureScenarios();
    }
    case 'provider-failure': {
      const { runProviderFailureScenarios } = await import('../performance/wave9/scenarios/provider-failure.ts');
      return runProviderFailureScenarios();
    }
    case 'policy-auth-failure': {
      const { runPolicyAuthFailureScenarios } = await import('../performance/wave9/scenarios/policy-auth-failure.ts');
      return runPolicyAuthFailureScenarios();
    }
    case 'exchange-failure': {
      const { runExchangeFailureScenarios } = await import('../performance/wave9/scenarios/exchange-failure.ts');
      return runExchangeFailureScenarios();
    }
    case 'full-stack-restart': {
      const { runFullStackRestartScenarios } = await import('../performance/wave9/scenarios/full-stack-restart.ts');
      return runFullStackRestartScenarios();
    }
    case 'backup-restore': {
      const { runBackupRestoreScenarios } = await import('../performance/wave9/scenarios/backup-restore.ts');
      return runBackupRestoreScenarios();
    }
    case 'regional-failure': {
      const { runRegionalFailureModel } = await import('../performance/wave9/scenarios/regional-failure.ts');
      return runRegionalFailureModel();
    }
    case 'bottlenecks': {
      const { runBottleneckReport } = await import('../performance/wave9/scenarios/bottleneck-report.ts');
      return runBottleneckReport();
    }
    default:
      return {
        suite: name,
        status: 'NOT_TESTED',
        durationMs: 0,
        cases: [{ name, status: 'NOT_TESTED' }],
      };
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const { profile, suites, outDir } = parseArgs(argv);
  mkdirSync(outDir, { recursive: true });
  const results = [];

  console.log(`[qualify:wave9] profile=${profile} suites=${suites.join(',')}`);

  for (const suite of suites) {
    console.log(`[qualify:wave9] running ${suite}...`);
    try {
      const result = await runSuite(suite);
      results.push(result);
      console.log(`[qualify:wave9] ${suite}: ${result.status} (${result.durationMs}ms)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[qualify:wave9] ${suite} FAILED: ${message}`);
      results.push({
        suite,
        status: 'TARGET_NOT_MET',
        durationMs: 0,
        cases: [],
        failures: [message],
      });
    }
  }

  const report = buildWave9Report({
    profile,
    environment: captureEnvironment({ wave: 'wave9-readiness' }),
    suites: results,
  });
  const written = writeWave9Report(report, outDir);
  console.log(`[qualify:wave9] wrote ${join(written, 'summary.json')}`);
  return results.some(
    (row) =>
      row.status === 'TARGET_NOT_MET' &&
      row.suite !== 'baselines' &&
      row.suite !== 'bottlenecks' &&
      row.suite !== 'regional-failure',
  )
    ? 1
    : 0;
}

main().then((code) => process.exit(code));
