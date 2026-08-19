import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  AttestationRef,
  CardEventRef,
  CleanRoomResultRef,
  CommunityAttestationRef,
  ConsentGrantRef,
  ContributionFingerprint,
  ContributionId,
  EvidenceRef,
  EventReference,
  ExternalAttestationRef,
  InformationRightRef,
  LedgerEventRef,
  PaymentEventRef,
  PegEventRef,
  PolicyDecisionRef,
  ProfessionalAttestationRef,
  ProvenanceRef,
  PurposeRef,
  RegistryRecordId,
  ResearchAttestationRef,
  SubjectRef,
  TaxonomyVersion,
  UsageReceiptRef,
  VerificationPolicyVersion,
} from './ids.ts';
import type {
  ContributionClass,
  ContributionLifecycleState,
  DataQualityState,
  MeasurementUnit,
  SettlementEligibilityState,
  SourceClass,
  VerificationQuality,
} from './taxonomy.ts';
import { HUMAN_CONTRIBUTION_SCHEMA_VERSION, HUMAN_CONTRIBUTION_TAXONOMY_VERSION } from './taxonomy.ts';

export type ContributionFailure = {
  readonly code: ContributionFailureCode;
  readonly message: string;
};

export type ContributionFailureCode =
  | 'RAW_PERSONAL_DATA_FORBIDDEN'
  | 'PROTECTED_TRAIT_RANKING_FORBIDDEN'
  | 'HUMAN_WORTH_SCORE_FORBIDDEN'
  | 'SUBJECT_REF_NOT_PSEUDONYMOUS'
  | 'MEASUREMENT_IS_MONETARY'
  | 'MEASUREMENT_IS_SUNREY_QUANTITY'
  | 'MEASUREMENT_IS_PEVE_SCORE'
  | 'UNLIKE_UNITS_NOT_EQUIVALENT'
  | 'MODEL_INFERENCE_CANNOT_VERIFY'
  | 'PROVENANCE_UPGRADE_FORBIDDEN'
  | 'INFORMATION_RIGHTS_REQUIRED'
  | 'USAGE_RECEIPT_REQUIRED'
  | 'RAW_PDV_CONTENT_FORBIDDEN'
  | 'RAW_CLEAN_ROOM_ROWS_FORBIDDEN'
  | 'EXECUTION_AUTHORIZATION_FORBIDDEN'
  | 'MINT_AUTHORIZATION_FORBIDDEN'
  | 'TAXONOMY_DOES_NOT_GRANT_ELIGIBILITY'
  | 'INVALID_MEASUREMENT'
  | 'INVALID_LIFECYCLE'
  | 'INVALID_ELIGIBILITY'
  | 'CONTRIBUTION_NOT_FOUND'
  | 'ALREADY_SUPERSEDED'
  | 'POLICY_REF_REQUIRED'
  | 'ISSUANCE_QUANTITY_FORBIDDEN'
  | 'FORBIDDEN_FIELD'
  | 'DUPLICATE_FINGERPRINT'
  | 'DUPLICATE_ATTEMPT'
  | 'NOT_VERIFIABLE'
  | 'ALREADY_TERMINAL'
  | 'CORRECTION_TARGET_REQUIRED'
  | 'VERIFICATION_POLICY_REQUIRED';
  | 'FORBIDDEN_FIELD';

export type ContributionMeasurement = {
  readonly quantity: bigint;
  readonly unit: MeasurementUnit;
  readonly unlikeUnitsEconomicallyEquivalent: false;
  readonly isMonetaryValuation: false;
  readonly isSunReyQuantity: false;
  readonly isPeveScore: false;
};

export type PrivacyBoundaryFlags = {
  readonly containRawPersonalData: false;
  readonly humanWorthScore: false;
  readonly socialCreditScore: false;
  readonly creditScore: false;
  readonly automaticMintAuthority: false;
  readonly rawPdvContent: false;
  readonly rawCleanRoomRows: false;
  readonly protectedTraitRanking: false;
};

export type AuthorityBoundaryFlags = {
  readonly authorizesFinancialExecution: false;
  readonly authorizesSunReyIssuance: false;
  readonly authorizesLedgerPosting: false;
  readonly issuesExecutionAuthority: false;
  readonly productionEnabled: false;
  readonly legallyApproved: false;
};

export const PRIVACY_BOUNDARY: PrivacyBoundaryFlags = Object.freeze({
  containRawPersonalData: false,
  humanWorthScore: false,
  socialCreditScore: false,
  creditScore: false,
  automaticMintAuthority: false,
  rawPdvContent: false,
  rawCleanRoomRows: false,
  protectedTraitRanking: false,
});

