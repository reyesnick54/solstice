/**
 * Chunk 123 — Productive Value Function types.
 *
 * ProductiveValueUnit is an explicit economic-policy valuation unit used
 * only after physical measurements have been normalized. It is not a
 * universal physical unit, fiat value, market price, or MoonRey quantity.
 */

import type { FactType } from '../../../oracle/types.ts';
import type { NormalizationReceipt } from '../../../units/types.ts';
import type {
  ClaimType,
  GeographyRef,
  MeasurementPeriod,
  ProductiveCategory,
  RoundingMode,
} from '../../types.ts';
import type { VerifiedProductiveContribution } from '../../verification.ts';
import type { GovernanceActorKind } from '../types.ts';
import {
  PRODUCTIVE_VALUE_FUNCTION_SCHEMA_VERSION,
  type PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_VERSION,
} from './constitution.ts';

export const PRODUCTIVE_VALUE_UNIT_ID = 'GPUV' as const;
export const GOVERNED_PRODUCTIVE_VALUE_UNIT_ID = PRODUCTIVE_VALUE_UNIT_ID;
export const VALUE_FUNCTION_PARAMETER_CLASS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;
export const VALUE_FACTOR_SCALE = 1_000_000n;
export const ATTRIBUTION_SHARE_SCALE = 1_000_000n;
export const PRODUCTION_VALUE_POLICY_STATUS = 'UNCONFIGURED' as const;

export const PRODUCTIVE_VALUE_UNIT = Object.freeze({
  unitId: PRODUCTIVE_VALUE_UNIT_ID,
  name: 'GovernedProductiveValueUnit',
  notPhysicalUnit: true,
  notFiatValue: true,
  notMarketPrice: true,
  notMoonReyQuantity: true,
  notGuaranteedEconomicValue: true,
});

export type ProductiveValueUnit = typeof PRODUCTIVE_VALUE_UNIT;
export type GovernedProductiveValueUnit = ProductiveValueUnit;

export const VALUE_FUNCTION_POLICY_STATES = [
  'DEVELOPMENT',
  'SIMULATION',
  'PRODUCTION_CANDIDATE',
  'SUPERSEDED',
] as const;
export type ValueFunctionPolicyState = (typeof VALUE_FUNCTION_POLICY_STATES)[number];

export const VALUE_FACTOR_TYPES = [
  'REALIZATION_FACTOR',
  'CLAIM_STATE_FACTOR',
  'VERIFICATION_QUALITY_FACTOR',
  'FRESHNESS_FACTOR',
  'SOURCE_INDEPENDENCE_FACTOR',
  'UTILIZATION_FACTOR',
  'SCARCITY_FACTOR',
  'DELIVERY_FACTOR',
  'GEOGRAPHIC_CONTEXT_FACTOR',
  'ECONOMIC_CATEGORY_FACTOR',
  'PROVENANCE_CONFIDENCE_FACTOR',
  'ATTRIBUTION_SHARE_FACTOR',
  'CONCENTRATION_RISK_FACTOR',
] as const;
export type ValueFactorType = (typeof VALUE_FACTOR_TYPES)[number];

export const RESERVED_VALUE_FACTOR_TYPES = [
  'DEMAND_ELASTICITY_FACTOR',
  'SUBSTITUTION_FACTOR',
  'MULTI_PERIOD_SMOOTHING_FACTOR',
] as const;
export type ReservedValueFactorType = (typeof RESERVED_VALUE_FACTOR_TYPES)[number];

export const FORBIDDEN_VALUE_FACTOR_TYPES = [
  'AI_VALUE_FACTOR',
  'MODEL_OPINION_FACTOR',
  'PROVIDER_SELF_REPORTED_VALUE_FACTOR',
] as const;
export type ForbiddenValueFactorType = (typeof FORBIDDEN_VALUE_FACTOR_TYPES)[number];

