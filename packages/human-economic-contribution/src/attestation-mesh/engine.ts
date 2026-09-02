/**
 * Human Contribution Attestation Mesh verification engine.
 *
 * Establishes whether a claimed human contribution genuinely occurred using
 * multiple forms of evidence and attestation. Zero monetary authority.
 */

import { sha256Canonical } from '../ids.ts';
import { analyzeAttestationIndependence, copiedSourceLineageDetected } from './independence.ts';
import { classAttestationRequirementFor, HUMAN_CONTRIBUTION_ATTESTATION_VERIFICATION_POLICY } from './policy.ts';
import {
  countsTowardIndependentEvidence,
  isSelfAttestationSource,
  isStrongAttestationSource,
} from './source-classes.ts';
import { detectFraudSignals, fraudSignalsRequireRejection, fraudSignalsRequireReview } from './fraud.ts';
import { verifyCredential, type CredentialVerificationInput } from './credentials.ts';
import type {
  AttestationMeshVerificationEvaluation,
  AttestationMeshVerificationInput,
  AttestationLineageSummary,
  AttestationRightsStatus,
  ContributionAttestation,
  HumanContributionVerificationReceipt,
  HumanContributionVerificationResult,
  IdentityAssuranceSummary,
  VerificationExplanationCode,
} from './types.ts';
import { ATTESTATION_MESH_METHODOLOGY } from './policy.ts';

function daysBetween(later: string, earlier: string): number {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86_400_000);
}

function defaultIdentityAssurance(subjectRef: AttestationMeshVerificationInput['humanActorRef']): IdentityAssuranceSummary {
  return Object.freeze({
    subjectRef,
    assuranceLevel: 'MEDIUM',
    sybilRisk: 'LOW',
    pseudonymousOnly: true,
  });
}

function rightsStatusOf(attestations: readonly ContributionAttestation[]): AttestationRightsStatus {
  if (attestations.some((row) => row.rights.status === 'RESTRICTED')) {
    return 'RESTRICTED';
  }
  if (attestations.every((row) => row.rights.status === 'CLEAR')) {
    return 'CLEAR';
  }
  return 'UNKNOWN';
}

function acceptedAttestations(attestations: readonly ContributionAttestation[]): readonly ContributionAttestation[] {
  return Object.freeze(
    attestations.filter(
      (row) =>
        row.validity === 'VALID' &&
        row.verificationStatus === 'ACCEPTED' &&
        !isSelfAttestationSource(row.issuerClass),
    ),
  );
}

function selfAttestationsOnly(attestations: readonly ContributionAttestation[]): boolean {
  const valid = attestations.filter((row) => row.validity === 'VALID' && row.verificationStatus !== 'REJECTED');
  return valid.length > 0 && valid.every((row) => isSelfAttestationSource(row.issuerClass));
}

function buildLineageSummaries(attestations: readonly ContributionAttestation[]): readonly AttestationLineageSummary[] {
  const analysis = analyzeAttestationIndependence(attestations);
  return Object.freeze(
    analysis.sharedLineageGroups.map((group) =>
      Object.freeze({
        lineageRootId: group.lineageRootId,
        upstreamOrganizationId: group.upstreamOrganizationId,
        attestationIds: group.attestationIds,
        issuerClasses: group.issuerClasses,
        countsAsIndependent: group.attestationIds.some((id) => {
          const row = attestations.find((candidate) => candidate.attestationId === id);
          return row !== undefined && countsTowardIndependentEvidence(row.issuerClass) && row.validity === 'VALID';
        }),
      }),
    ),
  );
}

function receiptIdFor(material: string): string {
  return `hcvr_${sha256Canonical(material).slice(0, 32)}`;
}

