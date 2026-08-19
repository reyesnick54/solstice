import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AttestationRef,
  ConsentGrantRef,
  ContributionFingerprint,
  ContributionId,
  EvidenceBundleId,
  EvidenceRef,
  EventReference,
  InformationRightRef,
  PolicyDecisionRef,
  ProvenanceRef,
  PurposeRef,
  SubjectRef,
  UsageReceiptRef,
  VerificationDecisionId,
  VerificationPolicyId,
  VerificationPolicyVersion,
} from '../ids.ts';
import type { ContributionClass, MeasurementUnit, SourceClass, VerificationQuality } from '../taxonomy.ts';
import type { ContributionMeasurement, MeasurementPeriod } from '../types.ts';
import type { VerificationDecisionCode } from './rejections.ts';

export const HUMAN_CONTRIBUTION_EVIDENCE_SCHEMA_VERSION = 1 as const;

export type VerificationOutcome = 'VERIFIED' | 'REJECTED' | 'REQUIRES_ADDITIONAL_EVIDENCE';

export type VerificationConfidenceClass = 'HIGH' | 'INSUFFICIENT' | 'DISQUALIFIED';

export type VerificationDecisionQuality = 'VERIFIED' | 'INCOMPLETE' | 'REJECTED';

export type PolicyActivationStatus = 'ACTIVE' | 'SUPERSEDED' | 'NOT_ACTIVATED';

export type EngineeringParameterClass = 'ENGINEERING_SIMULATION_PARAMETERS' | 'UNCONFIGURED';

export type ProductionLegalCommercialPolicy = 'UNCONFIGURED' | 'NOT_ACTIVATED';

export type CounselApprovalState = 'NOT_CLAIMED';

export type EvidenceKind =
  | 'EVENT'
  | 'MEASUREMENT'
  | 'INFORMATION_RIGHT'
  | 'CONSENT'
  | 'PURPOSE'
  | 'USAGE_RECEIPT'
  | 'USAGE_REALIZED'
  | 'PROVENANCE'
  | 'ATTESTATION'
  | 'INDEPENDENT_ATTESTATION'
  | 'MODEL_TRAINING_PERMISSION'
  | 'SERVICE_ACCEPTANCE'
  | 'ROYALTY_CONTRACT'
  | 'CREATIVE_RIGHT';

export type ClassEvidenceRequirement = {
  readonly failClosed: boolean;
  readonly requiredEvidence: readonly EvidenceKind[];
  readonly requiredSourceClasses: readonly SourceClass[];
  readonly requiredRights: boolean;
  readonly requiredConsent: boolean;
  readonly requiredPurpose: boolean;
  readonly requiredUsageReceipt: boolean;
  readonly requiredProvenance: boolean;
  readonly minimumIndependentAttestations: number;
  readonly allowUserDeclared: false;
  readonly allowModelInferenceAlone: false;
};

export type HumanContributionVerificationPolicy = {
  readonly policyId: VerificationPolicyId;
  readonly policyVersion: VerificationPolicyVersion;
  readonly schemaVersion: 1;
  readonly status: PolicyActivationStatus;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly parameterClass: EngineeringParameterClass;
  readonly productionLegalCommercialPolicy: ProductionLegalCommercialPolicy;
  readonly counselApproval: CounselApprovalState;
  readonly eligibleContributionClasses: readonly ContributionClass[];
  readonly requiredEvidenceByContributionClass: Readonly<Partial<Record<ContributionClass, readonly EvidenceKind[]>>>;
  readonly requiredSourceClassesByContributionClass: Readonly<Partial<Record<ContributionClass, readonly SourceClass[]>>>;
  readonly classRequirements: Readonly<Partial<Record<ContributionClass, ClassEvidenceRequirement>>>;
  readonly minimumVerificationQuality: VerificationQuality;
  readonly minimumIndependentAttestations: number;
  readonly requiredRights: boolean;
  readonly requiredConsent: boolean;
  readonly requiredPurpose: boolean;
  readonly requiredUsageReceipt: boolean;
  readonly requiredProvenance: boolean;
  readonly maximumEvidenceAgeDays: number;
  readonly jurisdictionRequirements: {
    readonly mustResolve: true;
    readonly allowedCodedJurisdictions: readonly string[];
  };
  readonly duplicateRules: {
    readonly rejectActiveFingerprintReplay: true;
    readonly rejectDuplicatedEvidenceReferences: true;
  };
  readonly conflictRules: {
    readonly rejectConflictedEvidence: true;
    readonly rejectConflictingAttestations: true;
  };
  readonly correctionRules: {
    readonly requireExplicitSupersession: true;
    readonly doNotRewriteHistory: true;
  };
  readonly modelInferenceRules: {
    readonly cannotSoleVerify: true;
    readonly mayAssistReview: true;
    readonly remainModelInference: true;
  };
  readonly userDeclaredRules: {
    readonly cannotSoleVerify: true;
    readonly remainUserDeclared: true;
  };
};

export type HumanContributionEvidenceBundle = {
  readonly schemaVersion: typeof HUMAN_CONTRIBUTION_EVIDENCE_SCHEMA_VERSION;
  readonly bundleId: EvidenceBundleId;
  readonly contributionId: ContributionId;
  readonly subjectRef: SubjectRef;
  readonly contributionClass: ContributionClass;
  readonly sourceClass: SourceClass;
  readonly eventReference: EventReference;
  readonly measurement: ContributionMeasurement;
  readonly measurementUnit: MeasurementUnit;
  readonly measurementPeriod: MeasurementPeriod;
  readonly evidenceReferences: readonly EvidenceRef[];
  readonly rightsReferences: readonly InformationRightRef[];
  readonly consentReferences: readonly ConsentGrantRef[];
  readonly purposeReferences: readonly PurposeRef[];
  readonly usageReceiptReferences: readonly UsageReceiptRef[];
  readonly attestationReferences: readonly AttestationRef[];
  readonly provenanceReferences: readonly ProvenanceRef[];
  readonly policyDecisionReferences: readonly PolicyDecisionRef[];
  readonly jurisdiction: string;
  readonly evidenceDigest: string;
  readonly createdAt: UtcInstant;
  readonly containsRawPersonalData: false;
  readonly containsRawCleanRoomRows: false;
  readonly containsRawPDVData: false;
};

