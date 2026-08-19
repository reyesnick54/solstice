/**
 * Chunk 108 — privacy-safe Human Contribution → monetary evidence bridge.
 *
 * This is not a second mint and not a second MonetaryIssuanceAuthority.
 * Quantity is never inferred from a contribution, PEVE score, HIN
 * receipt, consent, clean-room result, or AI output.
 *
 * The Human Contribution Valuation Engine is not implemented here.
 */

import type { HumanEvidencePurposeClass } from '../types.ts';

export const HUMAN_CONTRIBUTION_BRIDGE_SCHEMA_VERSION = 1 as const;
export const HUMAN_CONTRIBUTION_BRIDGE_ID = 'sunrey.human-contribution.monetary-bridge.v1' as const;
export const VALUATION_ENGINE_IMPLEMENTED = false as const;
export const PRODUCTION_ACTIVATED = false as const;
export const PEVE_USED_AS_TOKEN_FORMULA = false as const;
export const RAW_PERSONAL_DATA = false as const;
export const AI_AUTHORIZED = false as const;

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

export const SETTLEMENT_AUTHORIZERS = ['HUMAN', 'PROTOCOL', 'DEVELOPMENT_FIXTURE'] as const;
export type SettlementAuthorizer = (typeof SETTLEMENT_AUTHORIZERS)[number];

export const SETTLEMENT_ENVIRONMENTS = ['DEVELOPMENT', 'SIMULATION', 'PRODUCTION'] as const;
export type SettlementEnvironment = (typeof SETTLEMENT_ENVIRONMENTS)[number];

export const SETTLEMENT_QUANTITY_SOURCES = ['DEVELOPMENT_FIXTURE', 'SIMULATION_FIXTURE'] as const;
export type SettlementQuantitySource = (typeof SETTLEMENT_QUANTITY_SOURCES)[number];

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
 * Separate settlement/valuation authorization. Fixtures may create
 * DEVELOPMENT/SIMULATION authorizations only. Production remains
 * unavailable. AI and Financial Agents cannot create this object.
 */
export type HumanContributionSettlementAuthorization = {
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
  readonly quantitySource: SettlementQuantitySource;
  readonly valuationEngineImplemented: false;
  readonly peveUsedAsTokenFormula: false;
  readonly aiAuthorized: false;
};

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
  | { readonly kind: 'FINANCIAL_AGENT_PROPOSAL'; readonly proposalId: string };

export type HumanContributionSettlementRequest = {
  readonly recipient: string;
  readonly contribution?: VerifiedHumanEconomicContribution;
  readonly authorization?: HumanContributionSettlementAuthorization;
  readonly actorKind?: 'HUMAN' | 'PROTOCOL' | 'AI' | 'AGENT' | 'FINANCIAL_AGENT';
  readonly authorizedBy?: string;
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
  | 'VALUATION_ENGINE_UNAVAILABLE';

export type SettledContributionRecord = {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly authorizationId: string;
  readonly replayKey: string;
  readonly quantity: bigint;
  readonly superseded: boolean;
};

export type HumanContributionSettlementBook = {
  readonly settledReplayKeys: Set<string>;
  readonly settledFingerprints: Map<string, SettledContributionRecord>;
  readonly settledAuthorizationIds: Set<string>;
  readonly settledContributionIds: Set<string>;
};
