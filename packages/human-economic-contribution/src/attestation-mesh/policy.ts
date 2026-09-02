/**
 * Contribution-specific attestation verification policies.
 *
 * Different contribution classes require different evidence. There is no
 * universal one-size-fits-all rule.
 */

import type { ContributionClass } from '../taxonomy.ts';
import type { AttestationSourceClass } from './source-classes.ts';

export const ATTESTATION_MESH_POLICY_ID = 'sunrey-human-contribution-attestation-mesh-v1' as const;
export const ATTESTATION_MESH_POLICY_VERSION = '1' as const;
export const ATTESTATION_MESH_METHODOLOGY = 'sunrey.human-contribution-attestation-mesh.v1' as const;

export type ClassAttestationRequirement = {
  readonly contributionClass: ContributionClass;
  readonly requiredStatementTypes: readonly string[];
  readonly requiredSourceClasses: readonly AttestationSourceClass[];
  readonly minimumIndependentLineageRoots: number;
  readonly allowSelfAttestationAsClaimInput: boolean;
  readonly selfAttestationMayVerify: false;
  readonly requiresCredentialVerification: boolean;
  readonly requiresSignedReceipt: boolean;
  readonly requiresPublicationIdentifier: boolean;
  readonly requiresAuthorRelationship: boolean;
  readonly requiresRightsGrant: boolean;
  readonly requiresConsent: boolean;
  readonly requiresUsageProof: boolean;
  readonly failClosed: boolean;
};

function req(
  contributionClass: ContributionClass,
  overrides: Partial<Omit<ClassAttestationRequirement, 'contributionClass' | 'selfAttestationMayVerify'>> &
    Pick<ClassAttestationRequirement, 'requiredSourceClasses'>,
): ClassAttestationRequirement {
  return Object.freeze({
    contributionClass,
    requiredStatementTypes: overrides.requiredStatementTypes ?? ['CONTRIBUTION_OCCURRED'],
    requiredSourceClasses: overrides.requiredSourceClasses,
    minimumIndependentLineageRoots: overrides.minimumIndependentLineageRoots ?? 1,
    allowSelfAttestationAsClaimInput: overrides.allowSelfAttestationAsClaimInput ?? true,
    selfAttestationMayVerify: false,
    requiresCredentialVerification: overrides.requiresCredentialVerification ?? false,
    requiresSignedReceipt: overrides.requiresSignedReceipt ?? false,
    requiresPublicationIdentifier: overrides.requiresPublicationIdentifier ?? false,
    requiresAuthorRelationship: overrides.requiresAuthorRelationship ?? false,
    requiresRightsGrant: overrides.requiresRightsGrant ?? false,
    requiresConsent: overrides.requiresConsent ?? false,
    requiresUsageProof: overrides.requiresUsageProof ?? false,
    failClosed: overrides.failClosed ?? false,
  });
}