export const VALUE_FACTOR_INPUT_SOURCE_TYPES = [
  'VERIFIED_CONTRIBUTION',
  'CANONICAL_NORMALIZATION_RECEIPT',
  'ATTRIBUTION_DECISION',
  'VERIFIED_REFERENCE_FACT',
  'ORACLE_QUALITY_PROVENANCE',
  'GOVERNED_CAPACITY_BASIS',
  'GOVERNED_CONCENTRATION_CONTEXT',
  'CLAIM_AND_REALIZATION_STATE',
] as const;
export type ValueFactorInputSourceType = (typeof VALUE_FACTOR_INPUT_SOURCE_TYPES)[number];

export const VALUE_REFERENCE_FACT_TYPES = [
  'REFERENCE_PRICE',
  'CAPACITY',
  'AVAILABILITY',
  'UTILIZATION',
  'REGIONAL_SUPPLY',
  'REGIONAL_DEMAND_PROXY',
  'DELIVERY_STATE',
  'QUALITY',
  'FRESHNESS',
] as const;
export type ValueReferenceFactType = (typeof VALUE_REFERENCE_FACT_TYPES)[number];

export const MISSING_INPUT_BEHAVIORS = [
  'FAIL_CLOSED',
  'REVIEW_REQUIRED',
  'GOVERNED_NEUTRAL_ALLOWED',
] as const;
export type MissingInputBehavior = (typeof MISSING_INPUT_BEHAVIORS)[number];

export const VALUE_TRANSFORMATION_METHODS = [
  'IDENTITY_BOUNDED',
  'QUALITY_CLASS_TO_BOUNDED_FACTOR',
  'AGE_TO_FRESHNESS_FACTOR',
  'RATIO_ACTUAL_OVER_GOVERNED_BASIS',
  'SCARCITY_FROM_VERIFIED_REFERENCE',
  'GEOGRAPHY_FROM_VERSIONED_REFERENCE',
  'ATTRIBUTION_SHARE_EXACT_RATIONAL',
  'CONCENTRATION_REVIEW_OR_BOUNDED',
  'REALIZATION_STATE_GATE',
  'CLAIM_STATE_GATE',
  'DELIVERY_STATE_GATE',
  'CATEGORY_SCHEDULE',
  'PROVENANCE_INDEPENDENCE_SCHEDULE',
] as const;
export type ValueTransformationMethod = (typeof VALUE_TRANSFORMATION_METHODS)[number];

export const REALIZATION_STATES = [
  'INSTALLED_CAPACITY',
  'AVAILABLE_CAPACITY',
  'RESERVED_CAPACITY',
  'ACTUAL_OUTPUT',
  'VERIFIED_DELIVERY',
  'COMPLETED_ECONOMIC_SERVICE',
] as const;
export type RealizationState = (typeof REALIZATION_STATES)[number];

export const REALIZATION_ELIGIBILITY = {
  INSTALLED_CAPACITY: 'DESCRIBABLE_NOT_ELIGIBLE',
  AVAILABLE_CAPACITY: 'DESCRIBABLE_NOT_ELIGIBLE',
  RESERVED_CAPACITY: 'DESCRIBABLE_NOT_ELIGIBLE',
  ACTUAL_OUTPUT: 'POLICY_ELIGIBLE',
  VERIFIED_DELIVERY: 'POLICY_ELIGIBLE_SUBJECT_TO_ATTRIBUTION',
  COMPLETED_ECONOMIC_SERVICE: 'POLICY_ELIGIBLE',
} as const satisfies Readonly<Record<RealizationState, string>>;

export const CLAIM_OUTPUT_STATES = [
  'CLAIMED_OUTPUT',
  'VERIFIED_OUTPUT',
  'DELIVERED_OUTPUT',
  'COMPLETED_SERVICE',
] as const;
export type ClaimOutputState = (typeof CLAIM_OUTPUT_STATES)[number];

