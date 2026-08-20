/**
 * Chunk 108 / 112 — privacy-safe Human Contribution → monetary evidence bridge.
 *
 * This is not a second mint and not a second MonetaryIssuanceAuthority.
 * Quantity is never inferred from a contribution, PEVE score, HIN
 * receipt, consent, clean-room result, or AI output.
 *
 * Versioned valuation paths:
 * - LEGACY_DEVELOPMENT_FIXTURE — Chunk 108 fixture quantity (unchanged)
 * - ENGINE_VALUATION_SIMULATION — engineering-implemented reference valuation
 * - PRODUCTION — remains unavailable
 *
 * Production valuation is not activated. VALUATION_ENGINE_IMPLEMENTED
 * remains false so the production boolean cannot be flipped.
 */

import type { HumanEvidencePurposeClass } from '../types.ts';

export const HUMAN_CONTRIBUTION_BRIDGE_SCHEMA_VERSION = 2 as const;
export const HUMAN_CONTRIBUTION_BRIDGE_ID = 'sunrey.human-contribution.monetary-bridge.v2' as const;
export const HUMAN_CONTRIBUTION_BRIDGE_LEGACY_SCHEMA_VERSION = 1 as const;
/** Production valuation engine remains unimplemented. Do not flip. */
export const VALUATION_ENGINE_IMPLEMENTED = false as const;
export const VALUATION_ENGINE_ENGINEERING_IMPLEMENTED = true as const;
export const VALUATION_ENGINE_PRODUCTION_ACTIVATED = false as const;
export const PRODUCTION_ACTIVATED = false as const;
export const PEVE_USED_AS_TOKEN_FORMULA = false as const;
export const RAW_PERSONAL_DATA = false as const;
export const AI_AUTHORIZED = false as const;
export const HUMAN_WORTH_USED_AS_VALUE = false as const;
export const REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION = false as const;
export const ENGINEERING_SIMULATION_PARAMETERS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;
export const PRODUCTION_CONVERSION_POLICY_STATUS = 'UNCONFIGURED' as const;
export const PRODUCTION_SETTLEMENT_AUTHORIZATION_STATUS = 'UNAVAILABLE' as const;

export const VALUATION_PATH_KINDS = [
  'LEGACY_DEVELOPMENT_FIXTURE',
  'ENGINE_VALUATION_SIMULATION',
  'PRODUCTION',
] as const;
export type ValuationPathKind = (typeof VALUATION_PATH_KINDS)[number];

export const MONETARY_CONTRIBUTION_CLASSES = [
  'INFORMATION_RIGHT_CONTRIBUTION',
  'COMMUNITY_CONTRIBUTION',
  'CREATIVE_CONTRIBUTION',
  'ENTREPRENEURIAL_CONTRIBUTION',
  'LABOR_CONTRIBUTION',
  'RESEARCH_CONTRIBUTION',
  'GOVERNED_PARTICIPATION_EVENT',
  'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
] as const;
export type MonetaryContributionClass = (typeof MONETARY_CONTRIBUTION_CLASSES)[number];

export const CONTRIBUTION_VERIFICATION_STATES = [
  'UNVERIFIED',
  'VERIFIED',
  'REJECTED',
  'SUPERSEDED',
  'SETTLED',
] as const;
export type ContributionVerificationState = (typeof CONTRIBUTION_VERIFICATION_STATES)[number];

export const SETTLEMENT_AUTHORIZERS = [
  'HUMAN',
  'PROTOCOL',
  'DEVELOPMENT_FIXTURE',
  'GOVERNED_PROTOCOL_SIMULATION',
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
] as const;
export type ForbiddenSettlementAuthorizer = (typeof FORBIDDEN_SETTLEMENT_AUTHORIZERS)[number];

export const SETTLEMENT_ENVIRONMENTS = ['DEVELOPMENT', 'SIMULATION', 'PRODUCTION'] as const;
export type SettlementEnvironment = (typeof SETTLEMENT_ENVIRONMENTS)[number];

export const SETTLEMENT_QUANTITY_SOURCES = [
  'DEVELOPMENT_FIXTURE',
  'SIMULATION_FIXTURE',
  'ENGINE_VALUATION_SIMULATION',
] as const;
export type SettlementQuantitySource = (typeof SETTLEMENT_QUANTITY_SOURCES)[number];