export const CLASS_ATTESTATION_REQUIREMENTS: Readonly<Partial<Record<ContributionClass, ClassAttestationRequirement>>> =
  Object.freeze({
    RESEARCH_PARTICIPATION: req('RESEARCH_PARTICIPATION', {
      requiredStatementTypes: ['AUTHORSHIP', 'CONTRIBUTION_OCCURRED'],
      requiredSourceClasses: ['RESEARCH_PUBLISHER', 'RESEARCH_REGISTRY', 'PRIMARY_INSTITUTION'],
      minimumIndependentLineageRoots: 1,
      requiresPublicationIdentifier: true,
      requiresAuthorRelationship: true,
    }),
    EDUCATION_SKILL_ATTESTATION: req('EDUCATION_SKILL_ATTESTATION', {
      requiredStatementTypes: ['CREDENTIAL_ISSUED', 'CREDENTIAL_VALID', 'CONTRIBUTION_OCCURRED'],
      requiredSourceClasses: ['CREDENTIAL_ISSUER', 'EDUCATIONAL_INSTITUTION', 'GOVERNMENT'],
      requiresCredentialVerification: true,
    }),
    PROFESSIONAL_EXPERTISE: req('PROFESSIONAL_EXPERTISE', {
      requiredStatementTypes: ['EMPLOYMENT', 'CONTRIBUTION_OCCURRED'],
      requiredSourceClasses: ['EMPLOYER', 'PRIMARY_INSTITUTION', 'CREDENTIAL_ISSUER'],
    }),
    HUMAN_SERVICE_DELIVERY: req('HUMAN_SERVICE_DELIVERY', {
      requiredStatementTypes: ['WORK_RECEIPT', 'CONTRIBUTION_OCCURRED'],
      requiredSourceClasses: ['EMPLOYER', 'SIGNED_WORK_RECEIPT', 'PRIMARY_INSTITUTION'],
      requiresSignedReceipt: true,
    }),
    MODEL_TRAINING_PARTICIPATION: req('MODEL_TRAINING_PARTICIPATION', {
      requiredStatementTypes: ['COMPUTATION_COMPLETED', 'DATA_USAGE'],
      requiredSourceClasses: ['SIGNED_COMPUTATION_RECEIPT', 'AUTHORIZED_DATA_PROVIDER'],
      requiresSignedReceipt: true,
      requiresRightsGrant: true,
      requiresConsent: true,
      requiresUsageProof: true,
    }),
    INFORMATION_RIGHT_CONTRIBUTION: req('INFORMATION_RIGHT_CONTRIBUTION', {
      requiredStatementTypes: ['AUTHORIZED_DATA_CONTRIBUTION', 'DATA_USAGE'],
      requiredSourceClasses: ['AUTHORIZED_DATA_PROVIDER', 'SIGNED_COMPUTATION_RECEIPT'],
      requiresRightsGrant: true,
      requiresConsent: true,
      requiresUsageProof: true,
    }),
    VERIFIED_KNOWLEDGE_CONTRIBUTION: req('VERIFIED_KNOWLEDGE_CONTRIBUTION', {
      requiredStatementTypes: ['CONTRIBUTION_OCCURRED', 'AUTHORSHIP'],
      requiredSourceClasses: ['RESEARCH_PUBLISHER', 'PRIMARY_INSTITUTION', 'GOVERNMENT'],
      minimumIndependentLineageRoots: 1,
      requiresPublicationIdentifier: true,
    }),
    ECONOMIC_PARTICIPATION: req('ECONOMIC_PARTICIPATION', {
      requiredStatementTypes: ['WORK_RECEIPT', 'CONTRIBUTION_OCCURRED'],
      requiredSourceClasses: ['EMPLOYER', 'GOVERNMENT', 'SIGNED_WORK_RECEIPT'],
    }),
    OTHER_GOVERNED_HUMAN_CONTRIBUTION: req('OTHER_GOVERNED_HUMAN_CONTRIBUTION', {
      requiredStatementTypes: ['OTHER_GOVERNANCE_APPROVED'],
      requiredSourceClasses: ['OTHER_GOVERNANCE_APPROVED', 'GOVERNMENT'],
      failClosed: true,
    }),
  });

export function classAttestationRequirementFor(contributionClass: ContributionClass): ClassAttestationRequirement | undefined {
  return CLASS_ATTESTATION_REQUIREMENTS[contributionClass];
}

export function selfAttestationEvidentiaryWeight(): 'CLAIM_INPUT_ONLY' {
  return 'CLAIM_INPUT_ONLY';
}

export type HumanContributionAttestationVerificationPolicy = {
  readonly policyId: typeof ATTESTATION_MESH_POLICY_ID;
  readonly policyVersion: typeof ATTESTATION_MESH_POLICY_VERSION;
  readonly methodology: typeof ATTESTATION_MESH_METHODOLOGY;
  readonly classRequirements: typeof CLASS_ATTESTATION_REQUIREMENTS;
  readonly maximumEvidenceAgeDays: number;
  readonly selfAttestation: {
    readonly mayProvideClaimInput: true;
    readonly maySoleVerify: false;
    readonly evidentiaryWeight: 'CLAIM_INPUT_ONLY';
  };
  readonly endpointCountIsNotIndependence: true;
  readonly grantsMonetaryAuthority: false;
};

export const HUMAN_CONTRIBUTION_ATTESTATION_VERIFICATION_POLICY: HumanContributionAttestationVerificationPolicy = Object.freeze({
  policyId: ATTESTATION_MESH_POLICY_ID,
  policyVersion: ATTESTATION_MESH_POLICY_VERSION,
  methodology: ATTESTATION_MESH_METHODOLOGY,
  classRequirements: CLASS_ATTESTATION_REQUIREMENTS,
  maximumEvidenceAgeDays: 365,
  selfAttestation: Object.freeze({
    mayProvideClaimInput: true,
    maySoleVerify: false,
    evidentiaryWeight: selfAttestationEvidentiaryWeight(),
  }),
  endpointCountIsNotIndependence: true,
  grantsMonetaryAuthority: false,
});