export const CATEGORY_FACTOR_ELIGIBILITY = ['REQUIRED', 'ELIGIBLE', 'DISABLED', 'RESERVED'] as const;
export type CategoryFactorEligibility = (typeof CATEGORY_FACTOR_ELIGIBILITY)[number];

export const FORBIDDEN_VALUE_INPUTS = [
  'RAW_HTTP_DATA',
  'UNVERIFIED_PROVIDER_PRICE',
  'AI_GENERATED_ECONOMIC_JUDGMENT',
  'MODEL_GENERATED_SCARCITY_WITHOUT_EVIDENCE',
  'UNSUPPORTED_GEOGRAPHY_FACTOR',
  'UNBOUNDED_MULTIPLIER',
  'UNDEFINED_NEGATIVE_FACTOR',
  'FLOAT_OR_NAN',
  'SECRET_OR_PROVIDER_CREDENTIALS',
  'MOONREY_MARKET_PRICE_SELF_REFERENCE',
] as const;
export type ForbiddenValueInput = (typeof FORBIDDEN_VALUE_INPUTS)[number];

export const VALUE_FUNCTION_REJECTION_CODES = [
  'ATTRIBUTION_REQUIRED',
  'ATTRIBUTION_SHARE_INVALID',
  'ATTRIBUTION_SHARE_UNBOUNDED',
  'UNSUPPORTED_FACTOR',
  'UNSUPPORTED_FACTOR_FOR_CATEGORY',
  'UNSUPPORTED_CATEGORY',
  'FORBIDDEN_FACTOR',
  'FORBIDDEN_INPUT',
  'UNBOUNDED_FACTOR',
  'FACTOR_OUT_OF_BOUNDS',
  'NEGATIVE_FACTOR_UNDEFINED',
  'FLOAT_MATH_FORBIDDEN',
  'UTILIZATION_EVIDENCE_REQUIRED',
  'UTILIZATION_DIVIDE_BY_ZERO',
  'UTILIZATION_FABRICATED',
  'SCARCITY_REFERENCE_REQUIRED',
  'SCARCITY_PRICE_ALONE_FORBIDDEN',
  'GEOGRAPHY_EVIDENCE_REQUIRED',
  'GEOGRAPHY_POLICY_REQUIRED',
  'ARBITRARY_COUNTRY_PREFERENCE_FORBIDDEN',
  'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE',
  'CAPACITY_IS_NOT_REALIZED_OUTPUT',
  'ORACLE_FACT_ALONE_CANNOT_CREATE_VALUE',
  'PROVIDER_SELF_REPORT_INSUFFICIENT',
  'AI_CANNOT_ACTIVATE_POLICY',
  'AI_CANNOT_SET_ECONOMIC_POLICY',
  'HISTORICAL_POLICY_IMMUTABLE',
  'PRODUCTION_POLICY_INACTIVE',
  'VALUE_FUNCTION_DOES_NOT_MINT',
  'ENGINE_NOT_IMPLEMENTED',
  'RAW_PROVIDER_PAYLOAD_FORBIDDEN',
  'NORMALIZATION_RECEIPT_REQUIRED',
  'MEASUREMENT_REFERENCE_REQUIRED',
  'CONCENTRATION_REVIEW_REQUIRED',
  'MISSING_INPUT_FAIL_CLOSED',
  'MISSING_INPUT_REVIEW_REQUIRED',
  'POLICY_STATE_INVALID',
  'FACTOR_ORDER_NONDETERMINISTIC',
  'INCOMPLETE_VALUE_INPUT',
  'CROSS_REFERENCE_MISMATCH',
  'EVENT_ATTRIBUTION_MISMATCH',
  'POLICY_VERSION_MISMATCH',
  'ATTRIBUTION_UNRESOLVED',
  'ATTRIBUTION_NOT_RECONCILED',
  'BASE_SCHEDULE_NOT_FOUND',
  'PRODUCTION_SCHEDULE_UNCONFIGURED',
  'REFERENCE_FACTS_CONFLICT',
  'REFERENCE_FACT_STALE',
  'REFERENCE_FACT_QUORUM_INSUFFICIENT',
  'UTILIZATION_BASIS_STALE',
  'UTILIZATION_OBJECT_MISMATCH',
  'UTILIZATION_PERIOD_MISMATCH',
  'UTILIZATION_GEOGRAPHY_MISMATCH',
  'GEOGRAPHY_AMBIGUOUS',
  'SCARCITY_UNBOUNDED_FORBIDDEN',
  'AI_ECONOMIC_JUDGMENT_FORBIDDEN',
  'VALUE_RESULT_IMMUTABLE',
] as const;
export type ValueFunctionRejectionCode = (typeof VALUE_FUNCTION_REJECTION_CODES)[number];

