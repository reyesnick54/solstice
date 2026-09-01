/**
 * Access Economy allocation flow benchmark.
 */

import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { subjectRefFor } from '../../packages/access-economy/src/ids.ts';
import {
  createAccessSolvencyService,
  runAccessWave1,
} from '../../packages/access-economy/src/funding-solvency/index.ts';
import {
  createAccessProviderGateway,
  evaluateRedemption,
} from '../../packages/access-economy/src/providers/index.ts';
import { buildQuote } from '../../packages/access-economy/src/providers/adapters/shared.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import { evaluateLatencyTarget, QUALIFICATION_TARGETS, type QualificationStatus } from '../lib/targets.ts';
import { runConcurrent, summarizeLatencyMs, summarizeThroughput, timeMs } from '../lib/stats.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');

function seedMobilityEntitlement(service: ReturnType<typeof createAccessSolvencyService>, days: bigint): string {
  const entitlementId = `ent_perf_${days}`;
  service.getEntitlementLedger().allocate({
    entitlementId,
    userId: subjectRefFor('perf-user'),
    category: 'MOBILITY',
    unit: 'day',
    quantity: days,
    allocationReference: 'alloc:perf',
    evidenceReference: 'evidence:alloc:perf',
    createdAt: NOW,
    idempotencyKey: `alloc:${entitlementId}`,
  });
  return entitlementId;
}

export async function runAccessBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];
  const gateway = createAccessProviderGateway();
  const solvency = createAccessSolvencyService();
  const entitlementId = seedMobilityEntitlement(solvency, 3n);

  const overviewSamples: number[] = [];
  const searchSamples: number[] = [];
  const quoteSamples: number[] = [];
  const allocationSamples: number[] = [];

  for (let i = 0; i < 200; i += 1) {
    overviewSamples.push(
      await timeMs(() => {
        solvency.getEntitlementLedger().getBalance(entitlementId);
      }),
    );
    searchSamples.push(
      await timeMs(() => {
        gateway.search({
          requestId: `perf_search_${i}`,
          category: 'VEHICLE_HOURS',
          query: 'Mustang Miami',
          location: 'Miami, FL',
          limit: 5,
        });
      }),
    );
    quoteSamples.push(
      await timeMs(() => {
        gateway.quote({
          requestId: `perf_quote_${i}`,
          providerId: 'turo',
          catalogItemId: 'turo_mustang_gt_miami',
          quantity: 1n,
          startsAt: '2026-08-29T10:00:00.000Z',
          endsAt: '2026-08-30T10:00:00.000Z',
          location: 'Miami, FL',
          idempotencyKey: `perf_quote_${i}`,
        });
      }),
    );
    allocationSamples.push(
      await timeMs(() => {
        evaluateRedemption({
          redemptionId: `red_perf_${i}`,
          subjectRef: subjectRefFor('perf-user'),
          intentId: `intent_perf_${i}`,
          category: 'MOBILITY',
          providerId: 'turo',
          providerQuote: buildQuote({
            quoteId: `pq_perf_${i}`,
            providerId: 'turo',
            catalogItemId: 'turo_mustang_gt_miami',
            canonicalUnit: 'VEHICLE_DAY',
            quantity: 1n,
            providerPriceMinorUnits: 40_000n,
          }),
          entitlement: {
            entitlementId,
            entitlementClass: 'MOBILITY_STANDARD',
            availableUnits: 3n,
            canonicalUnit: 'VEHICLE_DAY',
          },
          requestedQuantity: 1n,
          jurisdiction: 'US-FL',
          maxUserContributionMinorUnits: 40_000n,
          policyContext: {
            benefitSource: 'SIMULATION',
            geographicZone: 'Miami, FL',
            serviceLevel: 'STANDARD',
          },
        });
      }),
    );
  }

  const wave1Samples: number[] = [];
  for (let i = 0; i < 50; i += 1) {
    wave1Samples.push(
      await timeMs(() => {
        runAccessWave1({
          service: createAccessSolvencyService(),
          userId: `wave1-user-${i}`,
          now: NOW,
        });
      }),
    );
  }

  const overview = summarizeLatencyMs(overviewSamples);
  const search = summarizeLatencyMs(searchSamples);
  const quote = summarizeLatencyMs(quoteSamples);
  const allocation = summarizeLatencyMs(allocationSamples);
  const wave1 = summarizeLatencyMs(wave1Samples);

  const overviewStatus = evaluateLatencyTarget(QUALIFICATION_TARGETS.access.overview, overview);
  const searchStatus = evaluateLatencyTarget(QUALIFICATION_TARGETS.access.searchQuote, search);

  const stressLatencies: number[] = [];
  let stressErrors = 0;
  const stressStart = performance.now();
  await runConcurrent(50, 250, async (index) => {
    try {
      const ms = await timeMs(() => {
        runAccessWave1({
          service: createAccessSolvencyService(),
          userId: `stress-${index}`,
          now: NOW,
        });
      });
      stressLatencies.push(ms);
    } catch {
      stressErrors += 1;
    }
  });

  cases.push(
    { name: 'overview-read', status: overviewStatus, latency: overview },
    { name: 'provider-search', status: searchStatus, latency: search },
    { name: 'provider-quote', status: evaluateLatencyTarget(QUALIFICATION_TARGETS.access.searchQuote, quote), latency: quote },
    { name: 'coverage-evaluation', status: 'BENCHMARKED', latency: allocation },
    { name: 'wave1-allocation-flow', status: 'BENCHMARKED', latency: wave1 },
    {
      name: 'concurrency-50x250',
      status: 'BENCHMARKED',
      latency: summarizeLatencyMs(stressLatencies),
      throughput: summarizeThroughput({
        requests: 250,
        durationMs: performance.now() - stressStart,
        errors: stressErrors,
      }),
    },
  );

  const suiteStatus: QualificationStatus =
    overviewStatus === 'TARGET_NOT_MET' || searchStatus === 'TARGET_NOT_MET' ? 'TARGET_NOT_MET' : 'TARGET_MET';

  return {
    suite: 'access',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ benchmarkTool: 'access-economy-in-process' }),
    notes: ['Deterministic fixtures — not live provider or payment rail'],
  };
}
