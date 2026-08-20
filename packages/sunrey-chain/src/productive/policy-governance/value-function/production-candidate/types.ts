/**
 * Chunk 146 — MoonRey production-candidate Productive Value types.
 *
 * This module describes future production-candidate policy. It does not
 * activate production Productive Value, invent GPUV values, or mint.
 *
 * GPUV is not a physical unit, fiat, market price, or MoonRey, and it
 * does not guarantee economic value.
 */

import type { FactType } from '../../../../oracle/types.ts';
import type { ClaimType, ProductiveCategory } from '../../../types.ts';
import {
  FORBIDDEN_VALUE_FACTOR_TYPES,
  VALUE_FACTOR_TYPES,
  type MissingInputBehavior,
  type RealizationState,
  type ReservedValueFactorType,
  type ValueFactorType,
} from '../types.ts';

export const PRODUCTION_CANDIDATE_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_CANDIDATE_DOMAIN = 'SUNREY_MOONREY_PRODUCTION_CANDIDATE_V1' as const;
export const PRODUCTION_CANDIDATE_POLICY_ID = 'moonrey.productive-value.production-candidate.v1' as const;
export const VALUE_UNCONFIGURED = 'VALUE_UNCONFIGURED' as const;
export const GOVERNED_VALUE_V2 = 'GOVERNED_VALUE_V2' as const;
export const LEGACY_ENGINEERING_SIMULATION_V1 = 'LEGACY_ENGINEERING_SIMULATION_V1' as const;
export const REHEARSAL_ONLY = 'REHEARSAL_ONLY' as const;
export const PRODUCTION_CANDIDATE_SOURCE_CLASS = 'PRODUCTION_CANDIDATE' as const;

export const GPUV_IS_NOT_PHYSICAL_UNIT = true as const;
export const GPUV_IS_NOT_FIAT = true as const;
export const GPUV_IS_NOT_MARKET_PRICE = true as const;
export const GPUV_IS_NOT_MOONREY = true as const;
export const GPUV_DOES_NOT_GUARANTEE_ECONOMIC_VALUE = true as const;
export const GPUV_EQUALS_MOONREY_BY_DEFINITION = false as const;
export const PRODUCTION_ACTIVATED = false as const;
export const PRODUCTION_GPUV_VALUES_SELECTED = false as const;
export const FIXTURE_AUTHORIZES_PRODUCTION = false as const;
export const MOONREY_MARKET_PRICE_FEEDS_PVF = false as const;
export const LEGACY_V1_PRODUCTION_ELIGIBLE = false as const;
export const REFERENCE_PRICE_CAN_CREATE_CLAIM = false as const;
export const REFERENCE_PRICE_CAN_CREATE_CONTRIBUTION = false as const;
export const REFERENCE_PRICE_CAN_CREATE_GPUV_ALONE = false as const;
export const REFERENCE_PRICE_CAN_MINT_MOONREY = false as const;
export const IMPLICIT_FULL_ATTRIBUTION_ALLOWED = false as const;
export const CATEGORY_CAPS_EQUAL_ALLOCATION = false as const;
export const AI_SELECTED_CATEGORY_WEIGHTING = false as const;

export const CATEGORY_COVERAGE_STATUSES = [
  'CONFIGURED_CANDIDATE',
  'UNCONFIGURED',
  'NOT_INTENDED_FOR_ACTIVATION',
  'UNIT_GAP',
  'SEMANTIC_REVIEW_REQUIRED',
  'PROVIDER_GAP',
] as const;
export type CategoryCoverageStatus = (typeof CATEGORY_COVERAGE_STATUSES)[number];

export const PRODUCTION_CANDIDATE_SOURCE_CLASSES = [
  'UNCONFIGURED',
  'PRODUCTION_CANDIDATE',
  'REHEARSAL_ONLY',
  'FIXTURE',
  'ENGINEERING_SIMULATION_PARAMETERS',
] as const;
export type ProductionCandidateSourceClass = (typeof PRODUCTION_CANDIDATE_SOURCE_CLASSES)[number];

export const PRODUCTION_FORBIDDEN_FACTOR_TYPES = [
  ...FORBIDDEN_VALUE_FACTOR_TYPES,
  'MOONREY_MARKET_PRICE_FACTOR',
  'UNVERIFIED_PRICE_MULTIPLIER',
  'ARBITRARY_GEOGRAPHY_PREFERENCE',
  'UNBOUNDED_SCARCITY_MULTIPLIER',
  'PROVIDER_SELF_REPORTED_ECONOMIC_VALUE_MULTIPLIER',
] as const;
export type ProductionForbiddenFactorType = (typeof PRODUCTION_FORBIDDEN_FACTOR_TYPES)[number];

