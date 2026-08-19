import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import {
  attestationRefFor,
  communityAttestationRefFor,
  consentGrantRefFor,
  evidenceRefFor,
  eventReferenceFor,
  informationRightRefFor,
  professionalAttestationRefFor,
  provenanceRefFor,
  purposeRefFor,
  researchAttestationRefFor,
  subjectRefFor,
  usageReceiptRefFor,
} from './ids.ts';
import type { RecordContributionInput } from './types.ts';
import type { ContributionClass, MeasurementUnit, SourceClass } from './taxonomy.ts';

export const FIXTURE_NOW: UtcInstant = asUtcInstant('2026-08-19T12:00:00.000Z');
export const FIXTURE_UNTIL: UtcInstant = asUtcInstant('2026-11-19T12:00:00.000Z');
export const FIXTURE_SUBJECT = subjectRefFor('synthetic-contributor-ada');

const CLASS_UNITS: Readonly<Record<ContributionClass, MeasurementUnit>> = Object.freeze({
  INFORMATION_RIGHT_CONTRIBUTION: 'CONSENT_SCOPED_INFORMATION_USE',
  VERIFIED_KNOWLEDGE_CONTRIBUTION: 'VERIFIED_KNOWLEDGE_UNIT',
  CREATIVE_PRODUCTION: 'APPROVED_CREATIVE_ASSET',
  RESEARCH_PARTICIPATION: 'VERIFIED_RESEARCH_SESSION',
  PROFESSIONAL_EXPERTISE: 'VERIFIED_PROFESSIONAL_HOUR',
  ECONOMIC_PARTICIPATION: 'ECONOMIC_PARTICIPATION_UNIT',
  COMMUNITY_CONTRIBUTION: 'VERIFIED_COMMUNITY_CONTRIBUTION_UNIT',
  EDUCATION_SKILL_ATTESTATION: 'EDUCATION_SKILL_ATTESTATION_UNIT',
  MODEL_TRAINING_PARTICIPATION: 'MODEL_TRAINING_PARTICIPATION_UNIT',
  HUMAN_SERVICE_DELIVERY: 'VERIFIED_SERVICE_DELIVERY_UNIT',
  ENTREPRENEURIAL_ACTIVITY: 'ENTREPRENEURIAL_ACTIVITY_UNIT',
  CREATOR_ROYALTY_EVENT: 'CREATOR_ROYALTY_EVENT_UNIT',
  OTHER_GOVERNED_HUMAN_CONTRIBUTION: 'OTHER_GOVERNED_CONTRIBUTION_UNIT',
});

const CLASS_SOURCES: Readonly<Record<ContributionClass, SourceClass>> = Object.freeze({
  INFORMATION_RIGHT_CONTRIBUTION: 'HUMAN_INFORMATION_NETWORK',
  VERIFIED_KNOWLEDGE_CONTRIBUTION: 'VERIFIED_RESEARCH_ATTESTATION',
  CREATIVE_PRODUCTION: 'VERIFIED_COMMUNITY_ATTESTATION',
  RESEARCH_PARTICIPATION: 'VERIFIED_RESEARCH_ATTESTATION',
  PROFESSIONAL_EXPERTISE: 'VERIFIED_PROFESSIONAL_ATTESTATION',
  ECONOMIC_PARTICIPATION: 'CANONICAL_LEDGER_EVENT_REFERENCE',
  COMMUNITY_CONTRIBUTION: 'VERIFIED_COMMUNITY_ATTESTATION',
  EDUCATION_SKILL_ATTESTATION: 'VERIFIED_INSTITUTIONAL_ATTESTATION',
  MODEL_TRAINING_PARTICIPATION: 'HUMAN_INFORMATION_NETWORK',
  HUMAN_SERVICE_DELIVERY: 'VERIFIED_INSTITUTIONAL_ATTESTATION',
  ENTREPRENEURIAL_ACTIVITY: 'VERIFIED_INSTITUTIONAL_ATTESTATION',
  CREATOR_ROYALTY_EVENT: 'HUMAN_INFORMATION_NETWORK',
  OTHER_GOVERNED_HUMAN_CONTRIBUTION: 'OTHER_GOVERNED_SOURCE',
});

export function fixtureContribution(contributionClass: ContributionClass, seed: string = contributionClass): RecordContributionInput {
  const information = ['INFORMATION_RIGHT_CONTRIBUTION', 'VERIFIED_KNOWLEDGE_CONTRIBUTION', 'MODEL_TRAINING_PARTICIPATION', 'CREATOR_ROYALTY_EVENT'].includes(
    contributionClass,
  );
  return {
    subjectRef: FIXTURE_SUBJECT,
    contributionClass,
    sourceClass: CLASS_SOURCES[contributionClass],
    eventReference: eventReferenceFor(seed),
    measurementQuantity: 1n,
    measurementUnit: CLASS_UNITS[contributionClass],
    validFrom: FIXTURE_NOW,
    validUntil: FIXTURE_UNTIL,
    jurisdiction: 'GB',
    evidenceReferences: [evidenceRefFor(seed)],
    rightsReferences: information ? [informationRightRefFor(seed)] : [],
    consentReferences: information ? [consentGrantRefFor(seed)] : [],
    purposeReferences: information ? [purposeRefFor(seed)] : [],
    provenanceReferences: [provenanceRefFor(seed)],
    attestationReferences: [attestationRefFor(seed)],
    usageReceiptReferences: contributionClass === 'INFORMATION_RIGHT_CONTRIBUTION' ? [usageReceiptRefFor(seed)] : [],
    createdAt: FIXTURE_NOW,
    canonicalReferences: {
      informationRightRefs: information ? [informationRightRefFor(seed)] : [],
      consentGrantRefs: information ? [consentGrantRefFor(seed)] : [],
      usageReceiptRefs: contributionClass === 'INFORMATION_RIGHT_CONTRIBUTION' ? [usageReceiptRefFor(seed)] : [],
      communityAttestationRefs: contributionClass === 'COMMUNITY_CONTRIBUTION' ? [communityAttestationRefFor(seed)] : [],
      researchAttestationRefs: contributionClass === 'RESEARCH_PARTICIPATION' ? [researchAttestationRefFor(seed)] : [],
      professionalAttestationRefs: contributionClass === 'PROFESSIONAL_EXPERTISE' ? [professionalAttestationRefFor(seed)] : [],
    },
  };
}
