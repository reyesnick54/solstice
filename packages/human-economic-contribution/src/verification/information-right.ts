import {
  consentGrantRefFor,
  contributionIdFor,
  evidenceRefFor,
  eventReferenceFor,
  informationRightRefFor,
  purposeRefFor,
  subjectRefFor,
  usageReceiptRefFor,
} from '../ids.ts';
import type { ContributionMeasurement } from '../types.ts';
import { createHumanContributionEvidenceBundle } from './evidence.ts';
import type {
  HumanContributionEvidenceBundle,
  HumanContributionEvidenceFacts,
  PrivacySafeInformationRightEvidence,
} from './types.ts';

const INFORMATION_RIGHT_MEASUREMENT: ContributionMeasurement = Object.freeze({
  quantity: 1n,
  unit: 'CONSENT_SCOPED_INFORMATION_USE',
  unlikeUnitsEconomicallyEquivalent: false,
  isMonetaryValuation: false,
  isSunReyQuantity: false,
  isPeveScore: false,
});

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Map privacy-safe HIN information-right evidence onto a Chunk 109
 * evidence bundle. Ownership or consent alone must not produce
 * VERIFIED; the verification engine still evaluates the class policy.
 */
export function bundleFromInformationRightEvidence(
  evidence: PrivacySafeInformationRightEvidence,
): HumanContributionEvidenceBundle {
  const rightsReferences = present(evidence.rightId) ? [informationRightRefFor(evidence.rightId)] : [];
  const consentReferences = present(evidence.consentRef) ? [consentGrantRefFor(evidence.consentRef)] : [];
  const purposeReferences = present(evidence.purposeRef) ? [purposeRefFor(evidence.purposeRef)] : [];
  const usageReceiptReferences = present(evidence.usageReceiptId)
    ? [usageReceiptRefFor(evidence.usageReceiptId)]
    : [];
  const evidenceReferences = [
    ...(present(evidence.evidenceDigest) ? [evidenceRefFor(evidence.evidenceDigest)] : []),
    ...(present(evidence.usageReceiptHash) ? [evidenceRefFor(`receipt-hash:${evidence.usageReceiptHash}`)] : []),
    ...(present(evidence.approvedComputationHash)
      ? [evidenceRefFor(`computation:${evidence.approvedComputationHash}`)]
      : []),
  ];
  return createHumanContributionEvidenceBundle({
    contributionId: contributionIdFor(`hin:${evidence.usageReceiptId}:${evidence.rightId}`),
    subjectRef: subjectRefFor(evidence.subjectPseudonymousRef),
    contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    sourceClass: 'HUMAN_INFORMATION_NETWORK',
    eventReference: eventReferenceFor(evidence.usageReceiptId || evidence.descriptorId),
    measurement: INFORMATION_RIGHT_MEASUREMENT,
    measurementUnit: 'CONSENT_SCOPED_INFORMATION_USE',
    measurementPeriod: { start: evidence.occurredAt, end: null },
    evidenceReferences,
    rightsReferences,
    consentReferences,
    purposeReferences,
    usageReceiptReferences,
    jurisdiction: 'GB',
    createdAt: evidence.occurredAt,
  });
}

export function factsFromInformationRightEvidence(
  evidence: PrivacySafeInformationRightEvidence,
  bundle: HumanContributionEvidenceBundle,
  extras: Partial<HumanContributionEvidenceFacts> = {},
): HumanContributionEvidenceFacts {
  const rightPresent = present(evidence.rightId);
  const consentPresent = present(evidence.consentRef);
  const purposePresent = present(evidence.purposeRef);
  const usagePresent = present(evidence.usageReceiptId) && present(evidence.usageReceiptHash);
  const realized = usagePresent && present(evidence.approvedComputationId);
  const purposeRef = purposePresent ? bundle.purposeReferences[0] ?? null : null;
  const base: HumanContributionEvidenceFacts = {
    evaluatedAt: evidence.occurredAt,
    contributionFound: true,
    rights: bundle.rightsReferences.map((ref) => ({
      ref,
      valid: rightPresent,
      expired: false,
      revokedBeforeUse: false,
      subjectRef: bundle.subjectRef,
      purposeRef,
    })),
    consents: bundle.consentReferences.map((ref) => ({
      ref,
      valid: consentPresent,
      required: true,
      subjectRef: bundle.subjectRef,
      purposeRef,
    })),
    purposes: bundle.purposeReferences.map((ref) => ({
      ref,
      bound: purposePresent,
      matchesUsage: purposePresent && realized,
    })),
    usageReceipts: bundle.usageReceiptReferences.map((ref) => ({
      ref,
      realized,
      occurredAt: evidence.occurredAt,
      subjectRef: bundle.subjectRef,
      purposeRef,
      rightRef: bundle.rightsReferences[0] ?? null,
    })),
    attestations: [],
    provenance: [],
    evidenceItems: bundle.evidenceReferences.map((ref) => ({
      ref,
      createdAt: evidence.occurredAt,
      stale: false,
      conflicted: false,
      digest: bundle.evidenceDigest,
    })),
    jurisdictionResolved: true,
    declaredSubjectRef: bundle.subjectRef,
    declaredMeasurement: bundle.measurement,
    declaredPeriod: bundle.measurementPeriod,
    declaredSourceClass: bundle.sourceClass,
    declaredFingerprint: extras.declaredFingerprint ?? extras.expectedFingerprint ?? ('' as HumanContributionEvidenceFacts['declaredFingerprint']),
    expectedFingerprint: extras.expectedFingerprint ?? extras.declaredFingerprint ?? ('' as HumanContributionEvidenceFacts['expectedFingerprint']),
    expectedEvidenceDigest: extras.expectedEvidenceDigest ?? bundle.evidenceDigest,
    activeDuplicateFingerprint: false,
    invalidSupersession: false,
    rawPersonalDataPresent: evidence.rawPersonalData !== false,
    protectedTraitRankingPresent: false,
    humanWorthScoringPresent: false,
    modelInferenceSoleAuthority: false,
    userDeclarationSoleAuthority: false,
    companyOwnershipAlone: false,
    modelTrainingPermission: false,
    usageRealized: realized,
    eventPresent: present(evidence.usageReceiptId) || present(evidence.descriptorId),
    serviceAccepted: false,
    royaltyContractPresent: false,
    creativeRightPresent: rightPresent,
    knowledgeArtifactPresent: present(evidence.approvedComputationId),
  };
  return Object.freeze({
    ...base,
    ...extras,
    expectedEvidenceDigest: extras.expectedEvidenceDigest ?? bundle.evidenceDigest,
  });
}
