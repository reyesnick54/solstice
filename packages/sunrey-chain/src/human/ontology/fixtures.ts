/**
 * Wave 6 — deterministic human economy fixtures for tests.
 */

import type { HumanContributionEventMaterial } from './types.ts';

export const WAVE6_FIXTURE_NOW = '2026-09-02T12:00:00.000Z' as const;
export const WAVE6_FIXTURE_END = '2026-09-02T18:00:00.000Z' as const;
export const WAVE6_FIXTURE_ACTOR_ID = 'hea_wave6_fixture_actor' as const;
export const WAVE6_FIXTURE_PSEUDONYM = 'hin:subject:wave6-contributor' as const;

function humanEvent(
  input: Omit<HumanContributionEventMaterial, 'humanActorId' | 'pseudonymousId' | 'claimedPreviously'>,
): HumanContributionEventMaterial {
  return Object.freeze({
    humanActorId: WAVE6_FIXTURE_ACTOR_ID,
    pseudonymousId: WAVE6_FIXTURE_PSEUDONYM,
    claimedPreviously: false,
    ...input,
  });
}

export const EMPLOYMENT_WORK_EVENT = humanEvent({
  eventType: 'WorkPerformed',
  governanceCategory: 'WORK_CONTRIBUTION',
  contributionClass: 'PROFESSIONAL_EXPERTISE',
  eventKind: 'ACTIVITY',
  eventRef: 'event:work:acme-q3-review',
  quantity: 8n,
  unit: 'VERIFIED_PROFESSIONAL_HOUR',
  intervalStartUtc: WAVE6_FIXTURE_NOW,
  intervalEndUtc: WAVE6_FIXTURE_END,
  jurisdiction: 'GB',
  evidenceRefs: ['ev:work:timesheet:acme-q3'],
  attestationRefs: ['att:employer:acme:verified'],
  consentRefs: [],
  rightsRefs: [],
  purposeRefs: [],
  provenanceRefs: ['prov:work:acme-q3'],
  methodologyId: 'hec.work.verification.v1',
  uniquenessDigest: 'uniq:work:acme-q3-review',
});

export const RESEARCH_CONTRIBUTION_EVENT = humanEvent({
  eventType: 'ResearchContributionVerified',
  governanceCategory: 'RESEARCH_CONTRIBUTION',
  contributionClass: 'RESEARCH_PARTICIPATION',
  eventKind: 'ACHIEVEMENT',
  eventRef: 'event:research:doi-10-1000-wave6',
  quantity: 1n,
  unit: 'VERIFIED_RESEARCH_SESSION',
  intervalStartUtc: WAVE6_FIXTURE_NOW,
  intervalEndUtc: WAVE6_FIXTURE_END,
  jurisdiction: 'US',
  evidenceRefs: ['ev:research:doi-10-1000-wave6'],
  attestationRefs: ['att:university:stanford:coauthor'],
  consentRefs: ['consent:research:wave6'],
  rightsRefs: ['rights:research:publication'],
  purposeRefs: ['purpose:CONTRIBUTION_VERIFICATION'],
  provenanceRefs: ['prov:research:pubmed'],
  methodologyId: 'hec.research.verification.v1',
  uniquenessDigest: 'uniq:research:doi-10-1000-wave6',
});

export const EDUCATION_MILESTONE_EVENT = humanEvent({
  eventType: 'EducationalMilestoneCompleted',
  governanceCategory: 'EDUCATIONAL_ACHIEVEMENT',
  contributionClass: 'EDUCATION_SKILL_ATTESTATION',
  eventKind: 'ACHIEVEMENT',
  eventRef: 'event:education:msc-data-science',
  quantity: 1n,
  unit: 'EDUCATION_SKILL_ATTESTATION_UNIT',
  intervalStartUtc: WAVE6_FIXTURE_NOW,
  intervalEndUtc: WAVE6_FIXTURE_END,
  jurisdiction: 'GB',
  evidenceRefs: ['ev:education:transcript:digest'],
  attestationRefs: ['att:institution:open-university:degree'],
  consentRefs: ['consent:education:wave6'],
  rightsRefs: [],
  purposeRefs: ['purpose:CONTRIBUTION_VERIFICATION'],
  provenanceRefs: ['prov:education:credential-registry'],
  methodologyId: 'hec.education.verification.v1',
  uniquenessDigest: 'uniq:education:msc-data-science',
});