export type ExactRational = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

export type BoundedFactorValue = {
  readonly value: bigint;
  readonly scale: typeof VALUE_FACTOR_SCALE;
  readonly min: bigint;
  readonly max: bigint;
};

export type ValueFactorDefinition = {
  readonly factorId: string;
  readonly factorVersion: number;
  readonly factorType: ValueFactorType;
  readonly inputSourceType: ValueFactorInputSourceType;
  readonly requiredReferenceFactTypes: readonly ValueReferenceFactType[];
  readonly transformationMethod: ValueTransformationMethod;
  readonly minimum: bigint;
  readonly maximum: bigint;
  readonly neutralValue: bigint;
  readonly missingInputBehavior: MissingInputBehavior;
  readonly roundingRule: RoundingMode;
  readonly evidenceRequirements: readonly string[];
  readonly governanceReference: string;
  readonly enabled: boolean;
};

export type ReservedValueFactorDefinition = {
  readonly factorType: ReservedValueFactorType;
  readonly enabled: false;
  readonly reserved: true;
  readonly reason: string;
};

export type CategoryFactorRule = {
  readonly category: ProductiveCategory;
  readonly factorType: ValueFactorType;
  readonly eligibility: CategoryFactorEligibility;
  readonly reason: string;
};

export type ProductiveValueReferenceFact = {
  readonly factId: string;
  readonly factType: ValueReferenceFactType;
  readonly oracleFactType?: FactType;
  readonly sourceQuorumEvidence: readonly string[];
  readonly measurementPeriod: MeasurementPeriod;
  readonly geography: GeographyRef;
  readonly freshnessEpochs: number;
  readonly quality: bigint;
  readonly policyCompatible: true;
  readonly verified: true;
  readonly consensusHttpCall: false;
  readonly rawHttpData: false;
  readonly moonreyMarketPrice: boolean;
  readonly socialMediaSentiment: false;
  readonly providerSelfReportedAlone: false;
  readonly quantity?: ExactRational;
  readonly objectId?: string;
  readonly stale?: boolean;
  readonly conflictsWithFactIds?: readonly string[];
};

export const GEOGRAPHIC_CONTEXT_KINDS = [
  'VERIFIED_GRID_SCARCITY',
  'WATER_BASIN_AVAILABILITY',
  'LOGISTICS_CORRIDOR_CONGESTION',
  'REGIONAL_RESOURCE_AVAILABILITY',
] as const;
export type GeographicContextKind = (typeof GEOGRAPHIC_CONTEXT_KINDS)[number];

export const VALUE_RESULT_STATES = [
  'VALUED_SIMULATION',
  'VALUE_REVIEW_REQUIRED',
  'VALUE_REJECTED',
] as const;
export type ValueResultState = (typeof VALUE_RESULT_STATES)[number];