export const FORBIDDEN_PRICE_FEEDBACK_LOOPS = [
  'MOONREY_MARKET_PRICE_TO_PRODUCTIVE_VALUE_TO_MOONREY_ISSUANCE',
  'MOONREY_ISSUANCE_TO_ARTIFICIAL_SCARCITY_TO_HIGHER_GPUV_TO_MORE_MOONREY',
] as const;
export type ForbiddenPriceFeedbackLoop = (typeof FORBIDDEN_PRICE_FEEDBACK_LOOPS)[number];

export const FORBIDDEN_AUTHORIZATION_ACTORS = [
  'AI',
  'S3M',
  'GROK',
  'MODEL',
  'ORACLE_PROVIDER',
  'PRODUCTIVE_CONTROLLER',
  'DATA_PROVIDER',
  'FINANCIAL_AGENT',
] as const;
export type ForbiddenAuthorizationActor = (typeof FORBIDDEN_AUTHORIZATION_ACTORS)[number];

export const EXCLUSIVE_ATTRIBUTION_GROUPS = [
  ['MANUFACTURING', 'AUTOMATED_MACHINE_OUTPUT'],
  ['GOODS', 'MANUFACTURING'],
  ['LOGISTICS_TRANSPORTATION', 'GOODS'],
  ['COMPUTE', 'AI_COMPUTE'],
  ['REAL_ESTATE_USE', 'INFRASTRUCTURE'],
] as const satisfies readonly (readonly ProductiveCategory[])[];

export const PRODUCTION_CANDIDATE_REJECTION_CODES = [
  'VALUE_UNCONFIGURED',
  'FLOAT_MATH_FORBIDDEN',
  'INCOMPATIBLE_UNIT',
  'SEMANTIC_MISMATCH',
  'ATTRIBUTION_REQUIRED',
  'ATTRIBUTION_SHARE_MISSING',
  'IMPLICIT_FULL_ATTRIBUTION_FORBIDDEN',
  'DUPLICATE_EVENT_FULL_CREDIT',
  'REFERENCE_PRICE_ALONE_CANNOT_VALUE',
  'REFERENCE_PRICE_ALONE_CANNOT_ISSUE',
  'MOONREY_MARKET_PRICE_FORBIDDEN',
  'SELF_REFERENTIAL_PRICE_FEEDBACK',
  'UNBOUNDED_SCARCITY_REJECTED',
  'SCARCITY_NOT_EVIDENCE_BOUND',
  'AI_FACTOR_REJECTED',
  'PROVIDER_SELF_VALUE_FACTOR_REJECTED',
  'FORBIDDEN_FACTOR',
  'RESERVED_FACTOR_NOT_IMPLEMENTED',
  'LEGACY_V1_CANNOT_QUALIFY_PRODUCTION',
  'FIXTURE_V2_CANNOT_QUALIFY_PRODUCTION',
  'AI_CANNOT_AUTHORIZE',
  'S3M_CANNOT_AUTHORIZE',
  'GROK_CANNOT_AUTHORIZE',
  'MODEL_CANNOT_AUTHORIZE',
  'PROVIDER_CANNOT_AUTHORIZE',
  'CONTROLLER_CANNOT_AUTHORIZE',
  'GPUV_RESULT_CANNOT_MINT',
  'PRODUCTION_CANDIDATE_CANNOT_ACTIVATE',
  'PRODUCTION_VALUES_NOT_SELECTED',
  'DENOMINATOR_ZERO',
  'INCOMPLETE_EVIDENCE_CHAIN',
] as const;
export type ProductionCandidateRejectionCode = (typeof PRODUCTION_CANDIDATE_REJECTION_CODES)[number];

export type ProductionCandidateOk<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ProductionCandidateRefusal = {
  readonly ok: false;
  readonly code: ProductionCandidateRejectionCode;
  readonly detail: string;
};

export type ProductionCandidateResult<T> = ProductionCandidateOk<T> | ProductionCandidateRefusal;

export function productionCandidateOk<T>(value: T): ProductionCandidateOk<T> {
  return Object.freeze({ ok: true, value });
}

export function productionCandidateRefuse(
  code: ProductionCandidateRejectionCode,
  detail: string,
): ProductionCandidateRefusal {
  return Object.freeze({ ok: false, code, detail });
}

