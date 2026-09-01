/**
 * Consumer BFF HTTP baseline — representative API flows.
 */

import { sandboxToken } from '../../services/api/src/consumer/sandbox-personas.ts';
import { startSunReyPreview } from '../../services/api/src/preview.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import { evaluateLatencyTarget, QUALIFICATION_TARGETS, type QualificationStatus } from '../lib/targets.ts';
import { runConcurrent, summarizeLatencyMs, summarizeThroughput, timeMs } from '../lib/stats.ts';

type FlowCase = {
  readonly name: string;
  readonly path: string;
  readonly method: string;
  readonly auth: boolean;
  readonly category: 'health' | 'authenticatedRead' | 'authenticatedWrite' | 'ledgerAffecting' | 'multiService' | 'errorPath';
  readonly expectStatus: number;
};

const FLOWS: readonly FlowCase[] = [
  { name: 'health', path: '/health', method: 'GET', auth: false, category: 'health', expectStatus: 200 },
  { name: 'bootstrap', path: '/api/v1/me/bootstrap', method: 'GET', auth: true, category: 'authenticatedRead', expectStatus: 200 },
  { name: 'home', path: '/api/v1/me/home', method: 'GET', auth: true, category: 'multiService', expectStatus: 200 },
  { name: 'accounts-list', path: '/api/v1/accounts', method: 'GET', auth: true, category: 'authenticatedRead', expectStatus: 200 },
  { name: 'grow-snapshot', path: '/api/v1/grow/snapshot', method: 'GET', auth: true, category: 'multiService', expectStatus: 200 },
  { name: 'access-overview', path: '/api/v1/access/overview', method: 'GET', auth: true, category: 'multiService', expectStatus: 200 },
  { name: 'exchange-markets', path: '/api/v1/exchange/markets', method: 'GET', auth: true, category: 'authenticatedRead', expectStatus: 200 },
  { name: 'not-found', path: '/api/v1/does-not-exist', method: 'GET', auth: true, category: 'errorPath', expectStatus: 404 },
];

const CONCURRENCY_LEVELS = [10, 50, 100] as const;
const SAMPLES_PER_FLOW = 40;

export async function runApiBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const preview = await startSunReyPreview({
    allowSandboxPersonas: true,
    allowLocalOrigins: true,
  });
  const token = sandboxToken('grow_healthy_saver');
  const cases: Record<string, unknown>[] = [];
  const failures: string[] = [];

  try {
    for (const flow of FLOWS) {
      const latencies: number[] = [];
      let errors = 0;
      for (let i = 0; i < SAMPLES_PER_FLOW; i += 1) {
        const headers: Record<string, string> = { accept: 'application/json' };
        if (flow.auth) headers.authorization = `Bearer ${token}`;
        const ms = await timeMs(async () => {
          const response = await fetch(`${preview.url}${flow.path}`, { method: flow.method, headers });
          if (response.status !== flow.expectStatus) errors += 1;
        });
        latencies.push(ms);
      }
      const latency = summarizeLatencyMs(latencies);
      let status: QualificationStatus = 'BENCHMARKED';
      if (flow.category === 'authenticatedRead' || flow.category === 'multiService') {
        status = evaluateLatencyTarget(QUALIFICATION_TARGETS.api.authenticatedRead, latency);
      } else if (flow.category === 'health') {
        status = latency.p99Ms <= QUALIFICATION_TARGETS.api.health.p99Ms ? 'TARGET_MET' : 'TARGET_NOT_MET';
      }
      cases.push({
        name: flow.name,
        category: flow.category,
        path: flow.path,
        status,
        latency,
        errors,
        errorRate: errors / SAMPLES_PER_FLOW,
      });
    }

    for (const concurrency of CONCURRENCY_LEVELS) {
      const stressLatencies: number[] = [];
      let stressErrors = 0;
      const stressStart = performance.now();
      await runConcurrent(concurrency, concurrency * 5, async () => {
        const ms = await timeMs(async () => {
          const response = await fetch(`${preview.url}/api/v1/me/home`, {
            headers: { accept: 'application/json', authorization: `Bearer ${token}` },
          });
          if (!response.ok) stressErrors += 1;
        });
        stressLatencies.push(ms);
      });
      const durationMs = performance.now() - stressStart;
      cases.push({
        name: `concurrency-home-${concurrency}`,
        category: 'stress',
        status: 'BENCHMARKED',
        concurrency,
        latency: summarizeLatencyMs(stressLatencies),
        throughput: summarizeThroughput({
          requests: concurrency * 5,
          durationMs,
          errors: stressErrors,
        }),
      });
    }
  } finally {
    await preview.close();
  }

  const suiteStatus: QualificationStatus =
    failures.length > 0 || cases.some((row) => row.status === 'TARGET_NOT_MET')
      ? 'TARGET_NOT_MET'
      : cases.filter((row) => row.category !== 'health' && row.category !== 'stress').every((row) => row.status === 'TARGET_MET')
        ? 'TARGET_MET'
        : 'BENCHMARKED';

  return {
    suite: 'api',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ networkMode: 'localhost', benchmarkTool: 'node-fetch' }),
    ...(failures.length > 0 ? { failures } : {}),
  };
}
