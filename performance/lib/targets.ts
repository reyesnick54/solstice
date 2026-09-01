/**
 * Engineering qualification targets — NOT contractual SLAs.
 *
 * Sources: docs/operations/production-slos.md,
 * docs/productization/SUNREY_LEDGER_PERFORMANCE_BASELINE.md,
 * docs/access/ACCESS_V1_LAUNCH_REPORT.md, access certification harness.
 */

export type TargetClass = 'ENGINEERING_QUALIFICATION_TARGET';

export type LatencyTarget = {
  readonly class: TargetClass;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
  readonly source: string;
};

export type ThroughputTarget = {
  readonly class: TargetClass;
  readonly minRequestsPerSec: number | null;
  readonly maxErrorRate: number;
  readonly source: string;
};

export const QUALIFICATION_TARGETS = {
  api: {
    health: {
      p99Ms: 100,
      note: 'Health is not representative application performance',
      source: 'wave6-prompt16',
    } satisfies LatencyTarget & { readonly note: string },
    authenticatedRead: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: null,
      p95Ms: 500,
      p99Ms: 1000,
      source: 'phase-b-perf.test.ts envelope',
    } satisfies LatencyTarget,
    authenticatedWrite: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: null,
      p95Ms: 1000,
      p99Ms: 2000,
      source: 'wave6-prompt16',
    } satisfies LatencyTarget,
    ledgerAffecting: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: null,
      p95Ms: 2000,
      p99Ms: 5000,
      source: 'wave6-prompt16',
    } satisfies LatencyTarget,
  },
  ledger: {
    posting: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: 50,
      p95Ms: 50,
      p99Ms: 50,
      source: 'SUNREY_LEDGER_PERFORMANCE_BASELINE.md',
    } satisfies LatencyTarget,
    lookup: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: 20,
      p95Ms: 20,
      p99Ms: 20,
      source: 'SUNREY_LEDGER_PERFORMANCE_BASELINE.md',
    } satisfies LatencyTarget,
  },
  access: {
    overview: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: null,
      p95Ms: null,
      p99Ms: 1,
      source: 'ACCESS_V1_LAUNCH_REPORT.md',
    } satisfies LatencyTarget,
    searchQuote: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: null,
      p95Ms: null,
      p99Ms: 50,
      source: 'ACCESS_V1_LAUNCH_REPORT.md',
    } satisfies LatencyTarget,
  },
  exchange: {
    orderIngress: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: null,
      p95Ms: 10,
      p99Ms: 50,
      source: 'phase-g-performance-baseline',
    } satisfies LatencyTarget,
  },
  grow: {
    proposalCreation: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      p50Ms: null,
      p95Ms: 500,
      p99Ms: 2000,
      source: 'wave6-prompt16',
    } satisfies LatencyTarget,
  },
  providers: {
    fanOut: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      minRequestsPerSec: null,
      maxErrorRate: 0.05,
      source: 'wave6-prompt16',
    } satisfies ThroughputTarget,
    partialFailureGraceful: {
      class: 'ENGINEERING_QUALIFICATION_TARGET',
      minRequestsPerSec: null,
      maxErrorRate: 0.5,
      source: 'wave6-prompt16 — partial provider failure must not block all',
    } satisfies ThroughputTarget,
  },
} as const;

export type QualificationStatus =
  | 'BENCHMARKED'
  | 'TARGET_MET'
  | 'TARGET_NOT_MET'
  | 'NOT_TESTED'
  | 'ENVIRONMENT_LIMITED';

export function evaluateLatencyTarget(
  target: LatencyTarget,
  observed: { readonly p95Ms: number; readonly p99Ms: number },
): QualificationStatus {
  if (target.p99Ms !== null && observed.p99Ms > target.p99Ms) return 'TARGET_NOT_MET';
  if (target.p95Ms !== null && observed.p95Ms > target.p95Ms) return 'TARGET_NOT_MET';
  return 'TARGET_MET';
}