export const CONVERSION_ROUNDING_RULES = ['FLOOR', 'CEILING', 'NEAREST_EVEN'] as const;
export type ConversionRoundingRule = (typeof CONVERSION_ROUNDING_RULES)[number];

/**
 * Privacy-safe adapter for a verified human economic contribution.
 * The monetary layer never receives raw personal data or the full
 * Human Contribution Registry graph.
 */
export type VerifiedHumanEconomicContribution = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly contributionClass: MonetaryContributionClass;
  readonly verificationState: ContributionVerificationState;
  readonly verificationPolicyVersion: string;
  readonly verificationEvidenceDigest: string;
  readonly measurementBasis: string;
  readonly measurementUnit: string;
  readonly measurementPeriod: string;
  readonly jurisdictionPolicyRef: string;
  readonly containsRawPersonalData: false;
  readonly pdvSourceExposed: false;
  readonly cleanRoomSourceExposed: false;
  readonly peveScoreUsedAsQuantity: false;
  readonly humanWorthScore: false;
  readonly supersededContributionId?: string;
};

/**
 * Narrow intermediate candidate. Mapping a class to a purpose class
 * is not an issuance authorization.
 */
export type HumanContributionMonetaryEvidenceCandidate = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly contributionClass: MonetaryContributionClass;
  readonly verificationPolicyVersion: string;
  readonly verificationEvidenceDigest: string;
  readonly measurementBasis: string;
  readonly measurementUnit: string;
  readonly measurementPeriod: string;
  readonly purposeClass: HumanEvidencePurposeClass;
  readonly jurisdictionPolicyRef: string;
  readonly settlementAuthorizationRef: string | null;
  readonly valuationPolicyRef: string | null;
  readonly valuationVersion: string | null;
  readonly quantityBasis: bigint | null;
  readonly evidenceHash: string;
  readonly mappingIsIssuanceAuthorization: false;
  readonly containsRawPersonalData: false;
  readonly pdvSourceExposed: false;
  readonly cleanRoomSourceExposed: false;
};

/**
 * Chunk 108 legacy fixture authorization. Quantity is an explicit
 * DEVELOPMENT/SIMULATION fixture. The production valuation engine
 * remains unimplemented (`valuationEngineImplemented: false`).
 */
export type LegacyFixtureSettlementAuthorization = {
  readonly schemaVersion?: 1 | 2 | undefined;
  readonly valuationPath?: 'LEGACY_DEVELOPMENT_FIXTURE' | 'ENGINE_VALUATION_SIMULATION' | 'PRODUCTION' | undefined;
  readonly authorizationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationPolicyRef: string;
  readonly valuationVersion: string;
  readonly authorizedQuantityBasis: bigint;
  readonly authorizedSunReyQuantity: bigint;
  readonly quantityCeiling: bigint;
  readonly jurisdictionPolicyRef: string;
  readonly authorizedBy: SettlementAuthorizer;
  readonly authorizedAt: string;
  readonly environment: SettlementEnvironment;
  readonly simulationOnly: true;
  readonly productionStatus: 'UNAVAILABLE' | 'UNCONFIGURED';
  readonly evidenceDigest: string;
  readonly quantitySource: 'DEVELOPMENT_FIXTURE' | 'SIMULATION_FIXTURE';
  readonly valuationEngineImplemented: false;
  readonly peveUsedAsTokenFormula: false;
  readonly aiAuthorized: false;
};

/**
 * Chunk 112 engine-based settlement authorization. Reference
 * settlement value is distinct from authorized SunRey quantity.
 * Production remains unavailable.
 */
export type EngineValuationSettlementAuthorization = {
  readonly schemaVersion: 2;
  readonly valuationPath: 'ENGINE_VALUATION_SIMULATION';
  readonly authorizationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationId: string;
  readonly valuationPolicyRef: string;
  readonly valuationVersion: string;
  readonly valuationDigest: string;
  readonly referenceValue: bigint;
  readonly referenceDenomination: string;
  readonly conversionPolicyRef: string;
  readonly conversionPolicyVersion: string;
  readonly authorizedQuantityBasis: bigint;
  readonly authorizedSunReyQuantity: bigint;
  readonly quantityCeiling: bigint;
  readonly jurisdictionPolicyRef: string;
  readonly authorizedBy: SettlementAuthorizer;
  readonly authorizedAt: string;
  readonly environment: 'DEVELOPMENT' | 'SIMULATION' | 'PRODUCTION';
  readonly simulationOnly: true;
  readonly productionStatus: 'UNAVAILABLE';
  readonly evidenceDigest: string;
  readonly quantitySource: 'ENGINE_VALUATION_SIMULATION';
  readonly valuationEngineImplemented: true;
  readonly productionValuationActivated: false;
  readonly productionActivated: false;
  readonly peveUsedAsTokenFormula: false;
  readonly humanWorthUsedAsValue: false;
  readonly aiAuthorized: false;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly parameterClass: typeof ENGINEERING_SIMULATION_PARAMETERS;
};

