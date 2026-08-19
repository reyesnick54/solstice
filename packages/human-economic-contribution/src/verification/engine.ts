import { verificationDecisionIdFor } from '../ids.ts';
import { fingerprintEconomicEvent } from '../fingerprint.ts';
import type { HumanContributionRegistryRecord } from '../types.ts';
import { isNonAuthoritativeSource } from '../taxonomy.ts';
import { duplicatedReferences, digestEvidenceBundleInput } from './evidence.ts';
import { PRODUCTION_LEGAL_COMMERCIAL_POLICY, classRequirementFor } from './policy.ts';
import { requiresAdditionalEvidence, type VerificationDecisionCode } from './rejections.ts';
import type {
  ClassEvidenceRequirement,
  EvidenceKind,
  HumanContributionEvidenceBundle,
  HumanContributionEvidenceFacts,
  HumanContributionVerificationDecision,
  HumanContributionVerificationPolicy,
  VerificationConfidenceClass,
  VerificationDecisionQuality,
  VerificationEvaluationInput,
  VerificationOutcome,
} from './types.ts';

function daysBetween(later: string, earlier: string): number {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86_400_000);
}

function kindSatisfied(
  kind: EvidenceKind,
  bundle: HumanContributionEvidenceBundle,
  facts: HumanContributionEvidenceFacts,
): boolean {
  switch (kind) {
    case 'EVENT':
      return facts.eventPresent && bundle.eventReference.length > 0;
    case 'MEASUREMENT':
      return bundle.measurement.quantity > 0n;
    case 'INFORMATION_RIGHT':
    case 'CREATIVE_RIGHT':
      return bundle.rightsReferences.length > 0 && facts.rights.length > 0;
    case 'CONSENT':
      return bundle.consentReferences.length > 0 && facts.consents.some((consent) => consent.valid);
    case 'PURPOSE':
      return bundle.purposeReferences.length > 0 && facts.purposes.some((purpose) => purpose.bound);
    case 'USAGE_RECEIPT':
      return bundle.usageReceiptReferences.length > 0;
    case 'USAGE_REALIZED':
      return facts.usageRealized && facts.usageReceipts.some((receipt) => receipt.realized);
    case 'PROVENANCE':
      return bundle.provenanceReferences.length > 0 && facts.provenance.length > 0;
    case 'ATTESTATION':
      return bundle.attestationReferences.length > 0 && facts.attestations.some((row) => row.approved);
    case 'INDEPENDENT_ATTESTATION':
      return facts.attestations.some((row) => row.approved && row.independent);
    case 'MODEL_TRAINING_PERMISSION':
      return facts.modelTrainingPermission;
    case 'SERVICE_ACCEPTANCE':
      return facts.serviceAccepted;
    case 'ROYALTY_CONTRACT':
      return facts.royaltyContractPresent;
    default:
      return false;
  }
}

function missingCodeFor(kind: EvidenceKind): VerificationDecisionCode {
  switch (kind) {
    case 'CONSENT':
      return 'CONSENT_REQUIRED';
    case 'PURPOSE':
      return 'PURPOSE_REQUIRED';
    case 'INFORMATION_RIGHT':
    case 'CREATIVE_RIGHT':
      return 'RIGHT_REQUIRED';
    case 'USAGE_RECEIPT':
      return 'USAGE_RECEIPT_REQUIRED';
    case 'USAGE_REALIZED':
      return 'USAGE_NOT_REALIZED';
    case 'ATTESTATION':
      return 'ATTESTATION_REQUIRED';
    case 'INDEPENDENT_ATTESTATION':
      return 'INDEPENDENT_ATTESTATION_REQUIRED';
    default:
      return 'EVIDENCE_MISSING';
  }
}

