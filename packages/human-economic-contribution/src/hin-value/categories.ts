/**
 * Versioned HIN product category registry.
 *
 * Maps client-facing contribution categories onto the canonical Chunk 104
 * taxonomy. Adding a product category never grants settlement or issuance
 * eligibility and never encodes biological or behavioral traits as
 * automatically monetizable.
 */

import {
  HUMAN_CONTRIBUTION_TAXONOMY_VERSION,
  type ContributionClass,
} from '../taxonomy.ts';

export const HIN_CATEGORY_REGISTRY_ID = 'sunrey-hin-contribution-categories' as const;
export const HIN_CATEGORY_REGISTRY_VERSION = '1' as const;

export const HIN_PRODUCT_CATEGORIES = [
  'KNOWLEDGE',
  'SKILL',
  'CREATIVE_OUTPUT',
  'WORK_PRODUCTIVE_ACTIVITY',
  'EDUCATION_LEARNING',
  'COMMUNITY_PARTICIPATION',
  'DATA_CONTRIBUTION',
  'ATTENTION_ENGAGEMENT',
  'RESEARCH_CONTRIBUTION',
  'OTHER_APPROVED_HUMAN_INPUT',
] as const;
export type HinProductCategory = (typeof HIN_PRODUCT_CATEGORIES)[number];

export const FORBIDDEN_AUTOMATIC_MONETIZATION_TRAITS = [
  'BIOLOGICAL_TRAIT',
  'BEHAVIORAL_TRAIT',
  'HEALTH_TRAIT',
  'GENETIC_TRAIT',
  'POLITICAL_AFFILIATION',
  'PROTECTED_IDENTITY_TRAIT',
] as const;

export type HinCategoryRecord = {
  readonly category: HinProductCategory;
  readonly registryVersion: typeof HIN_CATEGORY_REGISTRY_VERSION;
  readonly canonicalClass: ContributionClass;
  readonly taxonomyVersion: typeof HUMAN_CONTRIBUTION_TAXONOMY_VERSION;
  readonly consentRequired: boolean;
  readonly informationRightsRequired: boolean;
  readonly automaticallyMonetizable: false;
  readonly encodesProtectedTrait: false;
  readonly issuanceEligibleByDefault: false;
};

const CATEGORY_CLASS: Readonly<Record<HinProductCategory, ContributionClass>> = Object.freeze({
  KNOWLEDGE: 'VERIFIED_KNOWLEDGE_CONTRIBUTION',
  SKILL: 'EDUCATION_SKILL_ATTESTATION',
  CREATIVE_OUTPUT: 'CREATIVE_PRODUCTION',
  WORK_PRODUCTIVE_ACTIVITY: 'HUMAN_SERVICE_DELIVERY',
  EDUCATION_LEARNING: 'EDUCATION_SKILL_ATTESTATION',
  COMMUNITY_PARTICIPATION: 'COMMUNITY_CONTRIBUTION',
  DATA_CONTRIBUTION: 'INFORMATION_RIGHT_CONTRIBUTION',
  ATTENTION_ENGAGEMENT: 'OTHER_GOVERNED_HUMAN_CONTRIBUTION',
  RESEARCH_CONTRIBUTION: 'RESEARCH_PARTICIPATION',
  OTHER_APPROVED_HUMAN_INPUT: 'OTHER_GOVERNED_HUMAN_CONTRIBUTION',
});

const CONSENT_REQUIRED = new Set<HinProductCategory>([
  'KNOWLEDGE',
  'DATA_CONTRIBUTION',
  'ATTENTION_ENGAGEMENT',
  'RESEARCH_CONTRIBUTION',
]);

const RIGHTS_REQUIRED = new Set<HinProductCategory>(['KNOWLEDGE', 'CREATIVE_OUTPUT', 'DATA_CONTRIBUTION']);

function categoryRecord(category: HinProductCategory): HinCategoryRecord {
  return Object.freeze({
    category,
    registryVersion: HIN_CATEGORY_REGISTRY_VERSION,
    canonicalClass: CATEGORY_CLASS[category],
    taxonomyVersion: HUMAN_CONTRIBUTION_TAXONOMY_VERSION,
    consentRequired: CONSENT_REQUIRED.has(category),
    informationRightsRequired: RIGHTS_REQUIRED.has(category),
    automaticallyMonetizable: false,
    encodesProtectedTrait: false,
    issuanceEligibleByDefault: false,
  });
}

export const HIN_CATEGORY_RECORDS: Readonly<Record<HinProductCategory, HinCategoryRecord>> = Object.freeze(
  Object.fromEntries(HIN_PRODUCT_CATEGORIES.map((category) => [category, categoryRecord(category)])) as Record<
    HinProductCategory,
    HinCategoryRecord
  >,
);

export const HIN_CATEGORY_REGISTRY = Object.freeze({
  registryId: HIN_CATEGORY_REGISTRY_ID,
  registryVersion: HIN_CATEGORY_REGISTRY_VERSION,
  categories: HIN_PRODUCT_CATEGORIES,
  records: HIN_CATEGORY_RECORDS,
  forbiddenAutomaticMonetizationTraits: FORBIDDEN_AUTOMATIC_MONETIZATION_TRAITS,
  addingACategoryDoesNotGrantEligibility: true,
  productionActivated: false,
});

export function isHinProductCategory(value: string): value is HinProductCategory {
  return (HIN_PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export function canonicalClassFor(category: HinProductCategory): ContributionClass {
  return HIN_CATEGORY_RECORDS[category].canonicalClass;
}

export function categoryRequiresConsent(category: HinProductCategory): boolean {
  return HIN_CATEGORY_RECORDS[category].consentRequired;
}

export function categoryRequiresRights(category: HinProductCategory): boolean {
  return HIN_CATEGORY_RECORDS[category].informationRightsRequired;
}
