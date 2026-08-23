/**
 * Every observation carries an explicit freshness policy.
 * Stale observations cannot enter time-sensitive valuation without
 * an explicit override that still does not mint.
 */

import type { FreshnessAssessment, FreshnessPolicy } from './types.ts';

export const DEFAULT_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  maxAgeSeconds: 86_400n,
  staleAfterSeconds: 3_600n,
  timeSensitiveValuationRequiresFresh: true,
});

export function assessFreshness(input: {
  readonly timestampUtc: string;
  readonly nowUtc: string;
  readonly policy?: FreshnessPolicy;
}): FreshnessAssessment {
  const policy = input.policy ?? DEFAULT_FRESHNESS_POLICY;
  const ageSeconds = ageBetween(input.timestampUtc, input.nowUtc);
  const expiresAtUtc = addSeconds(input.timestampUtc, policy.maxAgeSeconds);
  let state: FreshnessAssessment['state'] = 'FRESH';
  if (ageSeconds > policy.maxAgeSeconds) {
    state = 'EXPIRED';
  } else if (ageSeconds > policy.staleAfterSeconds) {
    state = 'STALE';
  } else if (ageSeconds > policy.staleAfterSeconds / 2n) {
    state = 'AGING';
  }
  return Object.freeze({
    state,
    ageSeconds,
    expiresAtUtc,
    usableForTimeSensitiveValuation: state === 'FRESH',
  });
}

export function refuseStaleForValuation(freshness: FreshnessAssessment, explicitOverride = false): boolean {
  if (freshness.usableForTimeSensitiveValuation) {
    return false;
  }
  return !explicitOverride;
}

function ageBetween(fromUtc: string, toUtc: string): bigint {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return 0n;
  }
  return BigInt(Math.trunc((to - from) / 1000));
}

function addSeconds(timestampUtc: string, seconds: bigint): string {
  const ms = Date.parse(timestampUtc);
  if (!Number.isFinite(ms)) {
    return timestampUtc;
  }
  return new Date(ms + Number(seconds) * 1000).toISOString();
}