function collectCodes(input: VerificationEvaluationInput): VerificationDecisionCode[] {
  const { bundle, policy, facts, fingerprint } = input;
  const codes: VerificationDecisionCode[] = [];
  const remember = (code: VerificationDecisionCode): void => {
    if (!codes.includes(code)) {
      codes.push(code);
    }
  };

  if (facts.rawPersonalDataPresent) {
    remember('RAW_PERSONAL_DATA_FORBIDDEN');
  }
  if (facts.protectedTraitRankingPresent) {
    remember('PROTECTED_TRAIT_RANKING_FORBIDDEN');
  }
  if (facts.humanWorthScoringPresent) {
    remember('HUMAN_WORTH_SCORING_FORBIDDEN');
  }
  if (PRODUCTION_LEGAL_COMMERCIAL_POLICY.status !== 'NOT_ACTIVATED') {
    remember('PRODUCTION_POLICY_NOT_ACTIVATED');
  }
  if (policy.status !== 'ACTIVE' || policy.parameterClass !== 'ENGINEERING_SIMULATION_PARAMETERS') {
    remember('POLICY_NOT_ACTIVE');
  }
  if (policy.counselApproval !== 'NOT_CLAIMED' || policy.productionLegalCommercialPolicy !== 'NOT_ACTIVATED') {
    remember('PRODUCTION_POLICY_NOT_ACTIVATED');
  }
  if (!facts.contributionFound) {
    remember('CONTRIBUTION_NOT_FOUND');
    return codes;
  }

  const computedDigest = digestEvidenceBundleInput(bundle);
  if (computedDigest !== bundle.evidenceDigest || computedDigest !== facts.expectedEvidenceDigest) {
    remember('EVIDENCE_DIGEST_TAMPERED');
  }

  const duplicateEvidence = duplicatedReferences(bundle.evidenceReferences);
  if (policy.duplicateRules.rejectDuplicatedEvidenceReferences && duplicateEvidence.length > 0) {
    remember('DUPLICATED_EVIDENCE_REFERENCE');
  }

  if (facts.declaredSubjectRef !== bundle.subjectRef) {
    remember('SUBJECT_MISMATCH');
  }
  if (
    facts.rights.some((right) => right.subjectRef !== bundle.subjectRef) ||
    facts.consents.some((consent) => consent.subjectRef !== bundle.subjectRef) ||
    facts.usageReceipts.some((receipt) => receipt.subjectRef !== bundle.subjectRef) ||
    facts.attestations.some((row) => row.subjectRef !== bundle.subjectRef)
  ) {
    remember('SUBJECT_MISMATCH');
  }

  if (
    facts.declaredMeasurement.quantity !== bundle.measurement.quantity ||
    facts.declaredMeasurement.unit !== bundle.measurement.unit
  ) {
    remember('MEASUREMENT_MISMATCH');
  }
  if (
    facts.declaredPeriod.start !== bundle.measurementPeriod.start ||
    (facts.declaredPeriod.end ?? '') !== (bundle.measurementPeriod.end ?? '')
  ) {
    remember('PERIOD_MISMATCH');
  }
  if (facts.declaredSourceClass !== bundle.sourceClass) {
    remember('SOURCE_MISMATCH');
  }
  if (facts.declaredFingerprint !== fingerprint || facts.expectedFingerprint !== fingerprint) {
    remember('FINGERPRINT_REPLAY');
  }
  if (facts.activeDuplicateFingerprint) {
    remember('DUPLICATE_CONTRIBUTION');
  }
  if (facts.invalidSupersession) {
    remember('INVALID_SUPERSESSION');
  }

  if (isNonAuthoritativeSource(bundle.sourceClass)) {
    if (bundle.sourceClass === 'USER_DECLARED' || facts.userDeclarationSoleAuthority) {
      remember('USER_DECLARATION_INSUFFICIENT');
    }
    if (bundle.sourceClass === 'MODEL_INFERENCE' || facts.modelInferenceSoleAuthority) {
      remember('MODEL_INFERENCE_INSUFFICIENT');
    }
    if (bundle.sourceClass === 'DERIVED') {
      remember('SOURCE_QUALITY_INSUFFICIENT');
    }
  }

  if (!policy.eligibleContributionClasses.includes(bundle.contributionClass)) {
    remember('CONTRIBUTION_CLASS_NOT_ELIGIBLE');
  }

  const requirement = classRequirementFor(policy, bundle.contributionClass);
  if (bundle.contributionClass === 'OTHER_GOVERNED_HUMAN_CONTRIBUTION' && (!requirement || requirement.failClosed)) {
    remember('OTHER_CLASS_FAIL_CLOSED');
    remember('CONTRIBUTION_CLASS_NOT_ELIGIBLE');
  }

  if (requirement) {
    applyClassRequirement(requirement, bundle, facts, remember);
  }

  if (policy.jurisdictionRequirements.mustResolve && !facts.jurisdictionResolved) {
    remember('JURISDICTION_UNRESOLVED');
  }
  if (
    policy.jurisdictionRequirements.mustResolve &&
    !policy.jurisdictionRequirements.allowedCodedJurisdictions.includes(bundle.jurisdiction)
  ) {
    remember('JURISDICTION_UNRESOLVED');
  }

  if (facts.evidenceItems.some((item) => item.conflicted) && policy.conflictRules.rejectConflictedEvidence) {
    remember('EVIDENCE_CONFLICTED');
  }
  if (
    facts.evidenceItems.some(
      (item) => item.stale || daysBetween(facts.evaluatedAt, item.createdAt) > policy.maximumEvidenceAgeDays,
    )
  ) {
    remember('EVIDENCE_STALE');
  }
  if (facts.attestations.some((row) => row.conflictsWith.length > 0) && policy.conflictRules.rejectConflictingAttestations) {
    remember('CONFLICTING_ATTESTATIONS');
  }

  if (bundle.contributionClass === 'ENTREPRENEURIAL_ACTIVITY' && facts.companyOwnershipAlone) {
    remember('EVIDENCE_MISSING');
  }

  return codes;
}

