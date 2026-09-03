/**
 * Wave 6 — Human Economy ontology shared types.
 */

import type { ContributionClass } from '../../../../human-economic-contribution/src/taxonomy.ts';
import { HUMAN_ONTOLOGY_VERSION } from './constants.ts';

export const HUMAN_CONTRIBUTION_EVENT_KINDS = ['ACTIVITY', 'ACHIEVEMENT', 'AUTHORIZED_USE'] as const;
export type HumanContributionEventKind = (typeof HUMAN_CONTRIBUTION_EVENT_KINDS)[number];

export const HUMAN_ATTRIBUTE_CLASSES = [
  'AGE',
  'HEALTH_CONDITION',
  'LOCATION',
  'RACE',
  'DNA',
  'PSYCHOLOGICAL_PROFILE',
  'SOCIAL_CONNECTIONS',
  'ATTENTION',
  'APP_USAGE',
  'PROFILE_METADATA',
] as const;
export type HumanAttributeClass = (typeof HUMAN_ATTRIBUTE_CLASSES)[number];

export const HUMAN_IDENTITY_ASSURANCE_LEVELS = [
  'PSEUDONYMOUS_ONLY',
  'SELF_ATTESTED',
  'INSTITUTIONALLY_ATTESTED',
  'RESEARCH_REGISTRY_VERIFIED',
  'GOVERNANCE_APPROVED',
] as const;
export type HumanIdentityAssuranceLevel = (typeof HUMAN_IDENTITY_ASSURANCE_LEVELS)[number];

export const HUMAN_ACTOR_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'ARCHIVED'] as const;
export type HumanActorStatus = (typeof HUMAN_ACTOR_STATUSES)[number];

export const HUMAN_CONTROL_REJECTION_CODES = [
  'ATTRIBUTE_IS_NOT_CONTRIBUTION',
  'PROFILE_IS_NOT_CONTRIBUTION',
  'CONSENT_IS_NOT_CONTRIBUTION',
  'EVIDENCE_IS_NOT_CONTRIBUTION',
  'CONSENT_IS_NOT_VALUATION',
  'VALUATION_IS_NOT_HUMAN_WORTH',
  'CONTRIBUTION_IS_NOT_SUNREY',
  'MARKET_PRICE_IS_NOT_CONTRIBUTION_VALUE',
  'CREDENTIAL_EXISTENCE_IS_NOT_EARNED',
  'EMPLOYMENT_RELATIONSHIP_IS_NOT_WORK',
  'PAPER_EXISTENCE_IS_NOT_CONTRIBUTION',
  'ATTENTION_IS_NOT_CONTRIBUTION',
  'APP_USAGE_IS_NOT_CONTRIBUTION',
  'LOCATION_IS_NOT_CONTRIBUTION',
  'HEALTH_ACTIVITY_IS_NOT_CONTRIBUTION',
  'UNKNOWN_EVENT_TYPE',
  'UNKNOWN_CONTRIBUTION_CLASS',
  'EVENT_CLASS_MISMATCH',
  'MISSING_ATTESTATION',
  'MISSING_CONSENT',
  'MISSING_RIGHTS',
  'FORBIDDEN_IDENTITY_FIELD',
  'HUMAN_WORTH_SCORE_FORBIDDEN',
] as const;
export type HumanControlRejectionCode = (typeof HUMAN_CONTROL_REJECTION_CODES)[number];

export type HumanOntologyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: HumanControlRejectionCode; readonly message: string };

export type HumanGovernanceCategory =
  | 'WORK_CONTRIBUTION'
  | 'SKILL_APPLICATION'
  | 'EDUCATIONAL_ACHIEVEMENT'
  | 'RESEARCH_CONTRIBUTION'
  | 'KNOWLEDGE_CONTRIBUTION'
  | 'AUTHORIZED_DATA_CONTRIBUTION'
  | 'COMPUTATION_PARTICIPATION'
  | 'CREATIVE_CONTRIBUTION'
  | 'COMMUNITY_CONTRIBUTION'
  | 'ENTREPRENEURIAL_CONTRIBUTION'
  | 'CARE_CONTRIBUTION'
  | 'OTHER_GOVERNANCE_APPROVED';

export type HumanGovernanceCategoryRecord = {
  readonly governanceCategory: HumanGovernanceCategory;
  readonly label: string;
  readonly description: string;
  readonly contributionClasses: readonly ContributionClass[];
  readonly requiresConsent: boolean;
  readonly requiresRights: boolean;
  readonly requiresAttestation: boolean;
  readonly monetizableByDefault: false;
  readonly humanWorthMeasure: false;
};

export type HumanEventTypeDefinition = {
  readonly eventType: string;
  readonly governanceCategory: HumanGovernanceCategory;
  readonly contributionClasses: readonly ContributionClass[];
  readonly label: string;
  readonly description: string;
  readonly eventKind: HumanContributionEventKind;
  readonly canonicalUnit: string;
  readonly requiresEarnedProof: boolean;
  readonly rejectsProfileOrAttribute: true;
};

export type HumanEconomicActor = {
  readonly schemaVersion: typeof HUMAN_ONTOLOGY_VERSION;
  readonly humanActorId: string;
  readonly pseudonymousId: string;
  readonly identityAssuranceLevel: HumanIdentityAssuranceLevel;
  readonly jurisdiction: string;
  readonly credentialRefs: readonly string[];
  readonly rightsControllerRefs: readonly string[];
  readonly status: HumanActorStatus;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
  readonly containsRawLegalIdentity: false;
  readonly humanWorthScore: false;
};

export type HumanContributionEventMaterial = {
  readonly eventType: string;
  readonly humanActorId: string;
  readonly pseudonymousId: string;
  readonly governanceCategory: HumanGovernanceCategory;
  readonly contributionClass: ContributionClass;
  readonly eventKind: HumanContributionEventKind;
  readonly eventRef: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly intervalStartUtc: string;
  readonly intervalEndUtc: string;
  readonly jurisdiction: string;
  readonly evidenceRefs: readonly string[];
  readonly attestationRefs: readonly string[];
  readonly consentRefs: readonly string[];
  readonly rightsRefs: readonly string[];
  readonly purposeRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly methodologyId: string;
  readonly uniquenessDigest: string;
  readonly claimedPreviously: false;
};
