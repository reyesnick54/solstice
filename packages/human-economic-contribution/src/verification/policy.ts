import { asUtcInstant } from '../../../domain/src/time.ts';
import { verificationPolicyIdFor, verificationPolicyVersionFor } from '../ids.ts';
import { CONTRIBUTION_CLASSES, type ContributionClass, type SourceClass } from '../taxonomy.ts';
import type {
  ClassEvidenceRequirement,
  EngineeringParameterClass,
  EvidenceKind,
  HumanContributionVerificationPolicy,
  ProductionLegalCommercialPolicy,
} from './types.ts';

export const ENGINEERING_VERIFICATION_POLICY_SEED = 'sunrey-human-contribution-verification-engineering-v1';

const CLASS_SOURCES: Readonly<Record<ContributionClass, readonly SourceClass[]>> = Object.freeze({
  INFORMATION_RIGHT_CONTRIBUTION: Object.freeze(['HUMAN_INFORMATION_NETWORK'] as const),
  VERIFIED_KNOWLEDGE_CONTRIBUTION: Object.freeze([
    'VERIFIED_RESEARCH_ATTESTATION',
    'VERIFIED_INSTITUTIONAL_ATTESTATION',
    'VERIFIED_PROFESSIONAL_ATTESTATION',
  ] as const),
  CREATIVE_PRODUCTION: Object.freeze([
    'VERIFIED_COMMUNITY_ATTESTATION',
    'VERIFIED_INSTITUTIONAL_ATTESTATION',
    'HUMAN_INFORMATION_NETWORK',
  ] as const),
  RESEARCH_PARTICIPATION: Object.freeze(['VERIFIED_RESEARCH_ATTESTATION'] as const),
  PROFESSIONAL_EXPERTISE: Object.freeze(['VERIFIED_PROFESSIONAL_ATTESTATION'] as const),
  ECONOMIC_PARTICIPATION: Object.freeze([
    'CANONICAL_LEDGER_EVENT_REFERENCE',
    'PAYMENT_EVENT_REFERENCE',
    'CARD_EVENT_REFERENCE',
    'PERSONAL_ECONOMIC_GRAPH_REFERENCE',
  ] as const),
  COMMUNITY_CONTRIBUTION: Object.freeze(['VERIFIED_COMMUNITY_ATTESTATION'] as const),
  EDUCATION_SKILL_ATTESTATION: Object.freeze(['VERIFIED_INSTITUTIONAL_ATTESTATION'] as const),
  MODEL_TRAINING_PARTICIPATION: Object.freeze(['HUMAN_INFORMATION_NETWORK'] as const),
  HUMAN_SERVICE_DELIVERY: Object.freeze(['VERIFIED_INSTITUTIONAL_ATTESTATION'] as const),
  ENTREPRENEURIAL_ACTIVITY: Object.freeze([
    'VERIFIED_INSTITUTIONAL_ATTESTATION',
    'CANONICAL_LEDGER_EVENT_REFERENCE',
  ] as const),
  CREATOR_ROYALTY_EVENT: Object.freeze(['HUMAN_INFORMATION_NETWORK'] as const),
  OTHER_GOVERNED_HUMAN_CONTRIBUTION: Object.freeze([] as const),
});

function requirement(
  requiredEvidence: readonly EvidenceKind[],
  requiredSourceClasses: readonly SourceClass[],
  flags: {
    readonly requiredRights?: boolean;
    readonly requiredConsent?: boolean;
    readonly requiredPurpose?: boolean;
    readonly requiredUsageReceipt?: boolean;
    readonly requiredProvenance?: boolean;
    readonly minimumIndependentAttestations?: number;
  } = {},
): ClassEvidenceRequirement {
  return Object.freeze({
    failClosed: false,
    requiredEvidence,
    requiredSourceClasses,
    requiredRights: flags.requiredRights ?? false,
    requiredConsent: flags.requiredConsent ?? false,
    requiredPurpose: flags.requiredPurpose ?? false,
    requiredUsageReceipt: flags.requiredUsageReceipt ?? false,
    requiredProvenance: flags.requiredProvenance ?? false,
    minimumIndependentAttestations: flags.minimumIndependentAttestations ?? 0,
    allowUserDeclared: false,
    allowModelInferenceAlone: false,
  });
}

