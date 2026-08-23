import { Money } from '../../../money/src/money.ts';
import { newCompensationPolicyId, newPricingPolicyId } from './ids.ts';
import type { CompensationPolicy, PricingPolicy } from './types.ts';

/**
 * Versioned compensation policy. Shares are integer basis points and
 * must sum to 10_000. This fixture is not approved economic policy.
 */
export function simulationCompensationPolicyV1(): CompensationPolicy {
  return Object.freeze({
    policyId: newCompensationPolicyId(),
    version: 'irm-compensation-v1',
    shares: Object.freeze([
      Object.freeze({
        recipientClass: 'INDIVIDUAL_RIGHTS_HOLDER' as const,
        recipientRef: 'rights_holder',
        basisPoints: 7000,
      }),
      Object.freeze({
        recipientClass: 'CONTRIBUTION_POOL' as const,
        recipientRef: 'contribution_pool',
        basisPoints: 1000,
      }),
      Object.freeze({
        recipientClass: 'COMMUNITY_POOL' as const,
        recipientRef: 'community_pool',
        basisPoints: 1000,
      }),
      Object.freeze({
        recipientClass: 'SUNREY_FEE' as const,
        recipientRef: 'sunrey_fee',
        basisPoints: 1000,
      }),
    ]),
    approvedEconomicPolicy: false,
    simulationFixture: true,
    productionAuthorized: false,
  });
}

export function simulationPricingPolicyV1(): PricingPolicy {
  return Object.freeze({
    policyId: newPricingPolicyId(),
    version: 'irm-pricing-v1',
    model: 'FIXED',
    fixedFiat: Money.fromMinorUnits(2500n, 'USD'),
    auctionEnabled: false,
    llmInvented: false,
  });
}

export function validateCompensationPolicy(policy: CompensationPolicy): string | null {
  if (policy.shares.length === 0) {
    return 'compensation policy must declare recipients';
  }
  const total = policy.shares.reduce((sum, share) => sum + share.basisPoints, 0);
  if (total !== 10_000) {
    return `compensation shares must sum to 10000 bps, got ${total}`;
  }
  for (const share of policy.shares) {
    if (share.basisPoints < 0) {
      return 'compensation share cannot be negative';
    }
  }
  if (policy.approvedEconomicPolicy !== false || policy.productionAuthorized !== false) {
    return 'compensation policy is not production-authorized';
  }
  return null;
}

export function validatePricingPolicy(policy: PricingPolicy): string | null {
  if (policy.auctionEnabled) {
    return 'auction pricing is not supported by the existing marketplace architecture';
  }
  if (policy.llmInvented) {
    return 'LLM-invented contractual pricing is refused';
  }
  if (policy.model === 'FIXED' && !policy.fixedFiat) {
    return 'FIXED pricing requires an explicit configured amount';
  }
  if (policy.model === 'USAGE_BASED' && !policy.usageUnitFiat) {
    return 'USAGE_BASED pricing requires an explicit configured unit amount';
  }
  if (policy.model === 'SUBSCRIPTION' && !policy.subscriptionFiat) {
    return 'SUBSCRIPTION pricing requires an explicit configured amount';
  }
  if (policy.model === 'NEGOTIATED' && !policy.negotiatedFiat) {
    return 'NEGOTIATED pricing requires an explicit configured amount';
  }
  return null;
}