export const SKILL_DEMONSTRATION_EVENT = humanEvent({
  eventType: 'SkillDemonstrated',
  governanceCategory: 'SKILL_APPLICATION',
  contributionClass: 'EDUCATION_SKILL_ATTESTATION',
  eventKind: 'ACHIEVEMENT',
  eventRef: 'event:skill:rust-certification-lab',
  quantity: 1n,
  unit: 'EDUCATION_SKILL_ATTESTATION_UNIT',
  intervalStartUtc: WAVE6_FIXTURE_NOW,
  intervalEndUtc: WAVE6_FIXTURE_END,
  jurisdiction: 'EU',
  evidenceRefs: ['ev:skill:lab-result:digest'],
  attestationRefs: ['att:certifier:rust-foundation:practical'],
  consentRefs: ['consent:skill:wave6'],
  rightsRefs: [],
  purposeRefs: ['purpose:CONTRIBUTION_VERIFICATION'],
  provenanceRefs: ['prov:skill:assessment-center'],
  methodologyId: 'hec.skill.verification.v1',
  uniquenessDigest: 'uniq:skill:rust-certification-lab',
});

export const AUTHORIZED_COMPUTATION_EVENT = humanEvent({
  eventType: 'ComputationContributionCompleted',
  governanceCategory: 'COMPUTATION_PARTICIPATION',
  contributionClass: 'MODEL_TRAINING_PARTICIPATION',
  eventKind: 'ACTIVITY',
  eventRef: 'event:compute:federated-round-42',
  quantity: 120n,
  unit: 'MODEL_TRAINING_PARTICIPATION_UNIT',
  intervalStartUtc: WAVE6_FIXTURE_NOW,
  intervalEndUtc: WAVE6_FIXTURE_END,
  jurisdiction: 'US',
  evidenceRefs: ['ev:compute:receipt:round-42'],
  attestationRefs: ['att:compute:orchestrator:verified'],
  consentRefs: ['consent:compute:wave6'],
  rightsRefs: ['rights:dataset:federated-use'],
  purposeRefs: ['purpose:AGENT_COMPUTATION'],
  provenanceRefs: ['prov:compute:receipt-chain'],
  methodologyId: 'hec.compute.verification.v1',
  uniquenessDigest: 'uniq:compute:federated-round-42',
});

export const AUTHORIZED_DATASET_EVENT = humanEvent({
  eventType: 'AuthorizedDatasetContribution',
  governanceCategory: 'AUTHORIZED_DATA_CONTRIBUTION',
  contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
  eventKind: 'AUTHORIZED_USE',
  eventRef: 'event:dataset:authorized-cohort-wave6',
  quantity: 1n,
  unit: 'CONSENT_SCOPED_INFORMATION_USE',
  intervalStartUtc: WAVE6_FIXTURE_NOW,
  intervalEndUtc: WAVE6_FIXTURE_END,
  jurisdiction: 'GB',
  evidenceRefs: ['ev:dataset:usage-receipt:digest'],
  attestationRefs: ['att:hin:network:usage-verified'],
  consentRefs: ['consent:dataset:wave6'],
  rightsRefs: ['rights:hin:information-right-42'],
  purposeRefs: ['purpose:RESEARCH'],
  provenanceRefs: ['prov:hin:usage-receipt'],
  methodologyId: 'hec.dataset.verification.v1',
  uniquenessDigest: 'uniq:dataset:authorized-cohort-wave6',
});

export const PROFILE_NOT_CONTRIBUTION = Object.freeze({
  profileId: 'profile:wave6:created',
  createdAtUtc: WAVE6_FIXTURE_NOW,
});

export const HUMAN_ATTRIBUTE_LOCATION = Object.freeze({
  attributeClass: 'LOCATION' as const,
  subjectRef: WAVE6_FIXTURE_PSEUDONYM,
  valueDigest: 'attr:location:digest',
});

export const CREDENTIAL_EXISTS_NOT_EARNED = Object.freeze({
  credentialId: 'cred:msc-unissued',
  issuedAtUtc: WAVE6_FIXTURE_NOW,
  earnedProofRef: null,
});

export const EMPLOYMENT_WITHOUT_WORK = Object.freeze({
  employerRef: 'org:acme',
  employeeRef: WAVE6_FIXTURE_PSEUDONYM,
  active: true,
  workPerformedProofRef: null,
});

export const PAPER_WITHOUT_CONTRIBUTION = Object.freeze({
  paperRef: 'doi:10.1000/exists-only',
  publishedAtUtc: WAVE6_FIXTURE_NOW,
  contributionProofRef: null,
});

export const WAVE6_DOMAIN_FIXTURES = Object.freeze([
  EMPLOYMENT_WORK_EVENT,
  RESEARCH_CONTRIBUTION_EVENT,
  EDUCATION_MILESTONE_EVENT,
  SKILL_DEMONSTRATION_EVENT,
  AUTHORIZED_COMPUTATION_EVENT,
  AUTHORIZED_DATASET_EVENT,
]);