export const ENGINEERING_CLASS_REQUIREMENTS: Readonly<Record<Exclude<ContributionClass, 'OTHER_GOVERNED_HUMAN_CONTRIBUTION'>, ClassEvidenceRequirement>> =
  Object.freeze({
    INFORMATION_RIGHT_CONTRIBUTION: requirement(
      ['INFORMATION_RIGHT', 'CONSENT', 'PURPOSE', 'USAGE_RECEIPT', 'USAGE_REALIZED', 'EVENT'],
      CLASS_SOURCES.INFORMATION_RIGHT_CONTRIBUTION,
      { requiredRights: true, requiredConsent: true, requiredPurpose: true, requiredUsageReceipt: true },
    ),
    VERIFIED_KNOWLEDGE_CONTRIBUTION: requirement(
      ['EVENT', 'PROVENANCE', 'INDEPENDENT_ATTESTATION'],
      CLASS_SOURCES.VERIFIED_KNOWLEDGE_CONTRIBUTION,
      { requiredProvenance: true, minimumIndependentAttestations: 1 },
    ),
    CREATIVE_PRODUCTION: requirement(
      ['EVENT', 'PROVENANCE', 'CREATIVE_RIGHT'],
      CLASS_SOURCES.CREATIVE_PRODUCTION,
      { requiredProvenance: true, requiredRights: true },
    ),
    RESEARCH_PARTICIPATION: requirement(
      ['EVENT', 'ATTESTATION', 'CONSENT', 'PURPOSE'],
      CLASS_SOURCES.RESEARCH_PARTICIPATION,
      { requiredConsent: true, requiredPurpose: true },
    ),
    PROFESSIONAL_EXPERTISE: requirement(
      ['EVENT', 'ATTESTATION', 'MEASUREMENT'],
      CLASS_SOURCES.PROFESSIONAL_EXPERTISE,
    ),
    ECONOMIC_PARTICIPATION: requirement(
      ['EVENT', 'USAGE_REALIZED'],
      CLASS_SOURCES.ECONOMIC_PARTICIPATION,
    ),
    COMMUNITY_CONTRIBUTION: requirement(
      ['EVENT', 'ATTESTATION', 'INDEPENDENT_ATTESTATION'],
      CLASS_SOURCES.COMMUNITY_CONTRIBUTION,
      { minimumIndependentAttestations: 1 },
    ),
    EDUCATION_SKILL_ATTESTATION: requirement(
      ['EVENT', 'ATTESTATION'],
      CLASS_SOURCES.EDUCATION_SKILL_ATTESTATION,
    ),
    MODEL_TRAINING_PARTICIPATION: requirement(
      ['MODEL_TRAINING_PERMISSION', 'PURPOSE', 'USAGE_REALIZED', 'INFORMATION_RIGHT', 'USAGE_RECEIPT'],
      CLASS_SOURCES.MODEL_TRAINING_PARTICIPATION,
      { requiredRights: true, requiredPurpose: true, requiredUsageReceipt: true, requiredConsent: true },
    ),
    HUMAN_SERVICE_DELIVERY: requirement(
      ['EVENT', 'SERVICE_ACCEPTANCE', 'MEASUREMENT'],
      CLASS_SOURCES.HUMAN_SERVICE_DELIVERY,
    ),
    ENTREPRENEURIAL_ACTIVITY: requirement(
      ['EVENT', 'PROVENANCE'],
      CLASS_SOURCES.ENTREPRENEURIAL_ACTIVITY,
      { requiredProvenance: true },
    ),
    CREATOR_ROYALTY_EVENT: requirement(
      ['CREATIVE_RIGHT', 'USAGE_REALIZED', 'ROYALTY_CONTRACT'],
      CLASS_SOURCES.CREATOR_ROYALTY_EVENT,
      { requiredRights: true, requiredUsageReceipt: true },
    ),
  });

function freezePolicy(policy: HumanContributionVerificationPolicy): HumanContributionVerificationPolicy {
  return Object.freeze({
    ...policy,
    eligibleContributionClasses: Object.freeze([...policy.eligibleContributionClasses]),
    requiredEvidenceByContributionClass: Object.freeze({ ...policy.requiredEvidenceByContributionClass }),
    requiredSourceClassesByContributionClass: Object.freeze({ ...policy.requiredSourceClassesByContributionClass }),
    classRequirements: Object.freeze({ ...policy.classRequirements }),
    jurisdictionRequirements: Object.freeze({
      mustResolve: true as const,
      allowedCodedJurisdictions: Object.freeze([...policy.jurisdictionRequirements.allowedCodedJurisdictions]),
    }),
    duplicateRules: Object.freeze({ ...policy.duplicateRules }),
    conflictRules: Object.freeze({ ...policy.conflictRules }),
    correctionRules: Object.freeze({ ...policy.correctionRules }),
    modelInferenceRules: Object.freeze({ ...policy.modelInferenceRules }),
    userDeclaredRules: Object.freeze({ ...policy.userDeclaredRules }),
  });
}

const ENGINEERING_ELIGIBLE = CONTRIBUTION_CLASSES.filter(
  (contributionClass) => contributionClass !== 'OTHER_GOVERNED_HUMAN_CONTRIBUTION',
);

