/**
 * ACCESS Wave 3 Prompt 34 — Versioned checkout coverage policy framework.
 *
 * Configurable cost eligibility and coverage caps. Business policy is not
 * hard-coded in the engine; policies are registered and versioned.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessCostClassification } from './types.ts';
import type { ProviderQuoteCostLine } from './types.ts';

export type CostTypePolicy = 'ACCESS_ELIGIBLE' | 'USER_RESPONSIBILITY' | 'POLICY_EVALUATED';

export type AccessCheckoutCoveragePolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly category: string;
  readonly enabled: boolean;
  readonly effectiveFrom: UtcInstant;
  readonly eligibleCostTypes: Readonly<Record<ProviderQuoteCostLine['costType'], CostTypePolicy>>;
  readonly taxPolicy: CostTypePolicy;
  readonly mandatoryFeePolicy: CostTypePolicy;
  readonly optionalFeePolicy: CostTypePolicy;
  readonly depositPolicy: CostTypePolicy;
  readonly coverageCaps: {
    readonly perTransactionMinorUnits: bigint | null;
    readonly perCategoryMinorUnits: bigint | null;
    readonly perAllocationPeriodMinorUnits: bigint | null;
    readonly perUserMinorUnits: bigint | null;
    readonly programMinorUnits: bigint | null;
    readonly perProviderMinorUnits: bigint | null;
  };
};

const DEFAULT_ELIGIBLE_COST_TYPES: Readonly<Record<ProviderQuoteCostLine['costType'], CostTypePolicy>> =
  Object.freeze({
    BASE: 'ACCESS_ELIGIBLE',
    TAX: 'POLICY_EVALUATED',
    MANDATORY_FEE: 'POLICY_EVALUATED',
    OPTIONAL_FEE: 'USER_RESPONSIBILITY',
    SECURITY_DEPOSIT: 'USER_RESPONSIBILITY',
    CONTINGENT_LIABILITY: 'USER_RESPONSIBILITY',
    OTHER: 'USER_RESPONSIBILITY',
  });

function mobilityDefaultPolicy(): AccessCheckoutCoveragePolicy {
  return Object.freeze({
    policyId: 'MOBILITY_CHECKOUT_STANDARD',
    version: 'v1',
    category: 'MOBILITY',
    enabled: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    eligibleCostTypes: DEFAULT_ELIGIBLE_COST_TYPES,
    taxPolicy: 'ACCESS_ELIGIBLE',
    mandatoryFeePolicy: 'ACCESS_ELIGIBLE',
    optionalFeePolicy: 'USER_RESPONSIBILITY',
    depositPolicy: 'USER_RESPONSIBILITY',
    coverageCaps: Object.freeze({
      perTransactionMinorUnits: null,
      perCategoryMinorUnits: null,
      perAllocationPeriodMinorUnits: null,
      perUserMinorUnits: null,
      programMinorUnits: null,
      perProviderMinorUnits: null,
    }),
  });
}

function stayDefaultPolicy(): AccessCheckoutCoveragePolicy {
  return Object.freeze({
    policyId: 'STAY_CHECKOUT_STANDARD',
    version: 'v1',
    category: 'STAY',
    enabled: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    eligibleCostTypes: DEFAULT_ELIGIBLE_COST_TYPES,
    taxPolicy: 'ACCESS_ELIGIBLE',
    mandatoryFeePolicy: 'ACCESS_ELIGIBLE',
    optionalFeePolicy: 'USER_RESPONSIBILITY',
    depositPolicy: 'USER_RESPONSIBILITY',
    coverageCaps: Object.freeze({
      perTransactionMinorUnits: null,
      perCategoryMinorUnits: null,
      perAllocationPeriodMinorUnits: null,
      perUserMinorUnits: null,
      programMinorUnits: null,
      perProviderMinorUnits: null,
    }),
  });
}

function foodDefaultPolicy(): AccessCheckoutCoveragePolicy {
  return Object.freeze({
    policyId: 'FOOD_CHECKOUT_STANDARD',
    version: 'v1',
    category: 'FOOD',
    enabled: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    eligibleCostTypes: DEFAULT_ELIGIBLE_COST_TYPES,
    taxPolicy: 'ACCESS_ELIGIBLE',
    mandatoryFeePolicy: 'POLICY_EVALUATED',
    optionalFeePolicy: 'USER_RESPONSIBILITY',
    depositPolicy: 'USER_RESPONSIBILITY',
    coverageCaps: Object.freeze({
      perTransactionMinorUnits: null,
      perCategoryMinorUnits: null,
      perAllocationPeriodMinorUnits: null,
      perUserMinorUnits: null,
      programMinorUnits: null,
      perProviderMinorUnits: null,
    }),
  });
}

function goodsDefaultPolicy(): AccessCheckoutCoveragePolicy {
  return Object.freeze({
    policyId: 'GOODS_CHECKOUT_STANDARD',
    version: 'v1',
    category: 'GOODS',
    enabled: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    eligibleCostTypes: DEFAULT_ELIGIBLE_COST_TYPES,
    taxPolicy: 'ACCESS_ELIGIBLE',
    mandatoryFeePolicy: 'POLICY_EVALUATED',
    optionalFeePolicy: 'USER_RESPONSIBILITY',
    depositPolicy: 'USER_RESPONSIBILITY',
    coverageCaps: Object.freeze({
      perTransactionMinorUnits: null,
      perCategoryMinorUnits: null,
      perAllocationPeriodMinorUnits: null,
      perUserMinorUnits: null,
      programMinorUnits: null,
      perProviderMinorUnits: null,
    }),
  });
}

const DEFAULT_POLICIES: readonly AccessCheckoutCoveragePolicy[] = Object.freeze([
  mobilityDefaultPolicy(),
  stayDefaultPolicy(),
  foodDefaultPolicy(),
  goodsDefaultPolicy(),
]);

export class AccessCheckoutCoveragePolicyRegistry {
  private readonly policies = new Map<string, AccessCheckoutCoveragePolicy>();

  constructor(seed: readonly AccessCheckoutCoveragePolicy[] = DEFAULT_POLICIES) {
    for (const policy of seed) {
      this.register(policy);
    }
  }

  register(policy: AccessCheckoutCoveragePolicy): void {
    this.policies.set(`${policy.category}:${policy.policyId}:${policy.version}`, policy);
  }

  resolve(category: string, now: UtcInstant): AccessCheckoutCoveragePolicy | null {
    const matches = [...this.policies.values()].filter(
      (policy) =>
        policy.category === category &&
        policy.enabled &&
        policy.effectiveFrom <= now,
    );
    if (matches.length === 0) {
      return null;
    }
    return matches.sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0] ?? null;
  }

  list(): readonly AccessCheckoutCoveragePolicy[] {
    return Object.freeze([...this.policies.values()]);
  }
}

export function classifyCostLine(
  line: ProviderQuoteCostLine,
  policy: AccessCheckoutCoveragePolicy,
): AccessCostClassification {
  const typePolicy = policy.eligibleCostTypes[line.costType] ?? 'USER_RESPONSIBILITY';

  if (typePolicy === 'ACCESS_ELIGIBLE') {
    return 'ACCESS_ELIGIBLE';
  }
  if (typePolicy === 'USER_RESPONSIBILITY') {
    if (line.costType === 'SECURITY_DEPOSIT') {
      return 'SECURITY_DEPOSIT';
    }
    if (line.costType === 'CONTINGENT_LIABILITY') {
      return 'CONTINGENT_LIABILITY';
    }
    if (line.costType === 'OPTIONAL_FEE') {
      return 'OPTIONAL_FEE';
    }
    return 'USER_RESPONSIBILITY';
  }

  if (line.costType === 'TAX') {
    return policy.taxPolicy === 'ACCESS_ELIGIBLE' ? 'ACCESS_ELIGIBLE' : 'TAX';
  }
  if (line.costType === 'MANDATORY_FEE') {
    return policy.mandatoryFeePolicy === 'ACCESS_ELIGIBLE' ? 'ACCESS_ELIGIBLE' : 'MANDATORY_FEE';
  }
  if (line.costType === 'OPTIONAL_FEE') {
    return policy.optionalFeePolicy === 'ACCESS_ELIGIBLE' ? 'ACCESS_ELIGIBLE' : 'OPTIONAL_FEE';
  }
  if (line.costType === 'SECURITY_DEPOSIT') {
    return 'SECURITY_DEPOSIT';
  }
  if (line.costType === 'CONTINGENT_LIABILITY') {
    return 'CONTINGENT_LIABILITY';
  }

  return 'INELIGIBLE';
}

export function applyCoverageCaps(
  eligibleAmount: bigint,
  policy: AccessCheckoutCoveragePolicy,
  caps: {
    readonly programCoverageRemainingMinorUnits?: bigint | null;
    readonly transactionCoverageCapMinorUnits?: bigint | null;
  },
): bigint {
  let capped = eligibleAmount;
  const limits = [
    policy.coverageCaps.perTransactionMinorUnits,
    policy.coverageCaps.perCategoryMinorUnits,
    policy.coverageCaps.perAllocationPeriodMinorUnits,
    policy.coverageCaps.perUserMinorUnits,
    policy.coverageCaps.programMinorUnits,
    policy.coverageCaps.perProviderMinorUnits,
    caps.transactionCoverageCapMinorUnits ?? null,
    caps.programCoverageRemainingMinorUnits ?? null,
  ];
  for (const limit of limits) {
    if (limit !== null && capped > limit) {
      capped = limit;
    }
  }
  return capped;
}
