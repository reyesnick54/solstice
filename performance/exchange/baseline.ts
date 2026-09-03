// @ts-nocheck
/**
 * Exchange order lifecycle benchmark.
 */

import { measureExchange } from '../../packages/sunrey-exchange/src/perf.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import { evaluateLatencyTarget, QUALIFICATION_TARGETS, type QualificationStatus } from '../lib/targets.ts';

const ORDER_COUNTS = [100, 500, 1000] as const;

export async function runExchangeBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];

  for (const orders of ORDER_COUNTS) {
    const measured = measureExchange({ orders });
    for (const row of measured) {
      const latencyMs = row.latency
        ? {
            p50Ms: row.latency.p50Ns / 1_000_000,
            p95Ms: row.latency.p95Ns / 1_000_000,
            p99Ms: row.latency.p99Ns / 1_000_000,
            count: row.latency.count,
          }
        : null;
      let status: QualificationStatus = 'BENCHMARKED';
      if (row.name === 'order-ingress' && latencyMs) {
        status = evaluateLatencyTarget(QUALIFICATION_TARGETS.exchange.orderIngress, latencyMs);
      }
      cases.push({
        name: `${row.name}-${orders}`,
        orders,
        status,
        latencyMs,
        extras: row.extras,
      });
    }
  }

  const suiteStatus: QualificationStatus = cases.some((row) => row.status === 'TARGET_NOT_MET')
    ? 'TARGET_NOT_MET'
    : 'TARGET_MET';

  return {
    suite: 'exchange',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ benchmarkTool: 'sunrey-exchange-perf' }),
    notes: ['Simulated settlement only — not regulated live settlement'],
  };
}