export const VALUE_PIPELINE_STAGES = [
  'VERIFIED_PRODUCTIVE_CONTRIBUTION',
  'CANONICAL_MEASUREMENT_VERIFICATION',
  'ECONOMIC_EVENT_VERIFICATION',
  'ATTRIBUTION_VERIFICATION',
  'BASE_VALUE_SCHEDULE_RESOLUTION',
  'PRELIMINARY_PRODUCTIVE_VALUE_BASIS',
  'REQUIRED_REFERENCE_FACT_RESOLUTION',
  'FACTOR_EVALUATION',
  'ORDERED_FACTOR_COMPOSITION',
  'ATTRIBUTION_APPLICATION',
  'POLICY_FLOOR_CEILING',
  'FINAL_GOVERNED_PRODUCTIVE_VALUE',
  'EXPLAINABILITY_RECEIPT',
] as const;
export type ValuePipelineStage = (typeof VALUE_PIPELINE_STAGES)[number];

export type UtilizationEvidence = {
  readonly actual: bigint;
  readonly basis: bigint;
  readonly objectId: string;
  readonly geography: GeographyRef;
  readonly measurementPeriod: MeasurementPeriod;
  readonly basisFreshnessEpochs: number;
  readonly independentlyEvidenced: true;
};

export type ConcentrationEvidence = {
  readonly providerShare: ExactRational;
  readonly controllerShare: ExactRational;
  readonly objectShare: ExactRational;
  readonly reviewThreshold: ExactRational;
};

export type ProductiveValueFunctionEngineStatus = {
  readonly engineeringImplemented: true;
  readonly simulationAvailable: true;
  readonly productionActivated: false;
  readonly productionPolicyConfigured: false;
  readonly canMint: false;
  readonly canCreateMonetaryAuthority: false;
};

export const PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS = Object.freeze({
  engineeringImplemented: true,
  simulationAvailable: true,
  productionActivated: false,
  productionPolicyConfigured: false,
  canMint: false,
  canCreateMonetaryAuthority: false,
}) satisfies ProductiveValueFunctionEngineStatus;

export type CanonicalMeasurementReference = {
  readonly unitId: string;
  readonly constitutionVersion: string;
  readonly notUniversalPhysicalUnit: true;
};

export type ProductiveEconomicEventIdentity = {
  readonly eventId: string;
  readonly identityVersion: string;
  readonly category: ProductiveCategory;
  readonly objectId: string;
  readonly measurementPeriod: MeasurementPeriod;
  readonly eventFingerprint?: string | undefined;
};

/**
 * Consumption view of Chunk 121–122 attribution. The value function may
 * not invent a share. Chunk 121/122 decisions remain authoritative.
 */
export type ProductiveAttributionDecision = {
  readonly decisionId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly eventId: string;
  readonly claimId: string;
  readonly share: ExactRational;
  readonly availableShare: ExactRational;
  readonly authoritative: true;
  readonly reconciled: boolean;
  readonly contributionId?: string | undefined;
};

export type ProductiveValueInput = {
  readonly contribution: VerifiedProductiveContribution;
  readonly measurementReference: CanonicalMeasurementReference;
  readonly normalizationReceipt: Pick<
    NormalizationReceipt,
    'receiptId' | 'conversionVersion' | 'exact' | 'lossy' | 'sourceUnit' | 'targetUnit'
  >;
  readonly event: ProductiveEconomicEventIdentity;
  readonly attributionDecision: ProductiveAttributionDecision;
  readonly availableAttributionShare: ExactRational;
  readonly valueFunctionPolicyId: string;
  readonly valueFunctionPolicyVersion: number;
  readonly referenceFacts: readonly ProductiveValueReferenceFact[];
  readonly jurisdiction: string;
  readonly geography: GeographyRef;
  readonly measurementPeriod: MeasurementPeriod;
  readonly oracleQuality: bigint;
  readonly oracleProvenance: readonly string[];
  readonly realizationState: RealizationState;
  readonly claimOutputState: ClaimOutputState;
  readonly rawProviderPayload: never | undefined;
  readonly eventFingerprint?: string | undefined;
  readonly measurementSemantic?: string | undefined;
  readonly utilization?: UtilizationEvidence | undefined;
  readonly concentration?: ConcentrationEvidence | undefined;
  readonly freshnessAgeEpochs?: bigint | undefined;
  readonly policyMaxAgeEpochs?: bigint | undefined;
  readonly geographyContextKind?: GeographicContextKind | undefined;
  readonly countryPreferenceRequested?: boolean | undefined;
  readonly referencePriceAlone?: boolean | undefined;
  readonly aiEconomicJudgment?: boolean | undefined;
  readonly providerSelfReportAlone?: boolean | undefined;
  readonly evaluatedAt?: string | undefined;
  readonly supersedesValueId?: string | undefined;
  readonly revaluationReason?: string | undefined;
  readonly priorPolicyVersion?: number | undefined;
};