function applyClassRequirement(
  requirement: ClassEvidenceRequirement,
  bundle: HumanContributionEvidenceBundle,
  facts: HumanContributionEvidenceFacts,
  remember: (code: VerificationDecisionCode) => void,
): void {
  if (requirement.requiredSourceClasses.length > 0 && !requirement.requiredSourceClasses.includes(bundle.sourceClass)) {
    remember('SOURCE_NOT_PERMITTED');
  }

  for (const kind of requirement.requiredEvidence) {
    if (!kindSatisfied(kind, bundle, facts)) {
      remember(missingCodeFor(kind));
    }
  }

  if (requirement.requiredRights && bundle.rightsReferences.length === 0) {
    remember('RIGHT_REQUIRED');
  }
  if (requirement.requiredConsent && bundle.consentReferences.length === 0) {
    remember('CONSENT_REQUIRED');
  }
  if (requirement.requiredPurpose && bundle.purposeReferences.length === 0) {
    remember('PURPOSE_REQUIRED');
  }
  if (requirement.requiredUsageReceipt && bundle.usageReceiptReferences.length === 0) {
    remember('USAGE_RECEIPT_REQUIRED');
  }
  if (requirement.requiredProvenance && bundle.provenanceReferences.length === 0) {
    remember('EVIDENCE_MISSING');
  }

  if (facts.rights.some((right) => !right.valid && !right.expired && !right.revokedBeforeUse)) {
    remember('RIGHT_INVALID');
  }
  if (facts.rights.some((right) => right.expired)) {
    remember('RIGHT_EXPIRED');
  }
  if (facts.rights.some((right) => right.revokedBeforeUse)) {
    remember('RIGHT_REVOKED_BEFORE_USE');
  }
  if (facts.consents.some((consent) => consent.required && !consent.valid)) {
    remember('CONSENT_INVALID');
  }
  if (facts.purposes.some((purpose) => purpose.bound && !purpose.matchesUsage)) {
    remember('PURPOSE_MISMATCH');
  }
  if (requirement.requiredUsageReceipt && facts.usageReceipts.some((receipt) => !receipt.realized)) {
    remember('USAGE_NOT_REALIZED');
  }

  const independent = facts.attestations.filter((row) => row.approved && row.independent);
  if (requirement.minimumIndependentAttestations > independent.length) {
    remember('INDEPENDENT_ATTESTATION_REQUIRED');
  }
  if (
    requirement.minimumIndependentAttestations > 0 &&
    facts.attestations.some((row) => !row.independent && row.attestorRef === row.subjectRef)
  ) {
    remember('SELF_ATTESTATION_INSUFFICIENT');
  }
}

