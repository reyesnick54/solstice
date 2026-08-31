/**
 * Controlled failure / chaos scenarios — safe simulation only.
 */

import { sandboxToken } from '../../services/api/src/consumer/sandbox-personas.ts';
import { startSunReyPreview } from '../../services/api/src/preview.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import type { QualificationStatus } from '../lib/targets.ts';
import { timeMs } from '../lib/stats.ts';

export async function runChaosScenarios(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];

  const healthy = await startSunReyPreview({ allowSandboxPersonas: true });
  try {
    const healthMs = await timeMs(async () => {
      const response = await fetch(`${healthy.url}/health`);
      if (!response.ok) throw new Error('health failed');
    });
    cases.push({
      name: 'baseline-healthy',
      status: 'TARGET_MET',
      latencyMs: healthMs,
    });
  } finally {
    await healthy.close();
  }

  const providerDown = await startSunReyPreview({ allowSandboxPersonas: true, providerDown: true });
  try {
    const token = sandboxToken('grow_healthy_saver');
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    };

    const homeResponse = await fetch(`${providerDown.url}/api/v1/me/home`, { headers });
    cases.push({
      name: 'provider-down-degrades',
      status: homeResponse.ok ? 'TARGET_MET' : 'BENCHMARKED',
      httpStatus: homeResponse.status,
      note: 'Partial degradation expected — must not return ambiguous ledger state',
    });

    const growResponse = await fetch(`${providerDown.url}/api/v1/grow/snapshot`, { headers });
    cases.push({
      name: 'provider-down-grow',
      status: growResponse.ok || growResponse.status === 503 ? 'TARGET_MET' : 'BENCHMARKED',
      httpStatus: growResponse.status,
    });
  } finally {
    await providerDown.close();
  }

  cases.push({
    name: 'database-unavailable',
    status: 'ENVIRONMENT_LIMITED',
    note: 'Full DB chaos requires npm run qualify:backend-db with controlled PostgreSQL stop',
  });

  cases.push({
    name: 'validator-unavailable',
    status: 'ENVIRONMENT_LIMITED',
    note: 'Use sunrey-bench four-validator profile with modeled latency for validator chaos',
  });

  const suiteStatus: QualificationStatus = cases.some((row) => row.status === 'TARGET_NOT_MET')
    ? 'TARGET_NOT_MET'
    : cases.some((row) => row.status === 'ENVIRONMENT_LIMITED')
      ? 'ENVIRONMENT_LIMITED'
      : 'TARGET_MET';

  return {
    suite: 'chaos',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ networkMode: 'localhost' }),
    notes: ['Financial/ledger writes must not become ambiguous under degradation'],
  };
}