export type ProductiveBaseValueScheduleCandidate = {
  readonly scheduleId: string;
  readonly version: number;
  readonly productiveCategory: ProductiveCategory;
  readonly factType?: FactType;
  readonly canonicalUnit: string;
  readonly semanticQualifier: string;
  readonly claimType: ClaimType;
  readonly realizationState: RealizationState;
  readonly baseGpuvNumerator: bigint;
  readonly baseGpuvDenominator: bigint;
  readonly jurisdictionPolicyRef?: string;
  readonly referenceMethodologyRef: string;
  readonly governanceReference: string;
  readonly sourceClass: ProductionCandidateSourceClass;
  readonly fixture: boolean;
  readonly effectiveHeightCandidate: number;
  readonly supersededHeightCandidate: number | null;
  readonly scheduleHash: string;
  readonly productionActivated: false;
};

export type CategoryCoverageRecord = {
  readonly category: ProductiveCategory;
  readonly status: CategoryCoverageStatus;
  readonly canonicalUnit: string;
  readonly semanticQualifier: string;
  readonly dimension: string;
  readonly valueStatus: typeof VALUE_UNCONFIGURED | 'CONFIGURED_CANDIDATE';
  readonly scheduleId: string | null;
  readonly notes: string;
};

export type ProductionFactorPolicyCandidate = {
  readonly permittedFactorTypes: readonly ValueFactorType[];
  readonly reservedFactorTypes: readonly ReservedValueFactorType[];
  readonly forbiddenFactorTypes: readonly ProductionForbiddenFactorType[];
  readonly missingInputBehavior: MissingInputBehavior;
  readonly aggregateFactorFloor: bigint;
  readonly aggregateFactorCeiling: bigint;
  readonly scarcityEvidenceBound: true;
  readonly scarcityBounded: true;
  readonly scarcityVersioned: true;
  readonly scarcityNonSelfReferential: true;
  readonly referencePricePermittedAsEvidence: boolean;
  readonly moonreyMarketPriceFeedsPvf: false;
};

export type MoonReyProductiveValuePolicyCandidate = {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly valueSemantics: typeof GOVERNED_VALUE_V2;
  readonly baseSchedules: readonly ProductiveBaseValueScheduleCandidate[];
  readonly factorPolicy: ProductionFactorPolicyCandidate;
  readonly missingInputBehavior: MissingInputBehavior;
  readonly aggregateFactorFloor: bigint;
  readonly aggregateFactorCeiling: bigint;
  readonly categoryCoverage: readonly CategoryCoverageRecord[];
  readonly unitConstitutionRef: string;
  readonly sourceTaxonomyRef: string;
  readonly oraclePolicyRef: string;
  readonly attributionPolicyRef: string;
  readonly referenceFactMethodologyRef: string;
  readonly providerReadinessPolicyRef: string;
  readonly governanceReference: string;
  readonly candidateEffectiveHeight: number;
  readonly sourceClass: ProductionCandidateSourceClass;
  readonly fixture: boolean;
  readonly policyHash: string;
  readonly productionActivated: false;
  readonly gpuvEqualsMoonReyByDefinition: false;
  readonly canMint: false;
};

export type ProductionCandidateValueInput = {
  readonly contributionId: string;
  readonly contributionFingerprint: string;
  readonly eventId: string;
  readonly eventFingerprint: string;
  readonly category: ProductiveCategory;
  readonly canonicalUnit: string;
  readonly semanticQualifier: string;
  readonly claimType: ClaimType;
  readonly realizationState: RealizationState;
  readonly canonicalQuantity: bigint;
  readonly attributionDecisionId?: string;
  readonly availableAttributionShare?: { readonly numerator: bigint; readonly denominator: bigint };
  readonly creditedCategories?: readonly ProductiveCategory[];
  readonly referenceFacts?: readonly string[];
  readonly referencePriceAlone?: boolean;
  readonly moonreyMarketPrice?: boolean;
  readonly issuanceQuantityAsScarcity?: boolean;
  readonly unboundedScarcityMultiplier?: boolean;
  readonly scarcityEvidenced?: boolean;
  readonly factorTypes?: readonly string[];
  readonly authorizedBy?: string;
  readonly valuePath?: string;
  readonly fixturePolicy?: boolean;
};

export const REUSED_VALUE_FACTOR_TYPES = VALUE_FACTOR_TYPES;
