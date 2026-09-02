/**
 * Wave 6 — verified contribution input, valuation result, and receipt types.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionClass } from '../taxonomy.ts';
import type { VerifiedHumanEconomicContribution } from '../valuation/types.ts';
import type { ValuationMethodologyId, ValuationPolicyVersion } from '../valuation/ids.ts';
import type { HumanContributionValuationResult } from '../valuation/types.ts';

export const WAVE6_PEVE_RECEIPT_SCHEMA_VERSION = 1 as const;
export const WAVE6_PEVE_RECEIPT_ID = 'sunrey.wave6.human-economic-valuation.receipt.v1' as const;

export const IDENTITY_ASSURANCE_LEVELS = [
  'UNVERIFIED',
  'BASIC',
  'STANDARD',
  'ENHANCED',
  'GOVERNED',
] as const;
export type IdentityAssuranceLevel = (typeof IDENTITY_ASSURANCE_LEVELS)[number];

export const UNIQUENESS_STATUSES = [
  'UNIQUE',
  'DUPLICATE_REJECTED',
  'PENDING_DEDUP',
  'SUPERSEDED',
] as const;
export type UniquenessStatus = (typeof UNIQUENESS_STATUSES)[number];

export const VALUATION_ENVIRONMENT_STATUSES = ['SIMULATION', 'PRODUCTION_CANDIDATE', 'PRODUCTION'] as const;
export type ValuationEnvironmentStatus = (typeof VALUATION_ENVIRONMENT_STATUSES)[number];

/**
 * Formal Wave 6 valuation input binding a verified contribution to
 * attestations, rights, consent, uniqueness, and methodology context.
 * No raw personal dataset is required or accepted.
 */
export type VerifiedHumanEconomicContributionInput = {
  readonly contribution: VerifiedHumanEconomicContribution;
  readonly humanEconomicClaimId: string;
  readonly canonicalEventId: string;
  readonly verificationReceiptRef: string;
  readonly identityAssuranceLevel: IdentityAssuranceLevel;
  readonly evidenceProofRefs: readonly string[];
  readonly rightsProofRefs: readonly string[];
  readonly consentProofRefs: readonly string[];
  readonly policyProofRefs: readonly string[];
  readonly contributionClass: ContributionClass;
  readonly authorizedScope: string;
  readonly uniquenessStatus: UniquenessStatus;
  readonly methodologyId: ValuationMethodologyId;
  readonly methodologyVersion: ValuationPolicyVersion;
  readonly containsRawPersonalData: false;
  readonly humanWorthAssigned: false;
  readonly humanWorthScore: false;
  readonly peveScoreUsedAsValue: false;
  readonly sunReyQuantity: null;
};

export type HumanEconomicValuationResult = {
  readonly schemaVersion: typeof WAVE6_PEVE_RECEIPT_SCHEMA_VERSION;
  readonly valuationId: string;
  readonly contributionId: string;
  readonly contributionFingerprint: string;
  readonly humanEconomicClaimId: string;
  readonly contributionClass: ContributionClass;
  readonly methodologyId: ValuationMethodologyId;
  readonly methodologyVersion: ValuationPolicyVersion;
  readonly finalReferenceValue: bigint | null;
  readonly referenceDenomination: string;
  readonly valuationDigest: string;
  readonly valuationTimestamp: UtcInstant;
  readonly state: 'VALUED_SIMULATION' | 'VALUATION_REJECTED' | 'VALUATION_REVIEW_REQUIRED';
  readonly engineResult: HumanContributionValuationResult;
  readonly humanWorthAssigned: false;
  readonly humanWorthScore: false;
  readonly peveScoreUsedAsValue: false;
  readonly peveUsedAsTokenFormula: false;
  readonly sunReyQuantity: null;
  readonly setsExchangePrice: false;
  readonly mintsSunRey: false;
  readonly productionActivated: false;
};

/**
 * Versioned valuation receipt sealed for audit and downstream monetary policy.
 */
export type HumanEconomicValuationReceipt = {
  readonly schemaVersion: typeof WAVE6_PEVE_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly valuationId: string;
  readonly subjectPseudonymRef: string;
  readonly contributionId: string;
  readonly humanEconomicClaimId: string;
  readonly contributionClass: ContributionClass;
  readonly methodologyId: ValuationMethodologyId;
  readonly methodologyVersion: ValuationPolicyVersion;
  readonly authorizedInputsDigest: string;
  readonly verificationReceiptRef: string;
  readonly verificationReferences: readonly string[];
  readonly valuationResult: bigint | null;
  readonly referenceDenomination: string;
  readonly policyReference: string;
  readonly resultCommitment: string;
  readonly environmentStatus: ValuationEnvironmentStatus;
  readonly humanWorthAssigned: false;
  readonly humanWorthScore: false;
  readonly peveScoreUsedAsValue: false;
  readonly sunReyQuantity: null;
};

export type PeveEvaluateFailureCode =
  | 'CONTRIBUTION_NOT_VERIFIED'
  | 'DUPLICATE_CONTRIBUTION'
  | 'UNIQUENESS_REJECTED'
  | 'RIGHTS_PROOF_MISSING'
  | 'CONSENT_PROOF_MISSING'
  | 'IDENTITY_ASSURANCE_INSUFFICIENT'
  | 'METHODOLOGY_MISMATCH'
  | 'AI_OUTPUT_CANNOT_SET_PEVE'
  | 'PEVE_INPUT_FORBIDDEN'
  | 'HUMAN_WORTH_INPUT_FORBIDDEN'
  | 'PROTECTED_TRAIT_INPUT_FORBIDDEN'
  | 'MARKET_PRICE_INPUT_FORBIDDEN'
  | 'GPUV_CANNOT_SUBSTITUTE_PEVE'
  | 'RAW_PERSONAL_DATA_REJECTED'
  | 'PRODUCTION_PEVE_UNAVAILABLE';

export type PeveEvaluateResult =
  | { readonly ok: true; readonly result: HumanEconomicValuationResult; readonly receipt: HumanEconomicValuationReceipt }
  | { readonly ok: false; readonly code: PeveEvaluateFailureCode; readonly message: string };
