/**
 * Typed freshness policies per observation/product type.
 * No single global threshold — each observation type carries its own policy.
 */

import {
  assessFreshness,
  expiresAtFromPolicy,
  MACRO_STATISTIC_FRESHNESS_POLICY,
  MARKET_PRICE_FRESHNESS_POLICY,
  staleAfterFromPolicy,
  type FreshnessPolicy,
} from '../../../../provider-sdk/src/freshness.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { HeliosFreshnessAssessment, ObservationType } from './types.ts';

export const TICK_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 5n,
  staleAfterSeconds: 30n,
  expiredAfterSeconds: 120n,
});

export const QUOTE_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 15n,
  staleAfterSeconds: 60n,
  expiredAfterSeconds: 300n,
});

export const DAILY_PRICE_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 86_400n,
  staleAfterSeconds: 172_800n,
  expiredAfterSeconds: 604_800n,
});

export const CORPORATE_FILING_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 2_592_000n,
  staleAfterSeconds: 7_776_000n,
  expiredAfterSeconds: 25_920_000n,
});

export const ECONOMIC_RELEASE_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 3_600n,
  staleAfterSeconds: 86_400n,
  expiredAfterSeconds: 604_800n,
});

export const REFERENCE_METADATA_FRESHNESS_POLICY: FreshnessPolicy = Object.freeze({
  agingAfterSeconds: 604_800n,
  staleAfterSeconds: 2_592_000n,
  expiredAfterSeconds: 7_776_000n,
});

const POLICY_BY_TYPE: Record<ObservationType, { policyId: string; policy: FreshnessPolicy }> = {
  tick: { policyId: 'helios-freshness-tick', policy: TICK_FRESHNESS_POLICY },
  quote: { policyId: 'helios-freshness-quote', policy: QUOTE_FRESHNESS_POLICY },
  daily_price: { policyId: 'helios-freshness-daily-price', policy: DAILY_PRICE_FRESHNESS_POLICY },
  corporate_filing: { policyId: 'helios-freshness-corporate-filing', policy: CORPORATE_FILING_FRESHNESS_POLICY },
  economic_release: { policyId: 'helios-freshness-economic-release', policy: ECONOMIC_RELEASE_FRESHNESS_POLICY },
  reference_metadata: { policyId: 'helios-freshness-reference-metadata', policy: REFERENCE_METADATA_FRESHNESS_POLICY },
  other: { policyId: 'helios-freshness-other', policy: MARKET_PRICE_FRESHNESS_POLICY },
};

export function freshnessPolicyFor(observationType: ObservationType): FreshnessPolicy {
  return POLICY_BY_TYPE[observationType].policy;
}

export function freshnessPolicyIdFor(observationType: ObservationType): string {
  return POLICY_BY_TYPE[observationType].policyId;
}

export function assessHeliosFreshness(input: {
  readonly observationType: ObservationType;
  readonly referenceTimestamp: UtcInstant | null;
  readonly nowUtc: UtcInstant;
}): HeliosFreshnessAssessment {
  const { policyId, policy } = POLICY_BY_TYPE[input.observationType];
  const assessment = assessFreshness({
    referenceTimestamp: input.referenceTimestamp,
    nowUtc: input.nowUtc,
    policy,
  });
  const staleAfter =
    input.referenceTimestamp ? staleAfterFromPolicy(input.referenceTimestamp, policy) : null;
  return Object.freeze({
    ...assessment,
    policyId,
    staleAfter,
    observationType: input.observationType,
  });
}

export function isFreshnessDegraded(status: HeliosFreshnessAssessment['status']): boolean {
  return status === 'stale' || status === 'expired';
}

export { MACRO_STATISTIC_FRESHNESS_POLICY, expiresAtFromPolicy };
