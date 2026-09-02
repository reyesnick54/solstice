import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ContributionId,
  EventReference,
  EvidenceRef,
  ProvenanceRef,
  SubjectRef,
} from '../ids.ts';
import type { ContributionClass } from '../taxonomy.ts';
import type { AttestationSourceClass } from './source-classes.ts';

export const ATTESTATION_MESH_SCHEMA_VERSION = 1 as const;

export type AttestationStatementType =
  | 'CONTRIBUTION_OCCURRED'
  | 'AUTHORSHIP'
  | 'EMPLOYMENT'
  | 'CREDENTIAL_ISSUED'
  | 'CREDENTIAL_VALID'
  | 'COMPUTATION_COMPLETED'
  | 'DATA_USAGE'
  | 'WORK_RECEIPT'
  | 'PEER_CORROBORATION'
  | 'SELF_DECLARATION'
  | 'AUTHORIZED_DATA_CONTRIBUTION'
  | 'OTHER_GOVERNANCE_APPROVED';

export type AttestationValidity = 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED' | 'DISPUTED';

export type AttestationVerificationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'UNDER_REVIEW';

export type AttestationRightsStatus = 'CLEAR' | 'RESTRICTED' | 'UNKNOWN';

export type AttestationRights = {
  readonly status: AttestationRightsStatus;
  readonly refs: readonly string[];
};

export type IdentityAssuranceSummary = {
  readonly subjectRef: SubjectRef;
  readonly assuranceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRESOLVED';
  readonly sybilRisk: 'LOW' | 'ELEVATED' | 'BLOCKED';
  readonly pseudonymousOnly: true;
};

export type ContributionAttestation = {
  readonly attestationId: string;
  readonly issuer: string;
  readonly issuerClass: AttestationSourceClass;
  readonly subjectPseudonymousRef: SubjectRef;
  readonly contributionEventRef: EventReference;
  readonly claimRef: string | null;
  readonly statementType: AttestationStatementType;
  readonly issuedAt: UtcInstant;
  readonly validity: AttestationValidity;
  readonly signatureReference: string | null;
  readonly evidenceReferences: readonly EvidenceRef[];
  readonly provenance: readonly ProvenanceRef[];
  readonly rights: AttestationRights;
  readonly verificationStatus: AttestationVerificationStatus;
  readonly schemaVersion: typeof ATTESTATION_MESH_SCHEMA_VERSION;
  readonly lineageRootId: string;
  readonly upstreamOrganizationId: string;
  readonly grantsMonetaryAuthority: false;
  readonly grantsExecutionAuthority: false;
  readonly createsPeve: false;
  readonly authorizesSunReyIssuance: false;
};

export type HumanContributionVerificationResult =
  | 'VERIFIED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'DISPUTED'
  | 'IDENTITY_UNRESOLVED'
  | 'RIGHTS_RESTRICTED'
  | 'STALE'
  | 'INVALID'
  | 'MANUAL_REVIEW_REQUIRED';

export type VerificationExplanationCode =
  | 'ZERO_MONETARY_AUTHORITY'
  | 'ATTESTATION_MESH_EVALUATED'
  | 'INDEPENDENT_EVIDENCE_SATISFIED'
  | 'INDEPENDENT_EVIDENCE_INSUFFICIENT'
  | 'SELF_ATTESTATION_ONLY'
  | 'SELF_ATTESTATION_WEIGHT_APPLIED'
  | 'COPIED_SOURCE_LINEAGE'
  | 'SOURCE_LINEAGE_DEDUPLICATED'
  | 'CREDENTIAL_REVOKED'
  | 'CREDENTIAL_EXPIRED'
  | 'CREDENTIAL_ISSUER_UNTRUSTED'
  | 'FORGED_ATTESTATION'
  | 'DUPLICATE_RECEIPT'
  | 'ISSUER_MISMATCH'
  | 'SIGNATURE_MISMATCH'
  | 'IMPOSSIBLE_TIMESTAMP'
  | 'RECEIPT_REUSED_BY_MULTIPLE_ACTORS'
  | 'CONTRIBUTION_CLAIMED_BY_MULTIPLE_IDENTITIES'
  | 'PUBLICATION_AUTHOR_MISMATCH'
  | 'RIGHTS_RESTRICTED'
  | 'EVIDENCE_STALE'
  | 'IDENTITY_UNRESOLVED'
  | 'DISPUTED_ATTESTATION'
  | 'MANUAL_REVIEW_TRIGGERED'
  | 'CLASS_POLICY_SATISFIED'
  | 'CLASS_POLICY_UNSATISFIED'
  | 'FRAUD_SIGNAL_DETECTED';

export type AttestationLineageSummary = {
  readonly lineageRootId: string;
  readonly upstreamOrganizationId: string;
  readonly attestationIds: readonly string[];
  readonly issuerClasses: readonly AttestationSourceClass[];
  readonly countsAsIndependent: boolean;
};

export type HumanContributionVerificationReceipt = {
  readonly receiptId: string;
  readonly schemaVersion: typeof ATTESTATION_MESH_SCHEMA_VERSION;
  readonly humanActorRef: SubjectRef;
  readonly contributionEventRef: EventReference;
  readonly contributionId: ContributionId | null;
  readonly contributionClass: ContributionClass;
  readonly attestationsEvaluated: readonly string[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly sourceClasses: readonly AttestationSourceClass[];
  readonly sourceLineage: readonly AttestationLineageSummary[];
  readonly independentLineageRootCount: number;
  readonly identityAssurance: IdentityAssuranceSummary;
  readonly rightsStatus: AttestationRightsStatus;
  readonly freshness: {
    readonly evaluatedAt: UtcInstant;
    readonly stale: boolean;
    readonly oldestEvidenceAgeDays: number | null;
  };
  readonly conflicts: readonly string[];
  readonly verificationMethodology: string;
  readonly result: HumanContributionVerificationResult;
  readonly explanationCodes: readonly VerificationExplanationCode[];
  readonly fraudSignals: readonly string[];
  readonly grantsMonetaryAuthority: false;
  readonly grantsExecutionAuthority: false;
  readonly createsPeve: false;
  readonly authorizesSunReyIssuance: false;
};

export type AttestationMeshVerificationInput = {
  readonly contributionClass: ContributionClass;
  readonly contributionId?: ContributionId;
  readonly humanActorRef: SubjectRef;
  readonly contributionEventRef: EventReference;
  readonly attestations: readonly ContributionAttestation[];
  readonly evaluatedAt: UtcInstant;
  readonly identityAssurance?: IdentityAssuranceSummary;
  readonly maximumEvidenceAgeDays?: number;
};

export type AttestationMeshVerificationEvaluation = {
  readonly receipt: HumanContributionVerificationReceipt;
  readonly acceptedAttestations: readonly ContributionAttestation[];
};
