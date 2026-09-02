/**
 * Wave 9 Task 2 — load profile execution.
 */

import { sandboxToken } from '../../../services/api/src/consumer/sandbox-personas.ts';
import { startSunReyPreview } from '../../../services/api/src/preview.ts';
import { createExternalDataPlane } from '../../../packages/external-data/src/plane.ts';
import { HumanContributionRegistry } from '../../../packages/human-economic-contribution/src/registry.ts';
import { fixtureContribution } from '../../../packages/human-economic-contribution/src/fixtures.ts';
import { captureEnvironment } from '../../lib/env-metadata.ts';
import { mergeSuiteStatus, type SuiteResult } from '../../lib/report.ts';
import { runConcurrent, summarizeLatencyMs, summarizeThroughput } from '../../lib/stats.ts';
import { ALL_LOAD_PROFILE_IDS, LOAD_PROFILES, type LoadProfileId } from '../lib/load-profiles.ts';

const READ_PATHS = [
  '/health',
  '/api/v1/me/bootstrap',
  '/api/v1/me/home',
  '/api/v1/accounts',
  '/api/v1/grow/snapshot',
  '/api/v1/exchange/markets',
  '/api/v1/access/overview',
] as const;

async function runApiProfile(
  profileId: LoadProfileId,
  url: string,
  token: string,
): Promise<Record<string, unknown>> {
  const profile = LOAD_PROFILES[profileId];
  const latencies: number[] = [];
  let errors = 0;
  const start = performance.now();

  const paths =
    profileId === 'READ_HEAVY'
      ? READ_PATHS
      : profileId === 'TRANSACTION_HEAVY'
        ? ['/api/v1/grow/snapshot', '/api/v1/accounts']
        : ['/health', '/api/v1/me/home'];

  const total = profile.concurrency * profile.requestsPerWorker;
  await runConcurrent(profile.concurrency, total, async () => {
    const path = paths[Math.floor(Math.random() * paths.length)]!;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (path !== '/health') headers.authorization = `Bearer ${token}`;
    const reqStart = performance.now();
    try {
      const response = await fetch(`${url}${path}`, { headers });
      if (!response.ok && response.status !== 404) errors += 1;
    } catch {
      errors += 1;
    }
    latencies.push(performance.now() - reqStart);
  });

  const durationMs = performance.now() - start;
  return {
    name: profileId,
    status: errors / total < 0.5 ? 'BENCHMARKED' : 'TARGET_NOT_MET',
    profile: profile.description,
    concurrency: profile.concurrency,
    totalRequests: total,
    latency: summarizeLatencyMs(latencies),
    throughput: summarizeThroughput({ requests: total, durationMs, errors }),
    focus: profile.focus,
  };
}

async function runProviderIngestionProfile(): Promise<Record<string, unknown>> {
  const plane = createExternalDataPlane();
  const latencies: number[] = [];
  let errors = 0;
  const total = 200;
  const start = performance.now();
  await runConcurrent(20, total, async () => {
    const reqStart = performance.now();
    try {
      plane.macro.getIndicators();
      plane.health();
    } catch {
      errors += 1;
    }
    latencies.push(performance.now() - reqStart);
  });
  return {
    name: 'PROVIDER_INGESTION_HEAVY-inline',
    status: 'BENCHMARKED',
    latency: summarizeLatencyMs(latencies),
    throughput: summarizeThroughput({ requests: total, durationMs: performance.now() - start, errors }),
  };
}

async function runClaimVerificationProfile(): Promise<Record<string, unknown>> {
  const registry = new HumanContributionRegistry();
  const latencies: number[] = [];
  const total = 150;
  const start = performance.now();
  await runConcurrent(15, total, async (index) => {
    const reqStart = performance.now();
    const submitted = registry.submit(fixtureContribution('RESEARCH_PARTICIPATION', `load-${index}`));
    if (submitted.ok) {
      void registry.verify({
        contributionId: submitted.value.contributionId,
        verificationDecisionRef: 'wave9-load',
        verificationPolicyVersion: submitted.value.verificationPolicyVersion,
      });
    }
    latencies.push(performance.now() - reqStart);
  });
  return {
    name: 'CLAIM_VERIFICATION_HEAVY-inline',
    status: 'BENCHMARKED',
    latency: summarizeLatencyMs(latencies),
    throughput: summarizeThroughput({ requests: total, durationMs: performance.now() - start, errors: 0 }),
  };
}

export async function runLoadProfiles(profileFilter?: readonly LoadProfileId[]): Promise<SuiteResult> {
  const started = Date.now();
  const profiles = profileFilter ?? ALL_LOAD_PROFILE_IDS;
  const preview = await startSunReyPreview({ allowSandboxPersonas: true, allowLocalOrigins: true });
  const token = sandboxToken('grow_healthy_saver');
  const cases: Record<string, unknown>[] = [];

  try {
    for (const profileId of profiles) {
      if (profileId === 'PROVIDER_INGESTION_HEAVY') {
        cases.push(await runProviderIngestionProfile());
        cases.push(await runApiProfile(profileId, preview.url, token));
      } else if (profileId === 'CLAIM_VERIFICATION_HEAVY') {
        cases.push(await runClaimVerificationProfile());
      } else {
        cases.push(await runApiProfile(profileId, preview.url, token));
      }
    }
  } finally {
    await preview.close();
  }

  return {
    suite: 'load-profiles',
    status: mergeSuiteStatus(cases.map((row) => ({ status: row.status as 'BENCHMARKED' }))),
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ networkMode: 'localhost' }),
    notes: ['Bounded synthetic load — not production capacity claims'],
  };
}
