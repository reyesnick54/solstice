/**
 * Chunk 83 — independent security-review findings ingestion,
 * remediation, and retest evidence types.
 *
 * Extends Chunk 62 at packages/sunrey-chain/src/audit. This is not a
 * second audit-bundle owner. Software cannot claim that an independent
 * external audit occurred unless real external findings and evidence
 * are actually supplied.
 */

export const AUDIT_REMEDIATION_SCHEMA_VERSION = 1 as const;
export const TEST_FIXTURE_NOT_EXTERNAL_AUDIT = 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT' as const;
export const CLAIMS_EXTERNAL_AUDIT_COMPLETED = false as const;

export const FINDING_STATES = [
  'RECEIVED',
  'TRIAGED',
  'REPRODUCED',
  'REMEDIATION_IN_PROGRESS',
  'REMEDIATED_PENDING_RETEST',
  'EXTERNALLY_RETESTED',
  'ACCEPTED_RISK',
  'NOT_REPRODUCIBLE_WITH_EVIDENCE',
  'SUPERSEDED',
] as const;
export type FindingState = (typeof FINDING_STATES)[number];

export const FINDING_SEVERITIES = [
  'INFORMATIONAL',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_AFFECTED_SURFACES = [
  'consensus',
  'encoding',
  'cryptography',
  'PQC',
  'validators',
  'wallets',
  'native_assets',
  'monetary_policy',
  'fees',
  'MoonRey_issuance',
  'oracles',
  'machine_economy',
  'Exchange',
  'custody',
  'treasury',
  'interop',
  'privacy',
  'governance',
  'storage',
  'infrastructure',
  'supply_chain',
  'operations',
] as const;
export type FindingAffectedSurface = (typeof FINDING_AFFECTED_SURFACES)[number];

export const DISCLOSURE_CLASSES = [
  'PUBLIC',
  'REVIEWER_SHARED',
  'SECURITY_RESTRICTED',
] as const;
export type DisclosureClass = (typeof DISCLOSURE_CLASSES)[number];

export const ACTOR_KINDS = ['HUMAN', 'AI', 'SYSTEM'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const EVIDENCE_VERIFICATION_STATES = [
  'UNVERIFIED',
  'HUMAN_VERIFIED',
  'REJECTED',
  'FIXTURE_ONLY',
] as const;
export type EvidenceVerificationState = (typeof EVIDENCE_VERIFICATION_STATES)[number];

export const HUMAN_ACCEPTANCE_STATES = [
  'NOT_ACCEPTED',
  'ACCEPTED_BY_HUMAN',
  'REJECTED_BY_HUMAN',
  'FIXTURE_ONLY',
] as const;
export type HumanAcceptanceState = (typeof HUMAN_ACCEPTANCE_STATES)[number];

export const CANDIDATE_V2_AUDIT_STATES = [
  'NO_EXTERNAL_REVIEW',
  'EXTERNAL_REVIEW_IN_PROGRESS',
  'FINDINGS_OPEN',
  'REMEDIATION_IN_PROGRESS',
  'RETEST_PENDING',
  'EXTERNAL_REVIEW_EVIDENCE_ACCEPTED',
] as const;
export type CandidateV2AuditState = (typeof CANDIDATE_V2_AUDIT_STATES)[number];

export const RETEST_OUTCOMES = [
  'PASS',
  'FAIL',
  'PARTIAL',
  'NOT_PERFORMED',
] as const;
export type RetestOutcome = (typeof RETEST_OUTCOMES)[number];

export const SECURITY_CRITICAL_SURFACES: readonly FindingAffectedSurface[] = [
  'consensus',
  'cryptography',
  'wallets',
  'validators',
  'native_assets',
  'Exchange',
  'custody',
  'governance',
];

export const HEIGHTENED_REVIEW_BOUNDARIES = [
  'consensus',
  'cryptography',
  'signer_safety',
  'native_supply',
  'DVP',
  'custody_signing',
  'governance_authority',
] as const;
export type HeightenedReviewBoundary = (typeof HEIGHTENED_REVIEW_BOUNDARIES)[number];

export type ReviewPeriod = {
  readonly startedAtUtc: string | null;
  readonly endedAtUtc: string | null;
  readonly notes: string;
};

export type ExternalSecurityReview = {
  readonly reviewId: string;
  readonly reviewOrganizationReference: string;
  readonly scope: string;
  readonly sourceCommit: string;
  readonly protocolVersion: string;
  readonly releaseCandidate: string | null;
  readonly reviewPeriod: ReviewPeriod;
  readonly reportDigest: string | null;
  readonly evidenceVerificationState: EvidenceVerificationState;
  readonly humanAcceptanceState: HumanAcceptanceState;
  readonly fixtureLabel: typeof TEST_FIXTURE_NOT_EXTERNAL_AUDIT | null;
  readonly inventedAuditorName: false;
  readonly claimsExternalAuditCompleted: false;
};

export type ExternalSecurityFinding = {
  readonly findingId: string;
  readonly externalReviewId: string;
  readonly externalSeverity: string;
  readonly internalEngineeringSeverity: FindingSeverity | null;
  readonly title: string;
  readonly affectedComponent: string;
  readonly affectedSurface: FindingAffectedSurface;
  readonly affectedCommit: string;
  readonly affectedVersion: string | null;
  readonly descriptionReference: string;
  readonly evidenceReference: string;
  readonly status: FindingState;
  readonly remediationOwner: string | null;
  readonly disclosureClass: DisclosureClass;
  readonly providerSurfaceReference: string | null;
  readonly supersededBy: string | null;
  readonly fixtureLabel: typeof TEST_FIXTURE_NOT_EXTERNAL_AUDIT | null;
};

export type FindingEvidenceChainRecord = {
  readonly recordId: string;
  readonly findingId: string;
  readonly actor: ActorKind;
  readonly actorReference: string;
  readonly timestampUtc: string;
  readonly sourceState: FindingState | null;
  readonly destinationState: FindingState;
  readonly evidenceReference: string;
  readonly commitReference: string;
  readonly signatureHex: string | null;
};

export type FindingRemediationPlan = {
  readonly planId: string;
  readonly findingId: string;
  readonly rootCauseDescription: string;
  readonly affectedAuthorityBoundary: string;
  readonly proposedFix: string;
  readonly migrationImpact: string;
  readonly compatibilityImpact: string;
  readonly securityAssumptions: string;
  readonly requiredTests: readonly string[];
  readonly owner: string;
  readonly targetRelease: string;
  readonly heightenedReviewRequired: boolean;
  readonly heightenedReviewBoundary: HeightenedReviewBoundary | null;
  readonly usesHomegrownCryptography: false;
  readonly usesEstablishedPrimitives: boolean;
};

export type FindingRemediationEvidence = {
  readonly evidenceId: string;
  readonly findingId: string;
  readonly planId: string;
  readonly remediatedCommit: string;
  readonly patchDigest: string;
  readonly artifactHash: string;
  readonly notes: string;
};

export type FindingRegressionEvidence = {
  readonly evidenceId: string;
  readonly findingId: string;
  readonly testReference: string;
  readonly commit: string;
  readonly result: 'PASS' | 'FAIL';
  readonly artifactHash: string;
  readonly formalReference: string | null;
  readonly fuzzCorpusReference: string | null;
  readonly adversarialScenarioId: string | null;
  readonly performanceComparisonReference: string | null;
};

export type FindingRetestRequest = {
  readonly requestId: string;
  readonly findingId: string;
  readonly originalReportReference: string;
  readonly affectedOldCommit: string;
  readonly remediatedCommit: string;
  readonly patchDigest: string;
  readonly regressionTest: string;
  readonly formalEvidence: string | null;
  readonly fuzzEvidence: string | null;
  readonly rangeEvidence: string | null;
  readonly buildInstructions: string;
  readonly reproductionInstructions: string;
};

export type FindingRetestResult = {
  readonly resultId: string;
  readonly requestId: string;
  readonly findingId: string;
  readonly reviewerIdentityReference: string;
  readonly dateUtc: string;
  readonly scope: string;
  readonly result: RetestOutcome;
  readonly reportDigest: string;
  readonly humanEvidenceVerification: boolean;
  readonly softwareGenerated: false;
  readonly boundCommit: string;
};

export type SecurityRiskAcceptance = {
  readonly acceptanceId: string;
  readonly findingId: string;
  readonly reason: string;
  readonly impact: string;
  readonly compensatingControls: readonly string[];
  readonly expirationOrReviewDateUtc: string;
  readonly humanSecurityAuthority: string;
  readonly releaseScope: string;
  readonly actor: 'HUMAN';
  readonly aiAccepted: false;
};

export type SecurityReviewStatusReport = {
  readonly reviewId: string | null;
  readonly reviewScope: string;
  readonly findingCountsBySeverity: Readonly<Record<FindingSeverity, number>>;
  readonly findingCountsByState: Readonly<Record<FindingState, number>>;
  readonly openBlockers: readonly string[];
  readonly acceptedRisks: readonly string[];
  readonly retestStatus: string;
  readonly affectedReleases: readonly string[];
  readonly readinessEffect: string;
  readonly candidateV2State: CandidateV2AuditState;
  readonly claimsExternalAuditCompleted: false;
  readonly fixtureOnly: boolean;
};

export type AuditRemediationBundle = {
  readonly bundleId: string;
  readonly reviewId: string | null;
  readonly sourceCommit: string;
  readonly artifactHashes: readonly { readonly path: string; readonly sha256: string }[];
  readonly bundleDigest: string;
  readonly generatedAtUtc: string;
  readonly claimsExternalAuditCompleted: false;
  readonly fixtureLabel: typeof TEST_FIXTURE_NOT_EXTERNAL_AUDIT | null;
};

export type ReleaseSecurityQuery = {
  readonly openCriticalFindings: readonly string[];
  readonly openHighFindings: readonly string[];
  readonly acceptedRisks: readonly string[];
  readonly externalRetestState: string;
  readonly criticalIsMainnetBlocker: boolean;
  readonly highReleasePolicy: 'BLOCK_PRODUCTION' | 'REQUIRE_HUMAN_WAIVER' | 'TRACK_ONLY';
  readonly claimsExternalAuditCompleted: false;
};

export type ProductionSecurityPolicy = {
  readonly criticalOpenFindingsBlockMainnet: boolean;
  readonly highOpenFindingsPolicy: 'BLOCK_PRODUCTION' | 'REQUIRE_HUMAN_WAIVER' | 'TRACK_ONLY';
  readonly informationalFindingsBlockMainnet: false;
  readonly humanApproved: boolean;
  readonly approvedBy: string | null;
};

export type ProviderSurfaceReference = {
  readonly surfaceId: string;
  readonly providerKind:
    | 'identity'
    | 'screening'
    | 'travel_rule'
    | 'hsm_custody'
    | 'surveillance'
    | 'case_management'
    | 'oracle'
    | 'other';
  readonly inReviewScope: boolean;
  readonly chunk82Contract: true;
};

export type PublicFindingView = {
  readonly findingId: string;
  readonly title: string;
  readonly status: FindingState;
  readonly externalSeverity: string;
  readonly internalEngineeringSeverity: FindingSeverity | null;
  readonly affectedSurface: FindingAffectedSurface;
  readonly disclosureClass: DisclosureClass;
  readonly exploitDetailExposed: false;
  readonly description: string;
};