export const AUTHORITY_BOUNDARY: AuthorityBoundaryFlags = Object.freeze({
  authorizesFinancialExecution: false,
  authorizesSunReyIssuance: false,
  authorizesLedgerPosting: false,
  issuesExecutionAuthority: false,
  productionEnabled: false,
  legallyApproved: false,
});

export type CanonicalContributionReferences = {
  readonly informationRightRefs: readonly InformationRightRef[];
  readonly consentGrantRefs: readonly ConsentGrantRef[];
  readonly usageReceiptRefs: readonly UsageReceiptRef[];
  readonly cleanRoomResultRefs: readonly CleanRoomResultRef[];
  readonly pegEventRefs: readonly PegEventRef[];
  readonly ledgerEventRefs: readonly LedgerEventRef[];
  readonly paymentEventRefs: readonly PaymentEventRef[];
  readonly cardEventRefs: readonly CardEventRef[];
  readonly externalAttestationRefs: readonly ExternalAttestationRef[];
  readonly communityAttestationRefs: readonly CommunityAttestationRef[];
  readonly researchAttestationRefs: readonly ResearchAttestationRef[];
  readonly professionalAttestationRefs: readonly ProfessionalAttestationRef[];
};

export type HumanContributionEvent = {
  readonly schemaVersion: typeof HUMAN_CONTRIBUTION_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly contributionId: ContributionId;
  readonly subjectRef: SubjectRef;
  readonly contributionClass: ContributionClass;
  readonly sourceClass: SourceClass;
  readonly eventReference: EventReference;
  readonly measurement: ContributionMeasurement;
  readonly measurementUnit: MeasurementUnit;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant | null;
  readonly jurisdiction: string;
  readonly evidenceReferences: readonly EvidenceRef[];
  readonly rightsReferences: readonly InformationRightRef[];
  readonly consentReferences: readonly ConsentGrantRef[];
  readonly purposeReferences: readonly PurposeRef[];
  readonly provenanceReferences: readonly ProvenanceRef[];
  readonly attestationReferences: readonly AttestationRef[];
  readonly usageReceiptReferences: readonly UsageReceiptRef[];
  readonly canonicalReferences: CanonicalContributionReferences;
  readonly createdAt: UtcInstant;
  readonly status: ContributionLifecycleState;
  readonly eligibilityState: SettlementEligibilityState;
  readonly verificationQuality: VerificationQuality;
  readonly dataQuality: DataQualityState;
  readonly supersededBy: ContributionId | null;
  readonly supersedes: ContributionId | null;
  readonly policyDecisionRef: PolicyDecisionRef | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly issuanceEligible: false;
  readonly sunReyQuantity: null;
  readonly peveScoreUsedAsValue: false;
  readonly humanWorthScore: false;
};

export type RecordContributionInput = {
  readonly contributionId?: ContributionId;
  readonly subjectRef: SubjectRef;
  readonly contributionClass: ContributionClass;
  readonly sourceClass: SourceClass;
  readonly eventReference: EventReference;
  readonly measurementQuantity: bigint;
  readonly measurementUnit: MeasurementUnit;
  readonly validFrom: UtcInstant;
  readonly validUntil?: UtcInstant | null;
  readonly jurisdiction: string;
  readonly evidenceReferences?: readonly EvidenceRef[];
  readonly rightsReferences?: readonly InformationRightRef[];
  readonly consentReferences?: readonly ConsentGrantRef[];
  readonly purposeReferences?: readonly PurposeRef[];
  readonly provenanceReferences?: readonly ProvenanceRef[];
  readonly attestationReferences?: readonly AttestationRef[];
  readonly usageReceiptReferences?: readonly UsageReceiptRef[];
  readonly canonicalReferences?: Partial<CanonicalContributionReferences>;
  readonly createdAt: UtcInstant;
  readonly status?: ContributionLifecycleState;
  readonly eligibilityState?: SettlementEligibilityState;
  readonly verificationQuality?: VerificationQuality;
  readonly dataQuality?: DataQualityState;
  readonly supersedes?: ContributionId | null;
  readonly policyDecisionRef?: PolicyDecisionRef | null;
};

export type ExecutionRefusal = {
  readonly authorized: false;
  readonly issuesExecutionAuthority: false;
  readonly reason: 'CONTRIBUTION_EVENT_CANNOT_AUTHORIZE_EXECUTION';
  readonly contributionId: ContributionId;
  readonly schemaVersion: typeof HUMAN_CONTRIBUTION_SCHEMA_VERSION;
};

export type MintRefusal = {
  readonly authorized: false;
  readonly sunReyQuantity: null;
  readonly reason: 'CONTRIBUTION_EVENT_CANNOT_AUTHORIZE_SUNREY_ISSUANCE';
  readonly contributionId: ContributionId;
  readonly schemaVersion: typeof HUMAN_CONTRIBUTION_SCHEMA_VERSION;
};

