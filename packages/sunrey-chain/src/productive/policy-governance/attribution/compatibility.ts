/**
 * Compatibility compiler: attribution policy → Chunk 74 allocation rules.
 *
 * Chunk 74 CrossCategoryAllocationRule and CapacityOutputAllocationRule
 * remain the eligibility surface. Attribution is the stronger versioned
 * policy. Historical bundles without attribution still evaluate.
 */

import type { ClaimType, ProductiveCategory } from '../../types.ts';
import type { CapacityOutputAllocationRule, CrossCategoryAllocationRule } from '../types.ts';
import { ATTRIBUTION_SHARE_SCALE } from './constitution.ts';
import type { ProductiveAttributionDecision, ProductiveAttributionPolicy } from './types.ts';

export function compileCrossCategoryAllocation(
  policy: ProductiveAttributionPolicy,
  eventFingerprint: string,
  shares: Readonly<Record<string, bigint>>,
): CrossCategoryAllocationRule {
  return Object.freeze({
    ruleId: `attr.${policy.policyId}.${policy.version}.${eventFingerprint.slice(0, 12)}`,
    eventFingerprint,
    shares,
    shareScale: policy.shareScale,
    governed: true,
    attributionPolicyId: policy.policyId,
    attributionPolicyVersion: policy.version,
  });
}

export function compileCapacityOutputAllocation(
  policy: ProductiveAttributionPolicy,
  objectId: string,
  epoch: number,
  claimShares: Readonly<Record<ClaimType, bigint>>,
): CapacityOutputAllocationRule {
  return Object.freeze({
    ruleId: `attr.capacity.${policy.policyId}.${policy.version}.${objectId}.${epoch}`,
    objectId,
    epoch,
    claimShares,
    shareScale: policy.shareScale,
    governed: true,
    attributionPolicyId: policy.policyId,
    attributionPolicyVersion: policy.version,
  });
}

export function allocationSharesFromDecisions(
  decisions: readonly ProductiveAttributionDecision[],
  economicEventId: string,
): Readonly<Record<string, bigint>> {
  const shares: Record<string, bigint> = {};
  for (const decision of decisions) {
    if (decision.economicEventId !== economicEventId) {
      continue;
    }
    const category = decision.category as ProductiveCategory;
    shares[category] = (shares[category] ?? 0n) + decision.attributionShare;
  }
  return Object.freeze(shares);
}

export function historicalAllocationCompatible(rule: CrossCategoryAllocationRule): boolean {
  return rule.governed === true && rule.shareScale === ATTRIBUTION_SHARE_SCALE;
}
