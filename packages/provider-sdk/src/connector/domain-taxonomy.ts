/**
 * Wave 4 — economic domain taxonomy for provider classification.
 */

import type { ProviderCategory } from '../registry-types.ts';

export const HUMAN_ECONOMY_DOMAINS = [
  'health',
  'research',
  'education',
  'workforce',
  'skills',
  'publications',
  'identity_attestations',
  'other_human_contribution',
] as const;
export type HumanEconomyDomain = (typeof HUMAN_ECONOMY_DOMAINS)[number];

export const PRODUCTIVE_ECONOMY_DOMAINS = [
  'energy',
  'compute',
  'ai_compute',
  'manufacturing',
  'resources',
  'agriculture',
  'food',
  'real_estate',
  'infrastructure',
  'logistics',
  'transportation',
  'bandwidth',
  'water',
  'other_productive',
] as const;
export type ProductiveEconomyDomain = (typeof PRODUCTIVE_ECONOMY_DOMAINS)[number];

export const REFERENCE_CONTEXT_DOMAINS = [
  'weather',
  'geospatial',
  'economic_statistics',
  'market_data',
  'regulatory',
  'government',
  'filings',
  'other_reference',
] as const;
export type ReferenceContextDomain = (typeof REFERENCE_CONTEXT_DOMAINS)[number];

export const ECONOMIC_DOMAINS = [
  ...HUMAN_ECONOMY_DOMAINS,
  ...PRODUCTIVE_ECONOMY_DOMAINS,
  ...REFERENCE_CONTEXT_DOMAINS,
] as const;
export type EconomicDomain = (typeof ECONOMIC_DOMAINS)[number];

export type EconomicDomainPlane = 'HUMAN_ECONOMY' | 'PRODUCTIVE_ECONOMY' | 'REFERENCE_CONTEXT';

export function planeForDomain(domain: EconomicDomain): EconomicDomainPlane {
  if ((HUMAN_ECONOMY_DOMAINS as readonly string[]).includes(domain)) {
    return 'HUMAN_ECONOMY';
  }
  if ((PRODUCTIVE_ECONOMY_DOMAINS as readonly string[]).includes(domain)) {
    return 'PRODUCTIVE_ECONOMY';
  }
  return 'REFERENCE_CONTEXT';
}

/** Map catalog primary_category to one or more economic domains. */
export function economicDomainsForCategory(category: ProviderCategory): readonly EconomicDomain[] {
  switch (category) {
    case 'health':
    case 'food_nutrition':
      return ['health', 'food'];
    case 'research':
    case 'patents':
      return ['research', 'publications'];
    case 'jobs_skills':
    case 'artificial_intelligence':
      return ['workforce', 'skills'];
    case 'energy':
      return ['energy'];
    case 'natural_resources':
    case 'commodities':
      return ['resources'];
    case 'environmental':
    case 'weather':
    case 'water':
      return category === 'weather' ? ['weather'] : category === 'water' ? ['water'] : ['weather'];
    case 'transportation':
    case 'aviation':
    case 'maritime':
    case 'travel':
    case 'logistics':
      return ['transportation', 'logistics'];
    case 'geospatial':
      return ['geospatial'];
    case 'macroeconomics':
    case 'government_open_data':
      return ['economic_statistics', 'government'];
    case 'markets':
    case 'securities':
    case 'foreign_exchange':
    case 'cryptocurrency':
      return ['market_data'];
    case 'corporate_filings':
      return ['filings'];
    case 'compliance':
    case 'kyb_identity':
    case 'fraud_risk':
      return ['regulatory'];
    case 'manufacturing':
      return ['manufacturing'];
    case 'blockchain':
    case 'cybersecurity':
      return ['other_reference'];
    default:
      return ['other_reference'];
  }
}

export function classifyProviderDomains(
  primaryCategory: ProviderCategory,
  secondaryCategories: readonly ProviderCategory[] = [],
): readonly EconomicDomain[] {
  const domains = new Set<EconomicDomain>();
  for (const d of economicDomainsForCategory(primaryCategory)) {
    domains.add(d);
  }
  for (const cat of secondaryCategories) {
    for (const d of economicDomainsForCategory(cat)) {
      domains.add(d);
    }
  }
  return Object.freeze([...domains]);
}
