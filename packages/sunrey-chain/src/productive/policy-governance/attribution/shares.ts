/**
 * Deterministic fixed-point attribution shares.
 *
 * Scale: 1_000_000 = 100%. Quantities are bigint. Invalid shares are
 * rejected. They are never silently normalized.
 */

import { ATTRIBUTION_SHARE_SCALE } from './constitution.ts';
import type { AttributionShareValidation, ProductiveAttributionPolicy } from './types.ts';

export function validateShare(
  share: bigint,
  maximumAggregateShare: bigint = ATTRIBUTION_SHARE_SCALE,
): AttributionShareValidation {
  if (share < 0n) {
    return { ok: false, code: 'NEGATIVE_SHARE' };
  }
  if (share > maximumAggregateShare) {
    return { ok: false, code: 'SHARE_EXCEEDS_BOUND' };
  }
  return { ok: true };
}

export function validateShareSet(
  shares: readonly bigint[],
  maximumAggregateShare: bigint = ATTRIBUTION_SHARE_SCALE,
): AttributionShareValidation {
  let total = 0n;
  for (const share of shares) {
    const single = validateShare(share, maximumAggregateShare);
    if (!single.ok) {
      return single;
    }
    total += share;
  }
  if (total > maximumAggregateShare) {
    return { ok: false, code: 'AGGREGATE_SHARE_EXCEEDS_BOUND' };
  }
  return { ok: true };
}

export function fullShare(policy: ProductiveAttributionPolicy): bigint {
  return policy.shareScale;
}

export function zeroShare(): bigint {
  return 0n;
}

export function policyShareBound(policy: ProductiveAttributionPolicy): bigint {
  return policy.maximumAggregateShare;
}
