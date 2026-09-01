#!/usr/bin/env node
/**
 * Wave 6 Prompt 16 — performance qualification runner.
 * Executes reproducible benchmark suites and writes summarized JSON results.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureEnvironment } from '../performance/lib/env-metadata.ts';
import { resultsDir, summarizeReport, writeReport } from '../performance/lib/report.ts';

const ALL_SUITES = [
  'api',
  'database',
  'blockchain',
  'exchange',
  'grow',
  'access',
  'providers',
  'subscription',
  'chaos',
  'stress',
  'soak',
];

function parseSuites(argv) {
  const suiteAt = argv.indexOf('--suite');
  if (suiteAt < 0) return [...ALL_SUITES];
  const requested = argv[suiteAt + 1];
  if (!requested) return [...ALL_SUITES];
  return requested.split(',').map((value) => value.trim());
}

async function runStressSuite() {
  const started = Date.now();
  const [{ runProfile }, { measureExplorer }, { measureExchange }, { measureSdk }] = await Promise.all([
    import('../packages/sunrey-chain/src/perf/runner.ts'),
    import('../packages/sunrey-explorer/src/perf.ts'),
    import('../packages/sunrey-exchange/src/perf.ts'),
    import('../packages/sunrey-sdk/src/perf.ts'),
  ]);
  const ports = {
    explorer: { measure: measureExplorer },
    exchange: { measure: measureExchange },
    sdk: { measure: measureSdk },
  };
  const report = runProfile({ profile: 'seven-validator', ports, latencyProfile: 'low' });
  const throughput = report.cases.find((row) => row.throughput)?.throughput;
  return {
    suite: 'stress',
    status: report.invariants.every((row) => row.ok) ? 'BENCHMARKED' : 'TARGET_NOT_MET',
    durationMs: Date.now() - started,
    cases: [
      {
        name: 'seven-validator-saturation',
        sustainedFinalizedTxPerSec: throughput?.sustainedFinalizedPerSec ?? null,
        rejected: throughput?.rejected ?? null,
        submitted: throughput?.submitted ?? null,
        status: 'BENCHMARKED',
      },
    ],
    environment: captureEnvironment({ validatorCount: 7, benchmarkTool: 'sunrey-bench' }),
    notes: ['Stress point is in-process seven-validator mixed workload'],
  };
}

async function runSoakSuite() {
  const started = Date.now();
  const soakMs = Number.parseInt(process.env.SUNREY_SOAK_MS ?? '500', 10);
  if (soakMs < 60_000) {
    return {
      suite: 'soak',
      status: 'ENVIRONMENT_LIMITED',
      durationMs: Date.now() - started,
      cases: [
        {
          name: 'mini-soak',
          status: 'ENVIRONMENT_LIMITED',
          soakMsRequested: soakMs,
          note: 'Set SUNREY_SOAK_MS>=60000 for sustained soak; default mini-soak runs short sanity only',
        },
      ],
      environment: captureEnvironment({ benchmarkTool: 'sunrey-bench' }),
      notes: ['Long soak requires dedicated host — see docs/performance/soak-testing.md'],
    };
  }
  const [{ runProfile }, { measureExplorer }, { measureExchange }, { measureSdk }] = await Promise.all([
    import('../packages/sunrey-chain/src/perf/runner.ts'),
    import('../packages/sunrey-explorer/src/perf.ts'),
    import('../packages/sunrey-exchange/src/perf.ts'),
    import('../packages/sunrey-sdk/src/perf.ts'),
  ]);
  const ports = {
    explorer: { measure: measureExplorer },
    exchange: { measure: measureExchange },
    sdk: { measure: measureSdk },
  };
  const report = runProfile({ profile: 'soak', ports, soakMs });
  return {
    suite: 'soak',
    status: report.invariants.every((row) => row.ok) ? 'BENCHMARKED' : 'TARGET_NOT_MET',
    durationMs: Date.now() - started,
    cases: report.cases.map((row) => ({
      name: row.name,
      status: 'BENCHMARKED',
      latency: row.latency,
      throughput: row.throughput,
      extras: row.extras,
    })),
    invariants: report.invariants,
    environment: captureEnvironment({ benchmarkTool: 'sunrey-bench', validatorCount: 7 }),
  };
}

async function runSuite(name) {
  switch (name) {
    case 'api': {
      const { runApiBaseline } = await import('../performance/api/baseline.ts');
      return runApiBaseline();
    }
    case 'database': {
      const { runDatabaseBaseline } = await import('../performance/database/baseline.ts');
      return runDatabaseBaseline();
    }
    case 'blockchain': {
      const { runBlockchainBaseline } = await import('../performance/blockchain/run.ts');
      return runBlockchainBaseline();
    }
    case 'exchange': {
      const { runExchangeBaseline } = await import('../performance/exchange/baseline.ts');
      return runExchangeBaseline();
    }
    case 'grow': {
      const { runGrowBaseline } = await import('../performance/agents/grow-baseline.ts');
      return runGrowBaseline();
    }
    case 'access': {
      const { runAccessBaseline } = await import('../performance/access/allocation-baseline.ts');
      return runAccessBaseline();
    }
    case 'providers': {
      const { runProviderFanoutBaseline } = await import('../performance/providers/fanout-baseline.ts');
      return runProviderFanoutBaseline();
    }
    case 'subscription': {
      const { runSubscriptionIntelligenceBaseline } = await import('../performance/subscription-intelligence/baseline.ts');
      return runSubscriptionIntelligenceBaseline();
    }
    case 'chaos': {
      const { runChaosScenarios } = await import('../performance/chaos/scenarios.ts');
      return runChaosScenarios();
    }
    case 'stress':
      return runStressSuite();
    case 'soak':
      return runSoakSuite();
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
  const suites = parseSuites(argv);
  const outAt = argv.indexOf('--out');
  const outDir = outAt >= 0 && argv[outAt + 1] ? argv[outAt + 1] : resultsDir();

  mkdirSync(outDir, { recursive: true });
  const results = [];

  for (const suite of suites) {
    console.log(`[qualify:performance] running ${suite}...`);
    try {
      const result = await runSuite(suite);
      results.push(result);
      console.log(`[qualify:performance] ${suite}: ${result.status} (${result.durationMs}ms)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[qualify:performance] ${suite} FAILED: ${message}`);
      results.push({
        suite,
        status: 'TARGET_NOT_MET',
        durationMs: 0,
        cases: [],
        failures: [message],
      });
    }
  }

  const report = {
    schemaVersion: 1,
    wave: 'wave6-prompt16',
    environment: captureEnvironment(),
    suites: results,
    summary: summarizeReport(results),
  };
  const written = writeReport(report, outDir);
  console.log(`[qualify:performance] wrote ${written}/summary.json`);
  return results.some((row) => row.status === 'TARGET_NOT_MET') ? 1 : 0;
}

main().then((code) => process.exit(code));