export const CURRENT_TAXONOMY_VERSION = HUMAN_CONTRIBUTION_TAXONOMY_VERSION as TaxonomyVersion;

export type MeasurementPeriod = {
  readonly start: UtcInstant;
  readonly end: UtcInstant | null;
};

export type HumanContributionRegistryRecord = {
  readonly registryRecordId: RegistryRecordId;
  readonly contributionId: ContributionId;
  readonly fingerprint: ContributionFingerprint;
  readonly subjectRef: SubjectRef;
  readonly contributionClass: ContributionClass;
  readonly verifiedMeasurement: ContributionMeasurement | null;
  readonly measurementUnit: MeasurementUnit;
  readonly measurementPeriod: MeasurementPeriod;
  readonly jurisdiction: string;
  readonly sourceClass: SourceClass;
  readonly evidenceDigest: string;
  readonly evidenceReferences: readonly EvidenceRef[];
  readonly rightsReferences: readonly InformationRightRef[];
  readonly consentReferences: readonly ConsentGrantRef[];
  readonly purposeReferences: readonly PurposeRef[];
  readonly provenanceReferences: readonly ProvenanceRef[];
  readonly verificationPolicyVersion: VerificationPolicyVersion | null;
  readonly verificationTimestamp: UtcInstant | null;
  readonly status: ContributionLifecycleState;
  readonly createdAt: UtcInstant;
  readonly supersedes: ContributionId | null;
  readonly supersededBy: ContributionId | null;
  readonly corrects: ContributionId | null;
  readonly correctedBy: ContributionId | null;
  readonly event: HumanContributionEvent;
  readonly sunReyQuantity: null;
  readonly valuationAmount: null;
  readonly issuesExecutionAuthority: false;
  readonly issuesMintAuthority: false;
};

export type VerifiedContributionReference = {
  readonly registryRecordId: RegistryRecordId;
  readonly contributionId: ContributionId;
  readonly fingerprint: ContributionFingerprint;
  readonly subjectRef: SubjectRef;
  readonly contributionClass: ContributionClass;
  readonly status: 'VERIFIED';
  readonly evidenceDigest: string;
  readonly verificationPolicyVersion: VerificationPolicyVersion;
  readonly verificationTimestamp: UtcInstant;
  readonly measurementUnit: MeasurementUnit;
  readonly verifiedMeasurement: ContributionMeasurement;
  readonly jurisdiction: string;
  readonly containsRawPersonalData: false;
};

export type ContributionQuery = {
  readonly subjectRef?: SubjectRef;
  readonly contributionClass?: ContributionClass;
  readonly jurisdiction?: string;
  readonly status?: ContributionLifecycleState;
  readonly sourceClass?: SourceClass;
  readonly fingerprint?: ContributionFingerprint;
  readonly evidenceRef?: EvidenceRef;
  readonly periodStart?: UtcInstant;
  readonly periodEnd?: UtcInstant;
  readonly verifiedOnly?: boolean;
};

export type ContributionClassCount = {
  readonly contributionClass: ContributionClass;
  readonly count: number;
};

export type JurisdictionCount = {
  readonly jurisdiction: string;
  readonly count: number;
};

export type HumanContributionRegistryAudit = {
  readonly submitted: number;
  readonly verified: number;
  readonly rejected: number;
  readonly superseded: number;
  readonly corrected: number;
  readonly countsByContributionClass: readonly ContributionClassCount[];
  readonly countsByJurisdiction: readonly JurisdictionCount[];
  readonly duplicateAttempts: number;
  readonly correctionCount: number;
  readonly verificationPolicyVersions: readonly VerificationPolicyVersion[];
  readonly valuationTotals: null;
  readonly sunReyTotals: null;
};

export type DuplicateAttempt = {
  readonly fingerprint: ContributionFingerprint;
  readonly attemptedContributionId: ContributionId | null;
  readonly at: UtcInstant;
  readonly reason: 'DUPLICATE_FINGERPRINT';
};

export type VerifyContributionInput = {
  readonly contributionId: ContributionId;
  readonly verificationPolicyVersion?: VerificationPolicyVersion;
  readonly verificationTimestamp: UtcInstant;
};

export type RejectContributionInput = {
  readonly contributionId: ContributionId;
  readonly rejectedAt: UtcInstant;
  readonly reasonCode: string;
};

export type HumanContributionRegistrySnapshot = {
  readonly events: readonly HumanContributionEvent[];
  readonly records: readonly HumanContributionRegistryRecord[];
  readonly duplicateAttempts: readonly DuplicateAttempt[];
  readonly taxonomyDoesNotGrantEligibility: true;
  readonly valuationImplemented: false;
  readonly mintingImplemented: false;
};