function outcomeOf(codes: readonly VerificationDecisionCode[]): VerificationOutcome {
  if (codes.length === 0) {
    return 'VERIFIED';
  }
  if (codes.every((code) => requiresAdditionalEvidence(code))) {
    return 'REQUIRES_ADDITIONAL_EVIDENCE';
  }
  return 'REJECTED';
}

function qualityOf(decision: VerificationOutcome): VerificationDecisionQuality {
  if (decision === 'VERIFIED') {
    return 'VERIFIED';
  }
  if (decision === 'REQUIRES_ADDITIONAL_EVIDENCE') {
    return 'INCOMPLETE';
  }
  return 'REJECTED';
}

function confidenceOf(decision: VerificationOutcome): VerificationConfidenceClass {
  if (decision === 'VERIFIED') {
    return 'HIGH';
  }
  if (decision === 'REQUIRES_ADDITIONAL_EVIDENCE') {
    return 'INSUFFICIENT';
  }
  return 'DISQUALIFIED';
}

function canonicalDecisionMaterial(input: VerificationEvaluationInput, codes: readonly VerificationDecisionCode[]): string {
  return [
    input.bundle.evidenceDigest,
    input.policy.policyId,
    input.policy.policyVersion,
    input.fingerprint,
    input.facts.evaluatedAt,
    [...codes].sort().join(','),
  ].join('\n');
}

export function decideVerification(input: VerificationEvaluationInput): HumanContributionVerificationDecision {
  const codes = Object.freeze(collectCodes(input));
  const decision = outcomeOf(codes);
  return Object.freeze({
    decisionId: verificationDecisionIdFor(canonicalDecisionMaterial(input, codes)),
    contributionId: input.bundle.contributionId,
    fingerprint: input.fingerprint,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    decision,
    evaluatedEvidenceRefs: input.bundle.evidenceReferences,
    evidenceDigest: input.bundle.evidenceDigest,
    quality: qualityOf(decision),
    confidenceClass: confidenceOf(decision),
    decisionCodes: codes,
    evaluatedAt: input.facts.evaluatedAt,
    containsRawPersonalData: false,
    valuationPerformed: false,
    sunReyQuantityCalculated: false,
    mintAuthorityCreated: false,
    executionAuthorityCreated: false,
  });
}

export class HumanContributionVerificationEngine {
  private readonly policy: HumanContributionVerificationPolicy;

  constructor(policy: HumanContributionVerificationPolicy) {
    this.policy = policy;
  }

  evaluate(input: Omit<VerificationEvaluationInput, 'policy'> & { readonly policy?: HumanContributionVerificationPolicy }): HumanContributionVerificationDecision {
    return decideVerification({
      bundle: input.bundle,
      facts: input.facts,
      fingerprint: input.fingerprint,
      policy: input.policy ?? this.policy,
    });
  }
}

