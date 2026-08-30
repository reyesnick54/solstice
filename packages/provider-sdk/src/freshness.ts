/**
 * Freshness assessment from provider/capability policy.
 * TTL is never global — each capability supplies its own policy.
 */

import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import type { FreshnessStatus } from './types.ts';

export type FreshnessPolicy = {
  /** Seconds after source timestamp before state becomes aging. */
  readonly agingAfterSeconds: bigint;
  /** Seconds after source timestamp before state becomes stale. */
  readonly staleAfterSeconds: bigint;
  /** Seconds after source timestamp before state becomes expired. */
  readonly expiredAfterSeconds: bigint;
};

export type FreshnessAssessment = {
  readonly status: FreshnessStatus;
  readonly ageSeconds: bigint | null;
  readonly assessedAt: UtcInstant;
  readonly referenceTimestamp: UtcInstant | null;
};

export const MARKET_PRICE_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 30n,
  staleAfterSeconds: 120n,
  expiredAfterSeconds: 600n,
});

export const MACRO_STATISTIC_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 604_800n,
  staleAfterSeconds: 2_592_000n,
  expiredAfterSeconds: 7_776_000n,
});

export function assessFreshness(input: {
  readonly referenceTimestamp: UtcInstant | null;
  readonly nowUtc: UtcInstant;
  readonly policy?: FreshnessPolicy;
}): FreshnessAssessment {
  const assessedAt = input.nowUtc;
  if (!input.referenceTimestamp) {
    return Object.freeze({
      status: 'unknown',
      ageSeconds: null,
      assessedAt,
      referenceTimestamp: null,
    });
  }
  const policy = input.policy ?? MARKET_PRICE_FRESHNESS_POLICY;
  const ageSeconds = ageBetween(input.referenceTimestamp, input.nowUtc);
  let status: FreshnessStatus = 'fresh';
  if (ageSeconds >= policy.expiredAfterSeconds) {
    status = 'expired';
  } else if (ageSeconds >= policy.staleAfterSeconds) {
    status = 'stale';
  } else if (ageSeconds >= policy.agingAfterSeconds) {
    status = 'aging';
  }
  return Object.freeze({
    status,
    ageSeconds,
    assessedAt,
    referenceTimestamp: input.referenceTimestamp,
  });
}

export function staleAfterFromPolicy(
  referenceTimestamp: UtcInstant,
  policy: FreshnessPolicy,
): UtcInstant {
  return addSeconds(referenceTimestamp, policy.staleAfterSeconds);
}

export function expiresAtFromPolicy(
  referenceTimestamp: UtcInstant,
  policy: FreshnessPolicy,
): UtcInstant {
  return addSeconds(referenceTimestamp, policy.expiredAfterSeconds);
}

function ageBetween(fromUtc: UtcInstant, toUtc: UtcInstant): bigint {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return 0n;
  }
  return BigInt(Math.trunc((to - from) / 1000));
}

function addSeconds(timestampUtc: UtcInstant, seconds: bigint): UtcInstant {
  const ms = Date.parse(timestampUtc);
  if (!Number.isFinite(ms)) {
    throw new TypeError(`Invalid UTC instant: ${timestampUtc}`);
  }
  return asUtcInstant(new Date(ms + Number(seconds) * 1000).toISOString());
}
