/**
 * Chunk 74 — MoonRey productive-economy issuance policy types.
 *
 * Extends Chunk 44 without creating a second MoonRey asset or mint path.
 * Canonical asset remains MOONREY_COIN. Public ticker remains NOT_ASSIGNED.
 *
 * NormalizedProductiveUnit is an issuance-calculation quantity. It is not
 * fiat value, market capitalization, legal property title, or guaranteed
 * economic value.
 */

import {
  CLAIM_TYPES,
  PRODUCTIVE_CATEGORIES,
  PRODUCTIVE_SCHEMA_VERSION,
  WEIGHT_SCALE,
  type ClaimType,
  type ProductiveCategory,
  type ProductiveRejectionCode,
  type RoundingMode,
} from '../types.ts';

export const POLICY_GOVERNANCE_SCHEMA_VERSION = 1 as const;
export const POLICY_GOVERNANCE_DOMAIN = 'SUNREY_MOONREY_POLICY_V1' as const;
export const CROSS_CATEGORY_DOMAIN = 'SUNREY_MOONREY_EVENT_V1' as const;
export const CAPACITY_OUTPUT_DOMAIN = 'SUNREY_MOONREY_ASSET_EVENT_V1' as const;
export const NORMALIZED_PRODUCTIVE_UNIT_ID = 'NPU' as const;
export const CANONICAL_MOONREY_ASSET_ID = 'MOONREY_COIN' as const;
export const PUBLIC_MOONREY_TICKER = 'NOT_ASSIGNED' as const;
export const SIMULATION_CLASSIFICATION = 'ENGINEERING_ECONOMIC_SIMULATION' as const;
export const UNCONFIGURED = 'UNCONFIGURED' as const;
export const DEFAULT_EPOCH_LENGTH_HEIGHTS = 100 as const;
export const FACTOR_BOUND_MIN = 0n;
export const FACTOR_BOUND_MAX = 2_000_000n;

export type Unconfigured = typeof UNCONFIGURED;
export type BudgetBound = bigint | Unconfigured;

/**
 * Productive domains named in Chunk 74 map onto the canonical Chunk 44
 * taxonomy. Do not invent a second category enum.
 */
export const PRODUCTIVE_DOMAIN_ALIASES = Object.freeze({
  ENERGY: 'ENERGY',
  COMPUTE: 'COMPUTE',
  AI_INFERENCE: 'AI_COMPUTE',
  ROBOTICS: 'AUTOMATED_MACHINE_OUTPUT',
  MANUFACTURING: 'MANUFACTURING',
  FOOD_AGRICULTURE: 'FOOD_AGRICULTURE',
  WATER: 'WATER',
  STORAGE: 'STORAGE',
  LOGISTICS: 'LOGISTICS_TRANSPORTATION',
  BANDWIDTH: 'BANDWIDTH_COMMUNICATIONS',
  REAL_ESTATE_UTILIZATION: 'REAL_ESTATE_USE',
  NATURAL_RESOURCE_OUTPUT: 'MINERALS_RAW_MATERIALS',
  SERVICE_OUTPUT: 'SERVICES',
} as const satisfies Readonly<Record<string, ProductiveCategory>>);

export type ProductiveDomainAlias = keyof typeof PRODUCTIVE_DOMAIN_ALIASES;

export const DELIVERY_STATES = [
  'INSTALLED_CAPACITY',
  'AVAILABLE_CAPACITY',
  'RESERVED_CAPACITY',
  'ACTUAL_OUTPUT',
  'VERIFIED_DELIVERY',
  'ECONOMIC_SERVICE_COMPLETION',
] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const GOVERNANCE_ACTOR_KINDS = [
  'PROTOCOL_GOVERNANCE',
  'HUMAN_GOVERNANCE',
  'AI_PROPOSAL',
] as const;
export type GovernanceActorKind = (typeof GOVERNANCE_ACTOR_KINDS)[number];

export const POLICY_REJECTION_CODES = [
  'CROSS_CATEGORY_DUPLICATE',
  'CAPACITY_OUTPUT_DUPLICATE',
  'WRONG_POLICY_VERSION',
  'POLICY_NOT_YET_ACTIVE',
  'POLICY_REPLAY',
  'REFERENCE_FACT_MISSING',
  'REFERENCE_FACT_STALE',
  'REFERENCE_FACT_CONFLICTED',
  'WRONG_UNIT',
  'MALFORMED_NORMALIZATION',
  'ACTOR_ISSUANCE_CAP',
  'AI_CANNOT_ACTIVATE_POLICY',
  'ALLOCATION_REQUIRED',
  'PROVIDER_INELIGIBLE',
  'LINEAGE_INCOMPLETE',
  'TIME_WINDOW_INVALID',
  'SOURCE_QUALITY_BELOW_MINIMUM',
  'ARBITRARY_MINT_UNAVAILABLE',
  'OBJECT_INELIGIBLE',
  'FACT_FRESHNESS_EXPIRED',
  'BUDGET_UNAVAILABLE',
] as const;
export type PolicyRejectionCode = (typeof POLICY_REJECTION_CODES)[number];

export type MoonReyPolicyDecisionCode = ProductiveRejectionCode | PolicyRejectionCode;

export type PolicyFactor = {
  readonly factorId: string;
  readonly version: number;
  readonly value: bigint;
  readonly min: bigint;
  readonly max: bigint;
  readonly auditable: true;
};