export type HumanContributionSettlementAuthorization =
  | LegacyFixtureSettlementAuthorization
  | EngineValuationSettlementAuthorization;

/**
 * Privacy-safe valuation-result fields accepted by the adapter.
 * sunrey-chain does not import the contribution registry.
 */
export type EngineValuationReference = {
  readonly valuationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: string;
  readonly valuationMethod: string;
  readonly valuationDigest: string;
  readonly finalReferenceValue: bigint;
  readonly referenceDenomination: string;
  readonly jurisdictionPolicyRef: string;
  readonly status: 'ACTIVE' | 'SUPERSEDED' | 'INVALID';
  readonly environment: 'DEVELOPMENT' | 'SIMULATION' | 'PRODUCTION';
  readonly productionActivated: false;
  readonly peveUsedAsTokenFormula: false;
  readonly humanWorthUsedAsValue: false;
  readonly aiAuthorized: false;
};

export type EngineValuationSettlementCandidate = {
  readonly valuationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: string;
  readonly valuationMethod: string;
  readonly valuationDigest: string;
  readonly finalReferenceValue: bigint;
  readonly referenceDenomination: string;
  readonly jurisdictionPolicyRef: string;
  readonly mappingIsIssuanceAuthorization: false;
  readonly containsRawPersonalData: false;
};

export type SunReyHumanSettlementConversionPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly environment: 'DEVELOPMENT' | 'SIMULATION';
  readonly inputDenomination: string;
  readonly conversionNumerator: bigint;
  readonly conversionDenominator: bigint;
  readonly roundingRule: ConversionRoundingRule;
  readonly perContributionCeiling: bigint;
  readonly perEpochCeiling: bigint;
  readonly jurisdictionPolicyRef: string;
  readonly governanceReference: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly simulationOnly: true;
  readonly productionActivated: false;
  readonly parameterClass: typeof ENGINEERING_SIMULATION_PARAMETERS;
};

export const PRODUCTION_CONVERSION_POLICY = Object.freeze({
  status: PRODUCTION_CONVERSION_POLICY_STATUS,
  productionActivated: false,
});

export type ContributionCorrectionPolicy = {
  readonly kind: 'EXPLICIT_ADJUSTMENT';
  readonly priorContributionId: string;
  readonly priorAuthorizationId: string;
  readonly supersededContributionId: string;
  readonly adjustmentQuantity: bigint;
  readonly adjustmentAuthorizationId: string;
  readonly clawbackForbidden: true;
};

export type StandaloneMonetaryAttempt =
  | { readonly kind: 'HIN_CONSENT'; readonly consentRef: string }
  | { readonly kind: 'HIN_USAGE_RECEIPT'; readonly receiptId: string }
  | { readonly kind: 'CLEAN_ROOM_RESULT'; readonly resultId: string }
  | { readonly kind: 'PEVE_SCORE'; readonly score: bigint }
  | { readonly kind: 'USER_DECLARATION'; readonly declaration: string }
  | { readonly kind: 'CONSENT'; readonly consentRef: string }
  | { readonly kind: 'PDV_RECORD'; readonly vaultRef: string }
  | { readonly kind: 'AI_OUTPUT'; readonly outputDigest: string }
  | { readonly kind: 'FINANCIAL_AGENT_PROPOSAL'; readonly proposalId: string }
  | { readonly kind: 'S3M_OUTPUT'; readonly outputDigest: string }
  | { readonly kind: 'GROK_OUTPUT'; readonly outputDigest: string }
  | { readonly kind: 'MODEL_OUTPUT'; readonly outputDigest: string }
  | { readonly kind: 'VALUATION_RESULT'; readonly valuationId: string };