export type EvidenceItemFact = {
  readonly ref: EvidenceRef;
  readonly createdAt: UtcInstant;
  readonly stale: boolean;
  readonly conflicted: boolean;
  readonly digest: string;
};

export type RightFact = {
  readonly ref: InformationRightRef;
  readonly valid: boolean;
  readonly expired: boolean;
  readonly revokedBeforeUse: boolean;
  readonly subjectRef: SubjectRef;
  readonly purposeRef: PurposeRef | null;
};

export type ConsentFact = {
  readonly ref: ConsentGrantRef;
  readonly valid: boolean;
  readonly required: boolean;
  readonly subjectRef: SubjectRef;
  readonly purposeRef: PurposeRef | null;
};

export type PurposeFact = {
  readonly ref: PurposeRef;
  readonly bound: boolean;
  readonly matchesUsage: boolean;
};

export type UsageReceiptFact = {
  readonly ref: UsageReceiptRef;
  readonly realized: boolean;
  readonly occurredAt: UtcInstant;
  readonly subjectRef: SubjectRef;
  readonly purposeRef: PurposeRef | null;
  readonly rightRef: InformationRightRef | null;
};

export type AttestationFact = {
  readonly ref: AttestationRef;
  readonly approved: boolean;
  readonly independent: boolean;
  readonly attestorRef: string;
  readonly subjectRef: SubjectRef;
  readonly conflictsWith: readonly AttestationRef[];
};

export type ProvenanceFact = {
  readonly ref: ProvenanceRef;
  readonly present: true;
};

export type HumanContributionEvidenceFacts = {
  readonly evaluatedAt: UtcInstant;
  readonly contributionFound: boolean;
  readonly rights: readonly RightFact[];
  readonly consents: readonly ConsentFact[];
  readonly purposes: readonly PurposeFact[];
  readonly usageReceipts: readonly UsageReceiptFact[];
  readonly attestations: readonly AttestationFact[];
  readonly provenance: readonly ProvenanceFact[];
  readonly evidenceItems: readonly EvidenceItemFact[];
  readonly jurisdictionResolved: boolean;
  readonly declaredSubjectRef: SubjectRef;
  readonly declaredMeasurement: ContributionMeasurement;
  readonly declaredPeriod: MeasurementPeriod;
  readonly declaredSourceClass: SourceClass;
  readonly declaredFingerprint: ContributionFingerprint;
  readonly expectedFingerprint: ContributionFingerprint;
  readonly expectedEvidenceDigest: string;
  readonly activeDuplicateFingerprint: boolean;
  readonly invalidSupersession: boolean;
  readonly rawPersonalDataPresent: false | true;
  readonly protectedTraitRankingPresent: false | true;
  readonly humanWorthScoringPresent: false | true;
  readonly modelInferenceSoleAuthority: boolean;
  readonly userDeclarationSoleAuthority: boolean;
  readonly companyOwnershipAlone: boolean;
  readonly modelTrainingPermission: boolean;
  readonly usageRealized: boolean;
  readonly eventPresent: boolean;
  readonly serviceAccepted: boolean;
  readonly royaltyContractPresent: boolean;
  readonly creativeRightPresent: boolean;
  readonly knowledgeArtifactPresent: boolean;
};

export type HumanContributionVerificationDecision = {
  readonly decisionId: VerificationDecisionId;
  readonly contributionId: ContributionId;
  readonly fingerprint: ContributionFingerprint;
  readonly policyId: VerificationPolicyId;
  readonly policyVersion: VerificationPolicyVersion;
  readonly decision: VerificationOutcome;
  readonly evaluatedEvidenceRefs: readonly EvidenceRef[];
  readonly evidenceDigest: string;
  readonly quality: VerificationDecisionQuality;
  readonly confidenceClass: VerificationConfidenceClass;
  readonly decisionCodes: readonly VerificationDecisionCode[];
  readonly evaluatedAt: UtcInstant;
  readonly containsRawPersonalData: false;
  readonly valuationPerformed: false;
  readonly sunReyQuantityCalculated: false;
  readonly mintAuthorityCreated: false;
  readonly executionAuthorityCreated: false;
};

export type VerificationEvaluationInput = {
  readonly bundle: HumanContributionEvidenceBundle;
  readonly policy: HumanContributionVerificationPolicy;
  readonly facts: HumanContributionEvidenceFacts;
  readonly fingerprint: ContributionFingerprint;
};

export type PrivacySafeInformationRightEvidence = {
  readonly contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION';
  readonly subjectPseudonymousRef: string;
  readonly descriptorId: string;
  readonly rightId: string;
  readonly consentRef: string;
  readonly purposeRef: string;
  readonly usageReceiptId: string;
  readonly usageReceiptHash: string;
  readonly approvedComputationId: string;
  readonly approvedComputationHash: string;
  readonly approvedComputationResultId: string | null;
  readonly settlementRef: string | null;
  readonly evidenceDigest: string;
  readonly occurredAt: UtcInstant;
  readonly rawPersonalData: false;
  readonly mintRequested: false;
  readonly unrestrictedIssuance: false;
  readonly automaticSunReyMint: false;
};
