/**
 * Chunk 125 — Productive Value → MoonRey settlement conversion types.
 *
 * GPUV is not MoonRey Coin. Conversion is a separate versioned policy.
 * This layer authorizes settlement evidence only. Chunk 71 remains the
 * sole native-asset issuance gate. Production remains inactive.
 */

import type { ProductiveCategory } from '../../types.ts';
import type { VerifiedProductiveContribution } from '../../verification.ts';
import type { ProductiveAttributionDecision, ProductiveEconomicEventIdentity } from '../value-function/types.ts';

export const PRODUCTIVE_SETTLEMENT_BRIDGE_ID = 'moonrey.productive-value.settlement-bridge.v2' as const;
export const PRODUCTIVE_SETTLEMENT_SCHEMA_VERSION = 2 as const;
export const GPUV_UNIT = 'GPUV' as const;
export const MOONREY_OUTPUT_ASSET = 'MOONREY_COIN' as const;
export const SETTLEMENT_PARAMETER_CLASS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;
export const GPUV_EQUALS_MOONREY_BY_DEFINITION = false as const;
export const PRODUCTIVE_VALUE_RESULT_CAN_MINT = false as const;
export const PRODUCTIVE_VALUE_ENGINE_CAN_MINT = false as const;
export const AI_AUTHORIZED = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const PRODUCTION_CONVERSION_STATUS = 'UNCONFIGURED' as const;
export const PRODUCTION_SETTLEMENT_STATUS = 'UNAVAILABLE' as const;

export const ISSUANCE_PATH_KINDS = [
  'LEGACY_ENGINEERING_SIMULATION_V1',
  'GOVERNED_VALUE_SIMULATION_V2',
  'PRODUCTION',
] as const;
export type IssuancePathKind = (typeof ISSUANCE_PATH_KINDS)[number];

export const SETTLEMENT_ENVIRONMENTS = ['DEVELOPMENT', 'SIMULATION', 'PRODUCTION_CANDIDATE'] as const;
export type SettlementEnvironment = (typeof SETTLEMENT_ENVIRONMENTS)[number];

export const CONVERSION_ROUNDING_RULES = ['FLOOR', 'CEILING', 'NEAREST_EVEN'] as const;
export type ConversionRoundingRule = (typeof CONVERSION_ROUNDING_RULES)[number];

export const PRODUCTIVE_VALUE_STATES = ['VALUED_SIMULATION', 'VALUE_REVIEW_REQUIRED', 'VALUE_REJECTED'] as const;
export type ProductiveValueState = (typeof PRODUCTIVE_VALUE_STATES)[number];

export const SETTLEMENT_AUTHORIZERS = [
  'HUMAN',
  'PROTOCOL',
  'GOVERNED_PROTOCOL_SIMULATION',
  'PROTOCOL_GOVERNANCE',
  'HUMAN_GOVERNANCE',
] as const;
export type SettlementAuthorizer = (typeof SETTLEMENT_AUTHORIZERS)[number];

export const FORBIDDEN_SETTLEMENT_AUTHORIZERS = [
  'AI',
  'FINANCIAL_AGENT',
  'AGENT',
  'S3M',
  'GROK',
  'MODEL',
  'MODEL_OUTPUT',
  'ORACLE_PROVIDER',
  'PRODUCTIVE_CONTROLLER',
  'CONTROLLER',
] as const;
export type ForbiddenSettlementAuthorizer = (typeof FORBIDDEN_SETTLEMENT_AUTHORIZERS)[number];

/**
 * Consumption view of a Chunk 124 ProductiveValueResult.
 * The settlement bridge does not invent GPUV. It does not mint.
 */
export type ProductiveValueResult = {
  readonly productiveValueId: string;
  readonly contributionId: string;
  readonly contributionFingerprint: string;
  readonly eventId: string;
  readonly eventFingerprint: string;
  readonly attributionDecisionId: string;
  readonly normalizationReceiptId: string;
  readonly valueFunctionPolicyId: string;
  readonly valueFunctionPolicyVersion: number;
  readonly productiveValueQuantity: bigint;
  readonly productiveValueUnit: typeof GPUV_UNIT;
  readonly productiveValueDigest: string;
  readonly state: ProductiveValueState;
  readonly canMint: false;
  readonly productionActivated: false;
  readonly environment: SettlementEnvironment;
  readonly parameterClass: typeof SETTLEMENT_PARAMETER_CLASS;
  readonly valueFunctionQuantityCap: bigint;
  readonly attributionShare: { readonly numerator: bigint; readonly denominator: bigint };
  readonly eventBasisQuantity: bigint;
  readonly jurisdiction: string;
  readonly objectId: string;
  readonly controller: string;
  readonly category: ProductiveCategory;
  readonly epoch: number;
  readonly oracleFactIds: readonly string[];
};