export type HumanContributionSettlementRequest = {
  readonly recipient: string;
  readonly contribution?: VerifiedHumanEconomicContribution;
  readonly authorization?: HumanContributionSettlementAuthorization;
  readonly valuation?: EngineValuationReference;
  readonly conversionPolicy?: SunReyHumanSettlementConversionPolicy;
  readonly actorKind?:
    | 'HUMAN'
    | 'PROTOCOL'
    | 'AI'
    | 'AGENT'
    | 'FINANCIAL_AGENT'
    | 'S3M'
    | 'GROK'
    | 'MODEL'
    | 'DEVELOPMENT_FIXTURE'
    | 'GOVERNED_PROTOCOL_SIMULATION';
  readonly authorizedBy?: string;
  readonly epochKey?: string;
  readonly standalone?: StandaloneMonetaryAttempt;
  readonly correction?: ContributionCorrectionPolicy;
  readonly extra?: Readonly<Record<string, unknown>>;
};

export type BridgeRejection =
  | 'VERIFIED_CONTRIBUTION_ALONE_INSUFFICIENT'
  | 'SETTLEMENT_AUTHORIZATION_REQUIRED'
  | 'INVALID_CONTRIBUTION'
  | 'DUPLICATE_CONTRIBUTION_SETTLEMENT'
  | 'HIN_CONSENT_ALONE_CANNOT_ISSUE'
  | 'HIN_USAGE_RECEIPT_ALONE_CANNOT_ISSUE'
  | 'CLEAN_ROOM_RESULT_ALONE_CANNOT_ISSUE'
  | 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY'
  | 'AI_CANNOT_AUTHORIZE_ISSUANCE'
  | 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_ISSUANCE'
  | 'RAW_PERSONAL_DATA_REJECTED'
  | 'PROTECTED_TRAIT_VALUATION_REJECTED'
  | 'HUMAN_WORTH_SCORE_REJECTED'
  | 'SUPERSESSION_REQUIRES_EXPLICIT_ADJUSTMENT'
  | 'SILENT_REMINT_FORBIDDEN'
  | 'CLAWBACK_UNAVAILABLE'
  | 'PRODUCTION_ISSUANCE_UNAVAILABLE'
  | 'QUANTITY_NOT_SEPARATELY_AUTHORIZED'
  | 'USER_DECLARATION_ALONE_CANNOT_ISSUE'
  | 'CONSENT_ALONE_CANNOT_ISSUE'
  | 'PDV_ALONE_CANNOT_ISSUE'
  | 'AUTHORIZATION_CONTRIBUTION_MISMATCH'
  | 'INELIGIBLE_CONTRIBUTION_CLASS'
  | 'AUTHORIZATION_ACTOR_FORBIDDEN'
  | 'VALUATION_ENGINE_UNAVAILABLE'
  | 'VALUATION_REQUIRED'
  | 'VALUATION_RESULT_CANNOT_MINT'
  | 'VALUATION_CONTRIBUTION_MISMATCH'
  | 'VALUATION_FINGERPRINT_MISMATCH'
  | 'VALUATION_DIGEST_INVALID'
  | 'VALUATION_POLICY_MISMATCH'
  | 'VALUATION_POLICY_VERSION_MISMATCH'
  | 'CONVERSION_POLICY_INVALID'
  | 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED'
  | 'CAP_EXCEEDED'
  | 'EPOCH_CAP_EXCEEDED'
  | 'REVALUATION_DOES_NOT_REMINT'
  | 'S3M_CANNOT_AUTHORIZE_ISSUANCE'
  | 'GROK_CANNOT_AUTHORIZE_ISSUANCE'
  | 'MODEL_OUTPUT_CANNOT_AUTHORIZE_ISSUANCE'
  | 'PRODUCTION_VALUATION_UNAVAILABLE'
  | 'PRODUCTION_SETTLEMENT_AUTHORIZATION_UNAVAILABLE'
  | 'JURISDICTION_POLICY_MISMATCH';

export type SettledContributionRecord = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly authorizationId: string;
  readonly replayKey: string;
  readonly quantity: bigint;
  readonly superseded: boolean;
  readonly valuationId?: string;
  readonly conversionPolicyVersion?: string;
};

export type HumanContributionSettlementBook = {
  readonly settledReplayKeys: Set<string>;
  readonly settledFingerprints: Map<string, SettledContributionRecord>;
  readonly settledAuthorizationIds: Set<string>;
  readonly settledContributionIds: Set<string>;
  readonly settledValuationIds: Set<string>;
  readonly issuedByEpoch: Map<string, bigint>;
};
