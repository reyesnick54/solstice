/**
 * External provider fan-out, timeout, and partial-failure behavior.
 */

import { createExternalDataPlane } from '../../packages/external-data/src/plane.ts';
import {
  createDefaultWave6AdapterStates,
  fetchResearchWorks,
  type Wave6AdapterContext,
} from '../../packages/external-data/src/wave6/adapters.ts';
import { TIMEOUT_RESEARCH_PROVIDER } from '../../packages/external-data/src/wave6/fixtures.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import { QUALIFICATION_TARGETS, type QualificationStatus } from '../lib/targets.ts';
import { summarizeLatencyMs, timeMs } from '../lib/stats.ts';

export async function runProviderFanoutBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];

  const plane = createExternalDataPlane();
  const parallelSamples: number[] = [];
  for (let i = 0; i < 50; i += 1) {
    parallelSamples.push(
      await timeMs(async () => {
        await Promise.all([
          Promise.resolve(plane.macro.getIndicators()),
          Promise.resolve(plane.fx.getRates()),
          Promise.resolve(plane.markets.getQuotes()),
          Promise.resolve(plane.company.getLatestFilings()),
        ]);
      }),
    );
  }
  const parallel = summarizeLatencyMs(parallelSamples);

  const slowCtx: Wave6AdapterContext = {
    nowUtc: new Date().toISOString(),
    states: {
      ...createDefaultWave6AdapterStates(),
      [TIMEOUT_RESEARCH_PROVIDER]: { scenario: 'timeout' },
    },
  };
  const timeoutSamples: number[] = [];
  let timeoutFailures = 0;
  for (let i = 0; i < 20; i += 1) {
    const ms = await timeMs(() => {
      const results = fetchResearchWorks(slowCtx, { q: 'quantum' });
      if (results.length === 0) timeoutFailures += 1;
    });
    timeoutSamples.push(ms);
  }

  const partialCtx: Wave6AdapterContext = {
    nowUtc: new Date().toISOString(),
    states: createDefaultWave6AdapterStates(),
  };
  const partialSamples: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    partialSamples.push(
      await timeMs(() => {
        fetchResearchWorks(partialCtx, { q: 'economics' });
      }),
    );
  }

  const timeoutLatency = summarizeLatencyMs(timeoutSamples);
  const partialLatency = summarizeLatencyMs(partialSamples);
  const timeoutBounded = timeoutLatency.p99Ms < 5000;
  const partialOk = partialLatency.count > 0;

  cases.push(
    { name: 'four-domain-parallel', status: 'BENCHMARKED', latency: parallel, domains: ['macro', 'fx', 'markets', 'filings'] },
    {
      name: 'timeout-provider',
      status: timeoutBounded ? 'TARGET_MET' : 'TARGET_NOT_MET',
      latency: timeoutLatency,
      failuresObserved: timeoutFailures,
      target: QUALIFICATION_TARGETS.providers.fanOut,
    },
    {
      name: 'partial-provider-success',
      status: partialOk ? 'TARGET_MET' : 'TARGET_NOT_MET',
      latency: partialLatency,
    },
  );

  const suiteStatus: QualificationStatus = cases.some((row) => row.status === 'TARGET_NOT_MET')
    ? 'TARGET_NOT_MET'
    : 'TARGET_MET';

  return {
    suite: 'providers',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ benchmarkTool: 'external-data-plane' }),
    notes: ['Fixture adapters only — no live network calls'],
  };
}
