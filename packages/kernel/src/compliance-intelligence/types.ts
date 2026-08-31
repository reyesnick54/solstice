/**
 * Wave 4 — canonical compliance evidence types.
 * External providers supply EVIDENCE only. Compliance Kernel decides.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ComplianceAuthorityClass } from './catalog-types.ts';

export const COMPLIANCE_EVIDENCE_SCHEMA = 'sunrey.compliance-evidence.v1' as const;
export const COMPLIANCE_DECISION_SCHEMA = 'sunrey.compliance-decision.v1' as const;

export const COMPLIANCE_SUBJECT_TYPES = [
  'PERSON',
  'ORGANIZATION',
  'LEGAL_ENTITY',
  'BUSINESS',
  'BENEFICIARY',
  'COUNTERPARTY',
] as const;
export type ComplianceSubjectType = (typeof COMPLIANCE_SUBJECT_TYPES)[number];

export const COMPLIANCE_EVIDENCE_CLASSIFICATIONS = [
  'SANCTIONS',
  'PEP',
  'WATCHLIST',
  'WANTED',
  'ENFORCEMENT',
  'OTHER',
] as const;
export type ComplianceEvidenceClassification = (typeof COMPLIANCE_EVIDENCE_CLASSIFICATIONS)[number];

export const COMPLIANCE_MATCH_TYPES = [
  'EXACT',
  'FUZZY',
  'ALIAS',
  'IDENTIFIER',
  'NO_MATCH',
  'NEGATIVE_OBSERVATION',
] as const;
export type ComplianceMatchType = (typeof COMPLIANCE_MATCH_TYPES)[number];

export const PEP_RELATIONSHIP_TYPES = [
  'CURRENT',
  'FORMER',
  'FAMILY',
  'ASSOCIATE',
  'UNKNOWN',
] as const;
export type PepRelationshipType = (typeof PEP_RELATIONSHIP_TYPES)[number];

export const VERIFICATION_STATUSES = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'UNVERIFIED',
  'STALE',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type ComplianceSubject = {
  readonly subjectType: ComplianceSubjectType;
  readonly canonicalSubjectId: string | null;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly dateOfBirth: string | null;
  readonly nationality: string | null;
  readonly country: string | null;
  readonly organizationIdentifiers: Readonly<Record<string, string>>;
};

export type ComplianceMatchDimensions = {
  readonly matchType: ComplianceMatchType;
  readonly matchedFields: readonly string[];
  readonly unmatchedFields: readonly string[];
  readonly matchScore: number | null;
  readonly exactMatch: boolean;
  readonly fuzzyMatch: boolean;
  readonly providerNativeScore: number | null;
  readonly algorithm: string | null;
  readonly algorithmVersion: string | null;
  readonly threshold: number | null;
};

export type ComplianceEvidenceSource = {
  readonly providerId: string;
  readonly providerRecordId: string | null;
  readonly listName: string | null;
  readonly listAuthority: string | null;
  readonly jurisdiction: string | null;
  readonly program: string | null;
  readonly designationDate: string | null;
  readonly removalDate: string | null;
  readonly status: string | null;
  readonly sourceUrl: string | null;
};

export type ComplianceEvidenceTime = {
  readonly sourceUpdatedAt: UtcInstant | null;
  readonly retrievedAt: UtcInstant;
  readonly screenedAt: UtcInstant;
};

export type ComplianceEvidenceQuality = {
  readonly confidence: number | null;
  readonly freshness: 'fresh' | 'aging' | 'stale' | 'expired';
  readonly verificationStatus: VerificationStatus;
};

export type ComplianceEvidenceProvenance = {
  readonly observationId: string;
  readonly rawPayloadHash: string;
  readonly schemaVersion: string;
  readonly normalizationVersion: string;
};

export type PepEvidenceDetails = {
  readonly relationship: PepRelationshipType;
  readonly role: string | null;
  readonly country: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
};

export type ComplianceEvidence = {
  readonly schema: typeof COMPLIANCE_EVIDENCE_SCHEMA;
  readonly evidenceId: string;
  readonly subject: ComplianceSubject;
  readonly match: ComplianceMatchDimensions;
  readonly source: ComplianceEvidenceSource;
  readonly classification: ComplianceEvidenceClassification;
  readonly time: ComplianceEvidenceTime;
  readonly quality: ComplianceEvidenceQuality;
  readonly authority: { readonly authorityClass: ComplianceAuthorityClass };
  readonly provenance: ComplianceEvidenceProvenance;
  readonly pepDetails: PepEvidenceDetails | null;
  readonly originalName: string;
  readonly grantsDecisionAuthority: false;
  readonly isKernelDecision: false;
};

/**
 * Kernel-issued compliance decision — never produced by external providers.
 */
export type ComplianceDecision = {
  readonly schema: typeof COMPLIANCE_DECISION_SCHEMA;
  readonly decisionId: string;
  readonly evidenceIds: readonly string[];
  readonly kernelAuthority: true;
  readonly providerAuthority: false;
  readonly status: 'ALLOW' | 'REVIEW' | 'HOLD' | 'REJECT' | 'DEFER' | 'REQUIRE_MANUAL_REVIEW';
  readonly policyVersionId: string | null;
  readonly decidedAt: UtcInstant;
};

export type ComplianceScreeningQuery = {
  readonly subjectType: ComplianceSubjectType;
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly dateOfBirth?: string | null;
  readonly nationality?: string | null;
  readonly country?: string | null;
  readonly organizationIdentifiers?: Readonly<Record<string, string>>;
  readonly canonicalSubjectId?: string | null;
  readonly requestId: string;
  readonly screenedAt: UtcInstant;
};

export type ComplianceScreeningResult = {
  readonly ok: boolean;
  readonly query: ComplianceScreeningQuery;
  readonly evidence: readonly ComplianceEvidence[];
  readonly negativeObservations: readonly ComplianceEvidence[];
  readonly providerId: string;
  readonly fromCache: boolean;
  readonly fallbackProviderId: string | null;
  readonly errorCode: string | null;
};

export type ProviderDisagreementRecord = {
  readonly queryRequestId: string;
  readonly providerA: string;
  readonly providerB: string;
  readonly classification: ComplianceEvidenceClassification;
  readonly disagreementType: 'MATCH_VS_NO_MATCH' | 'SCORE_DIVERGENCE' | 'CLASSIFICATION_DIVERGENCE';
  readonly observedAt: UtcInstant;
};

export type ComplianceRescreenConfig = {
  readonly initialOnboarding: boolean;
  readonly periodicRescreeningHours: number | null;
  readonly eventTriggeredRescreening: readonly string[];
};

export const DEFAULT_RESCREEN_CONFIG: ComplianceRescreenConfig = Object.freeze({
  initialOnboarding: true,
  periodicRescreeningHours: 24 * 7,
  eventTriggeredRescreening: Object.freeze(['KYC_UPGRADE', 'JURISDICTION_CHANGE', 'MANUAL_REQUEST']),
});
