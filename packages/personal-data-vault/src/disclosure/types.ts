import type { UtcInstant } from '../../../domain/src/time.ts';

/**
 * Structured privacy assertions. Prove a required fact without exposing
 * the underlying dataset.
 */
export const ASSERTION_TYPES = [
  'CredentialValid',
  'EmploymentVerified',
  'ContributionVerified',
  'AgeThresholdSatisfied',
  'JurisdictionSatisfied',
  'ComputationCompleted',
  'DatasetUsageAuthorized',
] as const;

export type AssertionType = (typeof ASSERTION_TYPES)[number];

export type EvidenceReference = {
  readonly evidenceCommitmentHash: string;
  readonly evidenceId?: string;
  readonly proofRef?: string;
  readonly vaultAssetRef?: string;
};

export type PrivacyAssertion = {
  readonly assertionId: string;
  readonly assertionType: AssertionType;
  readonly subjectCommitment: string;
  readonly purposeId: string;
  readonly satisfied: boolean;
  readonly evidenceRefs: readonly EvidenceReference[];
  readonly disclosedFields: readonly string[];
  readonly rawDataIncluded: false;
  readonly evaluatedAt: UtcInstant;
  readonly policyVersion: string;
};

export type AssertionFailureCode =
  | 'PURPOSE_MISMATCH'
  | 'EVIDENCE_MISSING'
  | 'ASSERTION_UNSATISFIED'
  | 'OVERBROAD_FIELD_REQUEST'
  | 'RAW_DATA_REQUEST_DENIED'
  | 'CREDENTIAL_PROOF_FAILED'
  | 'SOURCE_RECORD_DELETED'
  | 'COMMITMENT_STILL_VERIFIABLE';

export type AssertionFailure = {
  readonly code: AssertionFailureCode;
  readonly message: string;
};

export type CapabilityClassification = 'IMPLEMENTED' | 'PARTIAL' | 'INTERFACE_ONLY' | 'FUTURE';