export type MoonReyProductiveSettlementConversionPolicy = {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly inputValueUnit: typeof GPUV_UNIT;
  readonly outputAsset: typeof MOONREY_OUTPUT_ASSET;
  readonly conversionNumerator: bigint;
  readonly conversionDenominator: bigint;
  readonly roundingRule: ConversionRoundingRule;
  readonly perContributionCeiling: bigint;
  readonly perEventCeiling: bigint;
  readonly perObjectCeiling: bigint;
  readonly perControllerCeiling: bigint;
  readonly perCategoryEpochCeiling: bigint;
  readonly globalEpochCeiling: bigint;
  readonly effectiveHeight: number;
  readonly supersededHeight: number | null;
  readonly governanceReference: string;
  readonly environment: SettlementEnvironment;
  readonly parameterClass: typeof SETTLEMENT_PARAMETER_CLASS;
  readonly productionActivated: false;
  readonly gpuvEqualsMoonReyByDefinition: false;
};

export const PRODUCTION_CONVERSION_POLICY = Object.freeze({
  status: PRODUCTION_CONVERSION_STATUS,
  productionActivated: false,
  gpuvEqualsMoonReyByDefinition: false,
});

export type MoonReyProductiveSettlementAuthorization = {
  readonly authorizationId: string;
  readonly contributionId: string;
  readonly contributionFingerprint: string;
  readonly eventId: string;
  readonly eventFingerprint: string;
  readonly productiveValueId: string;
  readonly productiveValueDigest: string;
  readonly productiveValuePolicyId: string;
  readonly productiveValuePolicyVersion: number;
  readonly productiveValueQuantity: bigint;
  readonly productiveValueUnit: typeof GPUV_UNIT;
  readonly conversionPolicyId: string;
  readonly conversionPolicyVersion: string;
  readonly authorizedMoonReyQuantity: bigint;
  readonly quantityCeiling: bigint;
  readonly attributionDecisionId: string;
  readonly normalizationReceiptId: string;
  readonly authorizedAt: string;
  readonly authorizedBy: SettlementAuthorizer;
  readonly environment: SettlementEnvironment;
  readonly evidenceDigest: string;
  readonly productionActivated: false;
  readonly pathClass: 'GOVERNED_VALUE_SIMULATION_V2';
  readonly gpuvEqualsMoonReyByDefinition: false;
  readonly aiAuthorized: false;
  readonly canMint: false;
};

export type SettlementContext = {
  readonly contribution: VerifiedProductiveContribution;
  readonly event: ProductiveEconomicEventIdentity & { readonly eventFingerprint: string };
  readonly attributionDecision: ProductiveAttributionDecision;
  readonly valueResult: ProductiveValueResult;
  readonly conversionPolicy: MoonReyProductiveSettlementConversionPolicy;
  readonly authorizedBy: string;
  readonly authorizedAt?: string;
  readonly authorizationId?: string;
  readonly monetaryQuantityCeiling?: bigint;
  readonly jurisdiction?: string;
  readonly usage?: SettlementUsage;
  readonly height?: number;
};

export type SettlementUsage = {
  readonly eventIssued: bigint;
  readonly objectIssued: bigint;
  readonly controllerIssued: bigint;
  readonly categoryEpochIssued: bigint;
  readonly globalEpochIssued: bigint;
};

export type SettledValueRecord = {
  readonly contributionId: string;
  readonly contributionFingerprint: string;
  readonly eventId: string;
  readonly productiveValueId: string;
  readonly productiveValueDigest: string;
  readonly authorizationId: string;
  readonly conversionPolicyVersion: string;
  readonly attributionDecisionId: string;
  readonly quantity: bigint;
};

export type ProductiveSettlementBook = {
  readonly settledReplayKeys: Set<string>;
  readonly settledFingerprints: Map<string, SettledValueRecord>;
  readonly settledEventIds: Set<string>;
  readonly settledValueIds: Set<string>;
  readonly settledValueDigests: Set<string>;
  readonly settledAuthorizationIds: Set<string>;
  readonly issuedByEvent: Map<string, bigint>;
  readonly issuedByObject: Map<string, bigint>;
  readonly issuedByController: Map<string, bigint>;
  readonly issuedByCategoryEpoch: Map<string, bigint>;
  readonly issuedByGlobalEpoch: Map<string, bigint>;
};

