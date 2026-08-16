import {
  CLAIM_TYPES,
  POLICY_PARAMETER_CLASS,
  PRODUCTIVE_CATEGORIES,
  PRODUCTIVE_SCHEMA_VERSION,
  WEIGHT_SCALE,
  type ClaimType,
  type ProductiveCategory,
  type RoundingMode,
} from './types.ts';

export type MoonReyIssuancePolicy = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly parameterClass: typeof POLICY_PARAMETER_CLASS;
  readonly eligibleCategories: readonly ProductiveCategory[];
  readonly categoryWeight: Readonly<Record<ProductiveCategory, bigint>>;
  readonly claimTypeWeight: Readonly<Record<ClaimType, bigint>>;
  readonly qualityMultiplier: bigint;
  readonly maximumIssuancePerContribution: bigint;
  readonly maximumIssuancePerCategoryPerEpoch: bigint;
  readonly maximumTotalIssuancePerEpoch: bigint;
  readonly maximumIssuancePerObjectPerEpoch: bigint;
  readonly maximumIssuancePerControllerPerEpoch: bigint;
  readonly minimumOracleQuorum: number;
  readonly requiredFactQuality: bigint;
  readonly roundingMode: RoundingMode;
  readonly activationHeight: number;
  readonly countCapacityAsProduction: false;
  readonly countDeliveryIndependentOfOutput: false;
};

export function developmentIssuancePolicy(activationHeight = 1): MoonReyIssuancePolicy {
  const categoryWeight = Object.fromEntries(
    PRODUCTIVE_CATEGORIES.map((category) => [category, defaultCategoryWeight(category)]),
  ) as Record<ProductiveCategory, bigint>;
  const claimTypeWeight = Object.fromEntries(
    CLAIM_TYPES.map((claimType) => [claimType, defaultClaimWeight(claimType)]),
  ) as Record<ClaimType, bigint>;
  return Object.freeze({
    schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
    policyVersion: 1,
    parameterClass: POLICY_PARAMETER_CLASS,
    eligibleCategories: PRODUCTIVE_CATEGORIES,
    categoryWeight: Object.freeze(categoryWeight),
    claimTypeWeight: Object.freeze(claimTypeWeight),
    qualityMultiplier: WEIGHT_SCALE,
    maximumIssuancePerContribution: 10_000_000n,
    maximumIssuancePerCategoryPerEpoch: 50_000_000n,
    maximumTotalIssuancePerEpoch: 100_000_000n,
    maximumIssuancePerObjectPerEpoch: 20_000_000n,
    maximumIssuancePerControllerPerEpoch: 40_000_000n,
    minimumOracleQuorum: 3,
    requiredFactQuality: 500_000n,
    roundingMode: 'FLOOR',
    activationHeight,
    countCapacityAsProduction: false,
    countDeliveryIndependentOfOutput: false,
  });
}

export function policyAtHeight(
  policies: readonly MoonReyIssuancePolicy[],
  height: number,
): MoonReyIssuancePolicy | undefined {
  return [...policies]
    .filter((policy) => policy.activationHeight <= height)
    .sort((left, right) => {
      if (left.activationHeight !== right.activationHeight) {
        return right.activationHeight - left.activationHeight;
      }
      return right.policyVersion - left.policyVersion;
    })[0];
}

function defaultCategoryWeight(category: ProductiveCategory): bigint {
  switch (category) {
    case 'ENERGY':
      return WEIGHT_SCALE;
    case 'AI_COMPUTE':
      return 900_000n;
    case 'COMPUTE':
      return 800_000n;
    case 'MANUFACTURING':
    case 'AUTOMATED_MACHINE_OUTPUT':
      return 700_000n;
    case 'FOOD_AGRICULTURE':
    case 'WATER':
      return 600_000n;
    default:
      return 500_000n;
  }
}

function defaultClaimWeight(claimType: ClaimType): bigint {
  switch (claimType) {
    case 'OUTPUT':
    case 'USAGE':
      return WEIGHT_SCALE;
    case 'DELIVERY':
    case 'CAPACITY':
    case 'RESERVE':
      return 0n;
  }
}
