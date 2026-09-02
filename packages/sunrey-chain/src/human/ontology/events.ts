/**
 * Wave 6 — explicit human contribution event semantics.
 *
 * Profile creation, app usage, attention, location, and health activity are
 * not monetizable contribution merely because the data exists.
 */

import type { ContributionClass } from '../../../../human-economic-contribution/src/taxonomy.ts';
import type { HumanEventTypeDefinition, HumanGovernanceCategory } from './types.ts';

const EVENT_DEFINITIONS: readonly HumanEventTypeDefinition[] = Object.freeze([
  humanEvent('WorkPerformed', 'WORK_CONTRIBUTION', ['PROFESSIONAL_EXPERTISE', 'HUMAN_SERVICE_DELIVERY'], 'Work Performed', 'Verified work contribution over bounded interval', 'ACTIVITY', 'VERIFIED_PROFESSIONAL_HOUR', false),
  humanEvent('SkillDemonstrated', 'SKILL_APPLICATION', ['EDUCATION_SKILL_ATTESTATION', 'PROFESSIONAL_EXPERTISE'], 'Skill Demonstrated', 'Skill demonstrated under governed methodology', 'ACHIEVEMENT', 'EDUCATION_SKILL_ATTESTATION_UNIT', true),
  humanEvent('CredentialEarned', 'EDUCATIONAL_ACHIEVEMENT', ['EDUCATION_SKILL_ATTESTATION'], 'Credential Earned', 'Credential legitimately earned — not merely issued', 'ACHIEVEMENT', 'EDUCATION_SKILL_ATTESTATION_UNIT', true),
  humanEvent('ResearchPublished', 'RESEARCH_CONTRIBUTION', ['RESEARCH_PARTICIPATION'], 'Research Published', 'Research output exists with publication reference', 'ACTIVITY', 'VERIFIED_RESEARCH_SESSION', false),
  humanEvent('ResearchContributionVerified', 'RESEARCH_CONTRIBUTION', ['RESEARCH_PARTICIPATION', 'VERIFIED_KNOWLEDGE_CONTRIBUTION'], 'Research Contribution Verified', 'Person actually contributed to research output', 'ACHIEVEMENT', 'VERIFIED_RESEARCH_SESSION', true),
  humanEvent('AuthorizedDatasetContribution', 'AUTHORIZED_DATA_CONTRIBUTION', ['INFORMATION_RIGHT_CONTRIBUTION'], 'Authorized Dataset Contribution', 'Authorized dataset contribution or permission event', 'AUTHORIZED_USE', 'CONSENT_SCOPED_INFORMATION_USE', true),
  humanEvent('ComputationContributionCompleted', 'COMPUTATION_PARTICIPATION', ['MODEL_TRAINING_PARTICIPATION'], 'Computation Contribution Completed', 'Bounded authorized computation participation completed', 'ACTIVITY', 'MODEL_TRAINING_PARTICIPATION_UNIT', true),
  humanEvent('EducationalMilestoneCompleted', 'EDUCATIONAL_ACHIEVEMENT', ['EDUCATION_SKILL_ATTESTATION'], 'Educational Milestone Completed', 'Educational milestone completed under attestation', 'ACHIEVEMENT', 'EDUCATION_SKILL_ATTESTATION_UNIT', true),
  humanEvent('CreativeWorkContributed', 'CREATIVE_CONTRIBUTION', ['CREATIVE_PRODUCTION', 'CREATOR_ROYALTY_EVENT'], 'Creative Work Contributed', 'Creative work contributed under rights and verification', 'ACHIEVEMENT', 'APPROVED_CREATIVE_ASSET', true),
  humanEvent('CommunityServiceCompleted', 'COMMUNITY_CONTRIBUTION', ['COMMUNITY_CONTRIBUTION'], 'Community Service Completed', 'Verified community contribution event', 'ACTIVITY', 'VERIFIED_COMMUNITY_CONTRIBUTION_UNIT', true),
  humanEvent('EntrepreneurialMilestoneReached', 'ENTREPRENEURIAL_CONTRIBUTION', ['ENTREPRENEURIAL_ACTIVITY'], 'Entrepreneurial Milestone Reached', 'Verified entrepreneurial contribution milestone', 'ACHIEVEMENT', 'ENTREPRENEURIAL_ACTIVITY_UNIT', true),
  humanEvent('CareServiceDelivered', 'CARE_CONTRIBUTION', ['HUMAN_SERVICE_DELIVERY'], 'Care Service Delivered', 'Authorized measurable care service delivery', 'ACTIVITY', 'VERIFIED_SERVICE_DELIVERY_UNIT', true),
]);

function humanEvent(
  eventType: string,
  governanceCategory: HumanGovernanceCategory,
  contributionClasses: readonly ContributionClass[],
  label: string,
  description: string,
  eventKind: HumanEventTypeDefinition['eventKind'],
  canonicalUnit: string,
  requiresEarnedProof: boolean,
): HumanEventTypeDefinition {
  return Object.freeze({
    eventType,
    governanceCategory,
    contributionClasses,
    label,
    description,
    eventKind,
    canonicalUnit,
    requiresEarnedProof,
    rejectsProfileOrAttribute: true,
  });
}

const BY_TYPE = new Map(EVENT_DEFINITIONS.map((row) => [row.eventType, row]));

export function eventTypeDefinition(eventType: string): HumanEventTypeDefinition | undefined {
  return BY_TYPE.get(eventType);
}

export function listEventTypes(governanceCategory?: HumanGovernanceCategory): readonly HumanEventTypeDefinition[] {
  if (!governanceCategory) {
    return EVENT_DEFINITIONS;
  }
  return EVENT_DEFINITIONS.filter((row) => row.governanceCategory === governanceCategory);
}

export function isKnownEventType(eventType: string): boolean {
  return BY_TYPE.has(eventType);
}

export function eventTypeForContributionClass(contributionClass: ContributionClass): HumanEventTypeDefinition | undefined {
  return EVENT_DEFINITIONS.find((row) => (row.contributionClasses as readonly string[]).includes(contributionClass));
}