export function defaultFactsFromRecord(
  record: HumanContributionRegistryRecord,
  evaluatedAt: HumanContributionEvidenceFacts['evaluatedAt'],
  extras: Partial<HumanContributionEvidenceFacts> = {},
): HumanContributionEvidenceFacts {
  const fingerprint = fingerprintEconomicEvent({
    subjectRef: record.subjectRef,
    contributionClass: record.contributionClass,
    eventReference: record.event.eventReference,
    validFrom: record.measurementPeriod.start,
    validUntil: record.measurementPeriod.end,
    measurementQuantity: record.event.measurement.quantity,
    measurementUnit: record.measurementUnit,
    jurisdiction: record.jurisdiction,
    sourceClass: record.sourceClass,
  });
  const base: HumanContributionEvidenceFacts = {
    evaluatedAt,
    contributionFound: true,
    rights: record.rightsReferences.map((ref) => ({
      ref,
      valid: true,
      expired: false,
      revokedBeforeUse: false,
      subjectRef: record.subjectRef,
      purposeRef: record.purposeReferences[0] ?? null,
    })),
    consents: record.consentReferences.map((ref) => ({
      ref,
      valid: true,
      required: true,
      subjectRef: record.subjectRef,
      purposeRef: record.purposeReferences[0] ?? null,
    })),
    purposes: record.purposeReferences.map((ref) => ({
      ref,
      bound: true,
      matchesUsage: true,
    })),
    usageReceipts: record.event.usageReceiptReferences.map((ref) => ({
      ref,
      realized: true,
      occurredAt: record.createdAt,
      subjectRef: record.subjectRef,
      purposeRef: record.purposeReferences[0] ?? null,
      rightRef: record.rightsReferences[0] ?? null,
    })),
    attestations: record.event.attestationReferences.map((ref) => ({
      ref,
      approved: true,
      independent: true,
      attestorRef: `attestor:${ref}`,
      subjectRef: record.subjectRef,
      conflictsWith: Object.freeze([]),
    })),
    provenance: record.provenanceReferences.map((ref) => ({ ref, present: true as const })),
    evidenceItems: record.evidenceReferences.map((ref) => ({
      ref,
      createdAt: record.createdAt,
      stale: record.event.dataQuality === 'STALE',
      conflicted: record.event.dataQuality === 'CONFLICTED',
      digest: record.evidenceDigest,
    })),
    jurisdictionResolved: true,
    declaredSubjectRef: record.subjectRef,
    declaredMeasurement: record.event.measurement,
    declaredPeriod: record.measurementPeriod,
    declaredSourceClass: record.sourceClass,
    declaredFingerprint: fingerprint,
    expectedFingerprint: fingerprint,
    expectedEvidenceDigest: '',
    activeDuplicateFingerprint: false,
    invalidSupersession: false,
    rawPersonalDataPresent: false,
    protectedTraitRankingPresent: false,
    humanWorthScoringPresent: false,
    modelInferenceSoleAuthority: record.sourceClass === 'MODEL_INFERENCE',
    userDeclarationSoleAuthority: record.sourceClass === 'USER_DECLARED',
    companyOwnershipAlone: false,
    modelTrainingPermission:
      record.contributionClass === 'MODEL_TRAINING_PARTICIPATION' &&
      record.rightsReferences.length > 0 &&
      record.purposeReferences.length > 0,
    usageRealized:
      record.event.usageReceiptReferences.length > 0 ||
      record.contributionClass === 'ECONOMIC_PARTICIPATION' ||
      record.contributionClass === 'CREATOR_ROYALTY_EVENT' ||
      record.contributionClass === 'HUMAN_SERVICE_DELIVERY',
    eventPresent: true,
    serviceAccepted: record.contributionClass === 'HUMAN_SERVICE_DELIVERY' && record.evidenceReferences.length > 0,
    royaltyContractPresent: record.contributionClass === 'CREATOR_ROYALTY_EVENT' && record.rightsReferences.length > 0,
    creativeRightPresent: record.rightsReferences.length > 0,
    knowledgeArtifactPresent: record.evidenceReferences.length > 0,
  };
  return { ...base, ...extras };
}

export function withExpectedDigest(
  facts: HumanContributionEvidenceFacts,
  digest: string,
): HumanContributionEvidenceFacts {
  return Object.freeze({
    ...facts,
    expectedEvidenceDigest: digest,
  });
}