export const ENGINEERING_VERIFICATION_POLICY: HumanContributionVerificationPolicy = freezePolicy({
  policyId: verificationPolicyIdFor(ENGINEERING_VERIFICATION_POLICY_SEED),
  policyVersion: verificationPolicyVersionFor(ENGINEERING_VERIFICATION_POLICY_SEED),
  schemaVersion: 1,
  status: 'ACTIVE',
  effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
  effectiveUntil: null,
  parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
  productionLegalCommercialPolicy: 'NOT_ACTIVATED',
  counselApproval: 'NOT_CLAIMED',
  eligibleContributionClasses: Object.freeze(ENGINEERING_ELIGIBLE),
  requiredEvidenceByContributionClass: Object.freeze(
    Object.fromEntries(
      ENGINEERING_ELIGIBLE.map((contributionClass) => [
        contributionClass,
        ENGINEERING_CLASS_REQUIREMENTS[contributionClass].requiredEvidence,
      ]),
    ) as Record<Exclude<ContributionClass, 'OTHER_GOVERNED_HUMAN_CONTRIBUTION'>, readonly EvidenceKind[]>,
  ),
  requiredSourceClassesByContributionClass: Object.freeze(
    Object.fromEntries(
      ENGINEERING_ELIGIBLE.map((contributionClass) => [
        contributionClass,
        ENGINEERING_CLASS_REQUIREMENTS[contributionClass].requiredSourceClasses,
      ]),
    ) as Record<Exclude<ContributionClass, 'OTHER_GOVERNED_HUMAN_CONTRIBUTION'>, readonly SourceClass[]>,
  ),
  classRequirements: ENGINEERING_CLASS_REQUIREMENTS,
  minimumVerificationQuality: 'ATTESTED',
  minimumIndependentAttestations: 0,
  requiredRights: false,
  requiredConsent: false,
  requiredPurpose: false,
  requiredUsageReceipt: false,
  requiredProvenance: false,
  maximumEvidenceAgeDays: 365,
  jurisdictionRequirements: {
    mustResolve: true,
    allowedCodedJurisdictions: Object.freeze(['GB', 'US', 'EU', 'SIMULATION']),
  },
  duplicateRules: {
    rejectActiveFingerprintReplay: true,
    rejectDuplicatedEvidenceReferences: true,
  },
  conflictRules: {
    rejectConflictedEvidence: true,
    rejectConflictingAttestations: true,
  },
  correctionRules: {
    requireExplicitSupersession: true,
    doNotRewriteHistory: true,
  },
  modelInferenceRules: {
    cannotSoleVerify: true,
    mayAssistReview: true,
    remainModelInference: true,
  },
  userDeclaredRules: {
    cannotSoleVerify: true,
    remainUserDeclared: true,
  },
});

export const PRODUCTION_LEGAL_COMMERCIAL_POLICY = Object.freeze({
  status: 'NOT_ACTIVATED' as const,
  parameterClass: 'UNCONFIGURED' as EngineeringParameterClass,
  productionLegalCommercialPolicy: 'UNCONFIGURED' as ProductionLegalCommercialPolicy,
  counselApproval: 'NOT_CLAIMED' as const,
  legallyApproved: false,
  confirmedByCounsel: false,
});

const activated = new Map<string, HumanContributionVerificationPolicy>();
activated.set(`${ENGINEERING_VERIFICATION_POLICY.policyId}:${ENGINEERING_VERIFICATION_POLICY.policyVersion}`, ENGINEERING_VERIFICATION_POLICY);

export function activateVerificationPolicy(
  policy: HumanContributionVerificationPolicy,
): HumanContributionVerificationPolicy {
  if (policy.status !== 'ACTIVE') {
    throw new TypeError('only an ACTIVE verification policy may be registered');
  }
  if (policy.parameterClass !== 'ENGINEERING_SIMULATION_PARAMETERS') {
    throw new TypeError('production legal/commercial verification policy remains UNCONFIGURED / NOT_ACTIVATED');
  }
  const key = `${policy.policyId}:${policy.policyVersion}`;
  const existing = activated.get(key);
  const frozen = freezePolicy(policy);
  if (existing && JSON.stringify(existing) !== JSON.stringify(frozen)) {
    throw new TypeError('an activated verification policy is immutable');
  }
  activated.set(key, frozen);
  return frozen;
}

export function getActivatedVerificationPolicy(
  policyId: HumanContributionVerificationPolicy['policyId'],
  policyVersion: HumanContributionVerificationPolicy['policyVersion'],
): HumanContributionVerificationPolicy | undefined {
  return activated.get(`${policyId}:${policyVersion}`);
}

export function classRequirementFor(
  policy: HumanContributionVerificationPolicy,
  contributionClass: ContributionClass,
): ClassEvidenceRequirement | undefined {
  return policy.classRequirements[contributionClass];
}
