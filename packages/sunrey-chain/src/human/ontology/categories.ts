/**
 * Wave 6 — governance categories mapped to Chunk 104 contribution classes.
 *
 * Does not invent monetary weights. Adding a category never grants issuance.
 */

import type { ContributionClass } from '../../../../human-economic-contribution/src/taxonomy.ts';
import type { HumanGovernanceCategory, HumanGovernanceCategoryRecord } from './types.ts';

function category(
  governanceCategory: HumanGovernanceCategory,
  label: string,
  description: string,
  contributionClasses: readonly ContributionClass[],
  input: { readonly requiresConsent?: boolean; readonly requiresRights?: boolean; readonly requiresAttestation?: boolean },
): HumanGovernanceCategoryRecord {
  return Object.freeze({
    governanceCategory,
    label,
    description,
    contributionClasses,
    requiresConsent: input.requiresConsent ?? false,
    requiresRights: input.requiresRights ?? false,
    requiresAttestation: input.requiresAttestation ?? true,
    monetizableByDefault: false,
    humanWorthMeasure: false,
  });
}

export const HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY: Readonly<Record<HumanGovernanceCategory, HumanGovernanceCategoryRecord>> =
  Object.freeze({
    WORK_CONTRIBUTION: category(
      'WORK_CONTRIBUTION',
      'Work Contribution',
      'Verified labor or professional service performed over a bounded interval',
      ['PROFESSIONAL_EXPERTISE', 'HUMAN_SERVICE_DELIVERY'],
      { requiresAttestation: true },
    ),
    SKILL_APPLICATION: category(
      'SKILL_APPLICATION',
      'Skill Application',
      'Demonstrated application of a governed skill under methodology',
      ['EDUCATION_SKILL_ATTESTATION', 'PROFESSIONAL_EXPERTISE'],
      { requiresAttestation: true },
    ),
    EDUCATIONAL_ACHIEVEMENT: category(
      'EDUCATIONAL_ACHIEVEMENT',
      'Educational Achievement',
      'Credential or milestone legitimately earned under institutional attestation',
      ['EDUCATION_SKILL_ATTESTATION'],
      { requiresAttestation: true },
    ),
    RESEARCH_CONTRIBUTION: category(
      'RESEARCH_CONTRIBUTION',
      'Research Contribution',
      'Verified participation in or authorship of research output',
      ['RESEARCH_PARTICIPATION', 'VERIFIED_KNOWLEDGE_CONTRIBUTION'],
      { requiresConsent: true, requiresAttestation: true },
    ),
    KNOWLEDGE_CONTRIBUTION: category(
      'KNOWLEDGE_CONTRIBUTION',
      'Knowledge Contribution',
      'Verified knowledge artifact contributed under rights and purpose controls',
      ['VERIFIED_KNOWLEDGE_CONTRIBUTION'],
      { requiresConsent: true, requiresRights: true, requiresAttestation: true },
    ),
    AUTHORIZED_DATA_CONTRIBUTION: category(
      'AUTHORIZED_DATA_CONTRIBUTION',
      'Authorized Data Contribution',
      'Authorized dataset use or contribution event — not raw personal attribute exposure',
      ['INFORMATION_RIGHT_CONTRIBUTION'],
      { requiresConsent: true, requiresRights: true, requiresAttestation: true },
    ),
    COMPUTATION_PARTICIPATION: category(
      'COMPUTATION_PARTICIPATION',
      'Computation Participation',
      'Bounded authorized computation participation with receipt',
      ['MODEL_TRAINING_PARTICIPATION'],
      { requiresConsent: true, requiresRights: true, requiresAttestation: true },
    ),
    CREATIVE_CONTRIBUTION: category(
      'CREATIVE_CONTRIBUTION',
      'Creative Contribution',
      'Creative work contributed under rights and attestation',
      ['CREATIVE_PRODUCTION', 'CREATOR_ROYALTY_EVENT'],
      { requiresConsent: true, requiresRights: true, requiresAttestation: true },
    ),
    COMMUNITY_CONTRIBUTION: category(
      'COMMUNITY_CONTRIBUTION',
      'Community Contribution',
      'Verified community service or civic contribution',
      ['COMMUNITY_CONTRIBUTION'],
      { requiresAttestation: true },
    ),
    ENTREPRENEURIAL_CONTRIBUTION: category(
      'ENTREPRENEURIAL_CONTRIBUTION',
      'Entrepreneurial Contribution',
      'Verified entrepreneurial activity under governed methodology',
      ['ENTREPRENEURIAL_ACTIVITY', 'ECONOMIC_PARTICIPATION'],
      { requiresAttestation: true },
    ),
    CARE_CONTRIBUTION: category(
      'CARE_CONTRIBUTION',
      'Care Contribution',
      'Legitimately measurable and authorized care service delivery',
      ['HUMAN_SERVICE_DELIVERY'],
      { requiresConsent: true, requiresAttestation: true },
    ),
    OTHER_GOVERNANCE_APPROVED: category(
      'OTHER_GOVERNANCE_APPROVED',
      'Other Governance Approved',
      'Governance-approved contribution class not covered by explicit taxonomy row',
      ['OTHER_GOVERNED_HUMAN_CONTRIBUTION'],
      { requiresAttestation: true },
    ),
  });

export function governanceCategoryRecord(
  governanceCategory: HumanGovernanceCategory,
): HumanGovernanceCategoryRecord {
  return HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY[governanceCategory];
}

export function contributionClassForGovernanceCategory(
  governanceCategory: HumanGovernanceCategory,
): readonly ContributionClass[] {
  return HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY[governanceCategory].contributionClasses;
}

export function governanceCategoryForContributionClass(
  contributionClass: ContributionClass,
): HumanGovernanceCategory | undefined {
  for (const record of Object.values(HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY)) {
    if ((record.contributionClasses as readonly string[]).includes(contributionClass)) {
      return record.governanceCategory;
    }
  }
  return undefined;
}

export function listGovernanceCategories(): readonly HumanGovernanceCategoryRecord[] {
  return Object.freeze(Object.values(HUMAN_GOVERNANCE_CATEGORY_ONTOLOGY));
}