export type PerCategoryValueRule = {
  readonly category: ProductiveCategory;
  readonly eligibleFactorTypes: readonly ValueFactorType[];
  readonly requiredFactorTypes: readonly ValueFactorType[];
  readonly disabledFactorTypes: readonly ValueFactorType[];
  readonly requiredReferenceFactTypes: readonly ValueReferenceFactType[];
  readonly eligibleClaimTypes: readonly ClaimType[];
  readonly eligibleRealizationStates: readonly RealizationState[];
};

export type ProductiveValueFunctionPolicy = {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly contentHash: string;
  readonly state: ValueFunctionPolicyState;
  readonly eligibleCategories: readonly ProductiveCategory[];
  readonly eligibleClaimTypes: readonly ClaimType[];
  readonly factorDefinitions: readonly ValueFactorDefinition[];
  readonly reservedFactors: readonly ReservedValueFactorDefinition[];
  readonly factorOrder: readonly ValueFactorType[];
  readonly factorCaps: Readonly<Record<ValueFactorType, { readonly min: bigint; readonly max: bigint }>>;
  readonly aggregateFactorFloor: bigint;
  readonly aggregateFactorCeiling: bigint;
  readonly perCategoryRules: readonly PerCategoryValueRule[];
  readonly referenceFactRequirements: readonly ValueReferenceFactType[];
  readonly attributionRequired: true;
  readonly roundingPolicy: RoundingMode;
  readonly effectiveHeight: number;
  readonly supersededAtHeight: number | null;
  readonly governanceReference: string;
  readonly parameterClass: typeof VALUE_FUNCTION_PARAMETER_CLASS;
  readonly productionActivated: false;
  readonly schemaVersion: typeof PRODUCTIVE_VALUE_FUNCTION_SCHEMA_VERSION;
  readonly constitutionVersion: typeof PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_VERSION;
  readonly engineImplemented: false;
  readonly canMint: false;
};

export type ValueFunctionActivationRecord = {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly contentHash: string;
  readonly effectiveHeight: number;
  readonly actorKind: GovernanceActorKind;
  readonly actorId: string;
  readonly activated: boolean;
  readonly rejection?: ValueFunctionRejectionCode;
};

export type ValueFunctionRefusal = {
  readonly ok: false;
  readonly code: ValueFunctionRejectionCode;
  readonly detail: string;
};

export type ValueFunctionOk<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ValueFunctionResult<T> = ValueFunctionOk<T> | ValueFunctionRefusal;

export function valueFunctionOk<T>(value: T): ValueFunctionOk<T> {
  return Object.freeze({ ok: true, value });
}

export function valueFunctionRefuse(code: ValueFunctionRejectionCode, detail: string): ValueFunctionRefusal {
  return Object.freeze({ ok: false, code, detail });
}

export const PRODUCTION_VALUE_FUNCTION_POLICY = Object.freeze({
  status: PRODUCTION_VALUE_POLICY_STATUS,
  productionActivated: false,
  productionValuePolicyActive: false,
  engineImplemented: false,
  canMint: false,
});