export type StandaloneMonetaryAttempt =
  | { readonly kind: 'ORACLE_OBSERVATION'; readonly observationId: string }
  | { readonly kind: 'VERIFIED_ECONOMIC_FACT'; readonly factId: string }
  | { readonly kind: 'PRODUCTIVE_CLAIM'; readonly claimId: string }
  | { readonly kind: 'VERIFIED_PRODUCTIVE_CONTRIBUTION'; readonly contributionId: string }
  | { readonly kind: 'PRODUCTIVE_ECONOMIC_EVENT'; readonly eventId: string }
  | { readonly kind: 'ATTRIBUTION_DECISION'; readonly decisionId: string }
  | { readonly kind: 'PRODUCTIVE_VALUE_RESULT'; readonly productiveValueId: string }
  | { readonly kind: 'GPUV_QUANTITY'; readonly quantity: bigint };

export type SettlementRejection =
  | 'ORACLE_OBSERVATION_ALONE_CANNOT_ISSUE'
  | 'VERIFIED_FACT_ALONE_CANNOT_ISSUE'
  | 'PRODUCTIVE_CLAIM_ALONE_CANNOT_ISSUE'
  | 'CONTRIBUTION_ALONE_CANNOT_ISSUE'
  | 'EVENT_ALONE_CANNOT_ISSUE'
  | 'ATTRIBUTION_ALONE_CANNOT_ISSUE'
  | 'PRODUCTIVE_VALUE_ALONE_CANNOT_ISSUE'
  | 'GPUV_ALONE_CANNOT_ISSUE'
  | 'PRODUCTIVE_VALUE_RESULT_CANNOT_MINT'
  | 'VALUE_STATE_INVALID'
  | 'VALUE_DIGEST_INVALID'
  | 'CONTRIBUTION_MISMATCH'
  | 'CONTRIBUTION_FINGERPRINT_MISMATCH'
  | 'EVENT_MISMATCH'
  | 'ATTRIBUTION_DECISION_MISMATCH'
  | 'VALUE_FUNCTION_POLICY_MISMATCH'
  | 'CONVERSION_POLICY_INVALID'
  | 'CONVERSION_POLICY_INACTIVE'
  | 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED'
  | 'GPUV_EQUALS_MOONREY_FORBIDDEN'
  | 'AI_CANNOT_AUTHORIZE_ISSUANCE'
  | 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_ISSUANCE'
  | 'S3M_CANNOT_AUTHORIZE_ISSUANCE'
  | 'GROK_CANNOT_AUTHORIZE_ISSUANCE'
  | 'ORACLE_PROVIDER_CANNOT_AUTHORIZE_ISSUANCE'
  | 'CONTROLLER_SELF_AUTHORIZATION_REJECTED'
  | 'AUTHORIZATION_ACTOR_FORBIDDEN'
  | 'JURISDICTION_POLICY_MISMATCH'
  | 'CAP_EXCEEDED'
  | 'REPLAY_REJECTED'
  | 'REVALUATION_SETTLEMENT_REVIEW'
  | 'ATTRIBUTION_SETTLEMENT_ADJUSTMENT_REVIEW_REQUIRED'
  | 'PRODUCTION_V2_UNAVAILABLE'
  | 'PRODUCTION_PATH_UNAVAILABLE'
  | 'MONETARY_PREREQUISITE_MISSING'
  | 'RAW_PROVIDER_PAYLOAD_FORBIDDEN'
  | 'VALUE_FUNCTION_POLICY_VERSION_MISMATCH'
  | 'NORMALIZATION_RECEIPT_MISMATCH'
  | 'INCOMPLETE_GOVERNED_CHAIN';

export type SettlementResult =
  | { readonly ok: true; readonly authorization: MoonReyProductiveSettlementAuthorization }
  | { readonly ok: false; readonly code: SettlementRejection };

export type ReviewFlag =
  | 'REVALUATION_SETTLEMENT_REVIEW'
  | 'ATTRIBUTION_SETTLEMENT_ADJUSTMENT_REVIEW_REQUIRED';

export type SettlementReviewRecord = {
  readonly flag: ReviewFlag;
  readonly contributionId: string;
  readonly priorAuthorizationId: string;
  readonly remintForbidden: true;
  readonly clawbackForbidden: true;
  readonly customerBalanceUnmodified: true;
};
