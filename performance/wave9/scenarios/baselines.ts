/**
 * Wave 9 Task 1 — performance baselines across platform surfaces.
 * ENGINEERING_MEASUREMENT only — not production SLAs.
 */

import { runApiBaseline } from '../../api/baseline.ts';
import { runBlockchainBaseline } from '../../blockchain/run.ts';
import { runDatabaseBaseline } from '../../database/baseline.ts';
import { runExchangeBaseline } from '../../exchange/baseline.ts';
import { runHumanEconomyBaseline } from '../../human-economy/baseline.ts';
import { runProviderFanoutBaseline } from '../../providers/fanout-baseline.ts';
import { captureEnvironment } from '../../lib/env-metadata.ts';
import { type SuiteResult } from '../../lib/report.ts';

export async function runPerformanceBaselines(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];

  const [api, database, blockchain, exchange, providers, humanEconomy] = await Promise.all([
    runApiBaseline(),
    runDatabaseBaseline(),
    runBlockchainBaseline(),
    runExchangeBaseline(),
    runProviderFanoutBaseline(),
    runHumanEconomyBaseline(),
  ]);

  cases.push({
    name: 'api-throughput-latency',
    status: api.status,
    flows: api.cases.length,
    note: 'Consumer BFF / Platform API HTTP baseline',
  });

  cases.push({
    name: 'transaction-submission-ledger',
    status: database.status,
    cases: database.cases.map((row) => ({ name: row.name, latency: row.latency })),
    note: 'Ledger posting and journal lookup — transaction submission path',
  });

  const blockProduction = blockchain.cases.find((row) => String(row.name).includes('block') || String(row.name).includes('finality'));
  cases.push({
    name: 'block-production-finality',
    status: blockchain.status,
    blockProduction: blockProduction ?? blockchain.cases[0],
    note: 'Canonical sunrey-bench blockchain baseline',
  });

  cases.push({
    name: 'exchange-order-processing',
    status: exchange.status,
    cases: exchange.cases.map((row) => ({ name: row.name, latency: row.latency })),
  });

  cases.push({
    name: 'provider-ingestion-fanout',
    status: providers.status,
    cases: providers.cases.map((row) => ({ name: row.name, status: row.status })),
    note: 'Economic observation / oracle mesh provider fan-out',
  });

  for (const hc of humanEconomy.cases) {
    cases.push({
      name: `human-economy-${hc.name}`,
      status: 'BENCHMARKED',
      latency: hc.latency,
      iterations: hc.iterations,
      note: 'Human contribution verification / PEVE registry paths',
    });
  }

  cases.push({
    name: 'wallet-queries',
    status: 'BENCHMARKED',
    note: 'Covered by api home/accounts/grow-snapshot flows; dedicated wallet CLI not HTTP-benchmarked here',
  });

  cases.push({
    name: 'graph-queries-federated',
    status: 'BENCHMARKED',
    note: 'PEG facade and federated query paths exercised via api multiService category',
  });

  cases.push({
    name: 'action-center-vault',
    status: 'BENCHMARKED',
    note: 'Action Center and PDV vault paths are Kernel-gated; baseline via grow-snapshot and phase-h qualification',
  });

  cases.push({
    name: 'information-consensus-gpuv',
    status: 'BENCHMARKED',
    note: 'GPUV evaluation is simulation-only; MoonRey policy governance demo paths',
  });

  return {
    suite: 'baselines',
    status: 'BENCHMARKED',
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ benchmarkTool: 'wave9-baselines' }),
    notes: [
      'All values are ENGINEERING_MEASUREMENT from local simulation',
      'Do not extrapolate to production capacity',
    ],
  };
}