export type ProductiveCategoryPolicy = {
  readonly schemaVersion: typeof POLICY_GOVERNANCE_SCHEMA_VERSION;
  readonly category: ProductiveCategory;
  readonly aliases: readonly ProductiveDomainAlias[];
  readonly eligible: boolean;
  readonly sourceUnits: readonly string[];
  readonly baseUnitId: string;
  readonly unitNormalization: PolicyFactor;
  readonly quality: PolicyFactor;
  readonly verifiedDeliveryState: PolicyFactor;
  readonly economicCategory: PolicyFactor;
  readonly activationHeight: number;
  readonly policyVersion: number;
};

export type ProductiveNormalizationRule = {
  readonly schemaVersion: typeof POLICY_GOVERNANCE_SCHEMA_VERSION;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly category: ProductiveCategory;
  readonly sourceUnitId: string;
  readonly targetUnitId: typeof NORMALIZED_PRODUCTIVE_UNIT_ID;
  readonly scaleToNpu: bigint;
  readonly factors: readonly PolicyFactor[];
  readonly roundingMode: RoundingMode;
  readonly activationHeight: number;
  readonly mixesIncompatibleUnits: false;
};

export type NormalizedProductiveUnit = {
  readonly unitId: typeof NORMALIZED_PRODUCTIVE_UNIT_ID;
  readonly category: ProductiveCategory;
  readonly quantity: bigint;
  readonly sourceUnitId: string;
  readonly sourceQuantity: bigint;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly factorsApplied: readonly PolicyFactor[];
  readonly notFiatValue: true;
  readonly notMarketCapitalization: true;
  readonly notLegalPropertyTitle: true;
  readonly notGuaranteedEconomicValue: true;
};

export type ContributionValueBasis = {
  readonly schemaVersion: typeof POLICY_GOVERNANCE_SCHEMA_VERSION;
  readonly contributionId: string;
  readonly npu: NormalizedProductiveUnit;
  readonly issuanceBasis: bigint;
  readonly formulaVersion: string;
  readonly policyVersion: number;
};

export type IssuanceBudgetPolicy = {
  readonly schemaVersion: typeof POLICY_GOVERNANCE_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS';
  readonly perContribution: BudgetBound;
  readonly perProductiveObject: BudgetBound;
  readonly perActor: BudgetBound;
  readonly perCategory: BudgetBound;
  readonly perEpoch: BudgetBound;
  readonly globalEpoch: BudgetBound;
  readonly productionCaps: 'UNCONFIGURED';
};

export type ContributionEligibilityPolicy = {
  readonly schemaVersion: typeof POLICY_GOVERNANCE_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly requireCategoryEligibility: true;
  readonly requireObjectEligibility: true;
  readonly requireProviderEligibility: true;
  readonly requireOracleQuorum: true;
  readonly requireFactFreshness: true;
  readonly requireSourceQuality: true;
  readonly requireContributionLineage: true;
  readonly requireTimeWindow: true;
  readonly rejectDuplicates: true;
  readonly requireMatchingPolicyVersion: true;
  readonly requireBudgetAvailability: true;
  readonly requireReferenceFactsCanonical: true;
  readonly capacityIsNotDelivery: true;
  readonly minimumOracleQuorum: number;
  readonly requiredFactQuality: bigint;
  readonly maxFactAgeEpochs: number;
  readonly eligibleProviders: readonly string[] | 'ANY_REGISTERED';
};

export type CrossCategoryAllocationRule = {
  readonly ruleId: string;
  readonly eventFingerprint: string;
  readonly shares: Readonly<Record<string, bigint>>;
  readonly shareScale: bigint;
  readonly governed: true;
};

export type CapacityOutputAllocationRule = {
  readonly ruleId: string;
  readonly objectId: string;
  readonly epoch: number;
  readonly claimShares: Readonly<Record<ClaimType, bigint>>;
  readonly shareScale: bigint;
  readonly governed: true;
};

export type IssuanceEpoch = {
  readonly epoch: number;
  readonly startHeight: number;
  readonly endHeightExclusive: number;
  readonly lengthHeights: number;
};

export type MoonReyIssuancePolicyBundle = {
  readonly schemaVersion: typeof POLICY_GOVERNANCE_SCHEMA_VERSION;
  readonly policyVersion: number;
  readonly contentHash: string;
  readonly activationHeight: number;
  readonly epochLengthHeights: number;
  readonly eligibleCategories: readonly ProductiveCategory[];
  readonly categoryPolicies: readonly ProductiveCategoryPolicy[];
  readonly normalizationRules: readonly ProductiveNormalizationRule[];
  readonly eligibility: ContributionEligibilityPolicy;
  readonly budget: IssuanceBudgetPolicy;
  readonly referenceFactKeys: readonly string[];
  readonly crossCategoryAllocations: readonly CrossCategoryAllocationRule[];
  readonly capacityOutputAllocations: readonly CapacityOutputAllocationRule[];
  readonly concentrationWarnBps: number;
  readonly parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS';
  readonly roundingMode: RoundingMode;
};

export type PolicyActivationRecord = {
  readonly policyVersion: number;
  readonly contentHash: string;
  readonly activationHeight: number;
  readonly actorKind: GovernanceActorKind;
  readonly actorId: string;
  readonly activated: boolean;
  readonly rejection?: PolicyRejectionCode;
};

export { CLAIM_TYPES, PRODUCTIVE_CATEGORIES, PRODUCTIVE_SCHEMA_VERSION, WEIGHT_SCALE };
export type { ClaimType, ProductiveCategory, ProductiveRejectionCode, RoundingMode };