export function verifyHumanContribution(
  input: AttestationMeshVerificationInput,
  options: {
    readonly credentialChecks?: readonly CredentialVerificationInput[];
    readonly fraudContext?: Partial<import('./fraud.ts').FraudDetectionContext>;
  } = {},
): AttestationMeshVerificationEvaluation {
  const policy = HUMAN_CONTRIBUTION_ATTESTATION_VERIFICATION_POLICY;
  const classRequirement = classAttestationRequirementFor(input.contributionClass);
  const codes: VerificationExplanationCode[] = ['ZERO_MONETARY_AUTHORITY', 'ATTESTATION_MESH_EVALUATED'];
  const identityAssurance = input.identityAssurance ?? defaultIdentityAssurance(input.humanActorRef);
  const maxAgeDays = input.maximumEvidenceAgeDays ?? policy.maximumEvidenceAgeDays;

  const fraudSignals = detectFraudSignals({
    attestations: input.attestations,
    expectedSubjectRef: String(input.humanActorRef),
    expectedContributionEventRef: String(input.contributionEventRef),
    evaluatedAt: input.evaluatedAt,
    ...options.fraudContext,
  });

  if (fraudSignals.length > 0) {
    codes.push('FRAUD_SIGNAL_DETECTED');
    for (const signal of fraudSignals) {
      if (signal.kind === 'FORGED_ATTESTATION') codes.push('FORGED_ATTESTATION');
      if (signal.kind === 'DUPLICATE_RECEIPT') codes.push('DUPLICATE_RECEIPT');
      if (signal.kind === 'ISSUER_MISMATCH') codes.push('ISSUER_MISMATCH');
      if (signal.kind === 'SIGNATURE_MISMATCH') codes.push('SIGNATURE_MISMATCH');
      if (signal.kind === 'IMPOSSIBLE_TIMESTAMP') codes.push('IMPOSSIBLE_TIMESTAMP');
      if (signal.kind === 'RECEIPT_REUSED_BY_MULTIPLE_ACTORS') codes.push('RECEIPT_REUSED_BY_MULTIPLE_ACTORS');
      if (signal.kind === 'CONTRIBUTION_CLAIMED_BY_MULTIPLE_IDENTITIES') codes.push('CONTRIBUTION_CLAIMED_BY_MULTIPLE_IDENTITIES');
      if (signal.kind === 'PUBLICATION_AUTHOR_MISMATCH') codes.push('PUBLICATION_AUTHOR_MISMATCH');
    }
  }

  const independence = analyzeAttestationIndependence(input.attestations);
  if (copiedSourceLineageDetected(input.attestations)) {
    codes.push('COPIED_SOURCE_LINEAGE', 'SOURCE_LINEAGE_DEDUPLICATED');
  }

  const rightsStatus = rightsStatusOf(input.attestations);
  if (rightsStatus === 'RESTRICTED') {
    codes.push('RIGHTS_RESTRICTED');
  }

  let oldestEvidenceAgeDays: number | null = null;
  let stale = false;
  for (const attestation of input.attestations) {
    const age = daysBetween(input.evaluatedAt, attestation.issuedAt);
    oldestEvidenceAgeDays = oldestEvidenceAgeDays === null ? age : Math.max(oldestEvidenceAgeDays, age);
    if (age > maxAgeDays) {
      stale = true;
    }
  }
  if (stale) {
    codes.push('EVIDENCE_STALE');
  }

  if (identityAssurance.assuranceLevel === 'UNRESOLVED' || identityAssurance.sybilRisk === 'BLOCKED') {
    codes.push('IDENTITY_UNRESOLVED');
  }

  if (input.attestations.some((row) => row.validity === 'DISPUTED')) {
    codes.push('DISPUTED_ATTESTATION');
  }

  if (selfAttestationsOnly(input.attestations)) {
    codes.push('SELF_ATTESTATION_ONLY', 'SELF_ATTESTATION_WEIGHT_APPLIED');
  } else if (input.attestations.some((row) => isSelfAttestationSource(row.issuerClass))) {
    codes.push('SELF_ATTESTATION_WEIGHT_APPLIED');
  }

  const credentialResults = (options.credentialChecks ?? []).map((credential) => verifyCredential(credential));
  let credentialFailure = false;
  for (const result of credentialResults) {
    if (result.lifecycleState === 'CREDENTIAL_REVOKED') codes.push('CREDENTIAL_REVOKED');
    if (result.lifecycleState === 'CREDENTIAL_EXPIRED') codes.push('CREDENTIAL_EXPIRED');
    if (result.issuerTrust === 'UNTRUSTED') codes.push('CREDENTIAL_ISSUER_UNTRUSTED');
    if (!result.valid) {
      credentialFailure = true;
    }
  }

  let classSatisfied = true;
  if (classRequirement) {
    const strongAccepted = acceptedAttestations(input.attestations).filter((row) =>
      classRequirement.requiredSourceClasses.includes(row.issuerClass) ||
      isStrongAttestationSource(row.issuerClass),
    );
    const hasRequiredSource = strongAccepted.some((row) => classRequirement.requiredSourceClasses.includes(row.issuerClass));
    const hasRequiredStatement = strongAccepted.some((row) =>
      classRequirement.requiredStatementTypes.includes(row.statementType),
    );
    const independentEnough = independence.independentLineageRootCount >= classRequirement.minimumIndependentLineageRoots;

    if (!hasRequiredSource || !hasRequiredStatement || !independentEnough) {
      classSatisfied = false;
      codes.push('CLASS_POLICY_UNSATISFIED', 'INDEPENDENT_EVIDENCE_INSUFFICIENT');
    } else {
      codes.push('CLASS_POLICY_SATISFIED', 'INDEPENDENT_EVIDENCE_SATISFIED');
    }
  } else if (acceptedAttestations(input.attestations).length === 0) {
    classSatisfied = false;
    codes.push('INDEPENDENT_EVIDENCE_INSUFFICIENT');
  } else {
    codes.push('INDEPENDENT_EVIDENCE_SATISFIED');
  }

  let result: HumanContributionVerificationResult = 'VERIFIED';

  if (fraudSignalsRequireRejection(fraudSignals)) {
    result = 'INVALID';
  } else if (credentialFailure && classRequirement?.requiresCredentialVerification) {
    result = 'INVALID';
  } else if (identityAssurance.assuranceLevel === 'UNRESOLVED' || identityAssurance.sybilRisk === 'BLOCKED') {
    result = 'IDENTITY_UNRESOLVED';
  } else if (rightsStatus === 'RESTRICTED') {
    result = 'RIGHTS_RESTRICTED';
  } else if (input.attestations.some((row) => row.validity === 'DISPUTED')) {
    result = 'DISPUTED';
  } else if (stale) {
    result = 'STALE';
  } else if (selfAttestationsOnly(input.attestations)) {
    result = 'INSUFFICIENT_EVIDENCE';
  } else if (!classSatisfied || independence.independentLineageRootCount === 0) {
    result = 'INSUFFICIENT_EVIDENCE';
  } else if (fraudSignalsRequireReview(fraudSignals)) {
    result = 'MANUAL_REVIEW_REQUIRED';
    codes.push('MANUAL_REVIEW_TRIGGERED');
  }

  const uniqueCodes = Object.freeze([...new Set(codes)] as VerificationExplanationCode[]);
  const sourceClasses = Object.freeze([...new Set(input.attestations.map((row) => row.issuerClass))].sort());
  const evidenceRefs = Object.freeze(
    [...new Set(input.attestations.flatMap((row) => row.evidenceReferences.map(String)))].sort(),
  );

  const receiptMaterial = [
    String(input.humanActorRef),
    String(input.contributionEventRef),
    input.contributionClass,
    input.evaluatedAt,
    result,
    uniqueCodes.join(','),
    input.attestations.map((row) => row.attestationId).sort().join(','),
  ].join('\n');

  const receipt: HumanContributionVerificationReceipt = Object.freeze({
    receiptId: receiptIdFor(receiptMaterial),
    schemaVersion: 1,
    humanActorRef: input.humanActorRef,
    contributionEventRef: input.contributionEventRef,
    contributionId: input.contributionId ?? null,
    contributionClass: input.contributionClass,
    attestationsEvaluated: Object.freeze(input.attestations.map((row) => row.attestationId).sort()),
    evidenceRefs: evidenceRefs as HumanContributionVerificationReceipt['evidenceRefs'],
    sourceClasses,
    sourceLineage: buildLineageSummaries(input.attestations),
    independentLineageRootCount: independence.independentLineageRootCount,
    identityAssurance,
    rightsStatus,
    freshness: Object.freeze({
      evaluatedAt: input.evaluatedAt,
      stale,
      oldestEvidenceAgeDays,
    }),
    conflicts: Object.freeze(
      input.attestations.filter((row) => row.validity === 'DISPUTED').map((row) => row.attestationId),
    ),
    verificationMethodology: ATTESTATION_MESH_METHODOLOGY,
    result,
    explanationCodes: uniqueCodes,
    fraudSignals: Object.freeze(fraudSignals.map((signal) => signal.kind)),
    grantsMonetaryAuthority: false,
    grantsExecutionAuthority: false,
    createsPeve: false,
    authorizesSunReyIssuance: false,
  });

  return Object.freeze({
    receipt,
    acceptedAttestations: acceptedAttestations(input.attestations),
  });
}

export class HumanContributionAttestationMesh {
  verify(input: AttestationMeshVerificationInput): AttestationMeshVerificationEvaluation {
    return verifyHumanContribution(input);
  }
}

export function createContributionAttestation(
  draft: Omit<ContributionAttestation, 'schemaVersion' | 'grantsMonetaryAuthority' | 'grantsExecutionAuthority' | 'createsPeve' | 'authorizesSunReyIssuance'>,
): ContributionAttestation {
  return Object.freeze({
    ...draft,
    schemaVersion: 1,
    grantsMonetaryAuthority: false,
    grantsExecutionAuthority: false,
    createsPeve: false,
    authorizesSunReyIssuance: false,
  });
}
