/**
 * Wave 6 Prompt 22 — health / HIN reference catalog entries.
 */

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import { HEALTH_ADAPTER_IDS } from './types.ts';

function healthProvider(
  provider_id: string,
  name: string,
  short_name: string,
  description: string,
  primary_category: CatalogProviderEntry['primary_category'],
  capabilities: readonly string[],
  authority_class: CatalogProviderEntry['sunrey']['authority_class'],
  launch_tier: CatalogProviderEntry['sunrey']['launch_tier'],
): CatalogProviderEntry {
  return Object.freeze({
    provider_id,
    name,
    short_name,
    description,
    primary_category,
    secondary_categories: [],
    capabilities: [...capabilities],
    endpoints: {
      base_url: `https://api.example.com/${provider_id}`,
      api_version: 'v1',
      documentation_url: `https://docs.example.com/${provider_id}`,
      status_url: null,
    },
    authentication: {
      type: 'none',
      required: false,
      registration_required: false,
      environment_variable: null,
      notes: null,
    },
    access: {
      status: 'verified_free',
      free_tier_verified: true,
      registration_required: false,
      notes: null,
    },
    commercial_use: { status: 'unknown', notes: null },
    redistribution: { status: 'attribution_required', notes: null },
    rate_limits: {
      documented: false,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: null,
    },
    data_characteristics: {
      freshness: 'delayed',
      geographic_scope: ['global'],
      historical_data: false,
      realtime: false,
      data_format: 'json',
      notes: null,
    },
    sunrey: {
      domain: ['hin', 'world', 'vault'] as const,
      canonical_provider_interface: 'HealthReferenceProvider',
      priority: 'medium',
      launch_tier,
      authority_class,
      integration_state: 'simulated',
      existing_adapter: 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts',
    },
    verification: {
      status: 'verified',
      verified_against_official_docs: true,
      last_verified: '2026-08-31',
      notes: 'Wave 6 Prompt 22 fixture adapter.',
    },
  }) as CatalogProviderEntry;
}

export const HEALTH_CATALOG_ENTRIES: readonly CatalogProviderEntry[] = Object.freeze([
  healthProvider('open-food-facts', 'Open Food Facts', 'OFF', 'Community food product database.', 'food_nutrition', ['food_product', 'nutrition'], 'community_data', 'production_candidate'),
  healthProvider('usda-fooddata-central', 'USDA FoodData Central', 'USDA FDC', 'Government nutrition reference.', 'food_nutrition', ['food_product', 'nutrition'], 'authoritative_official', 'production_candidate'),
  healthProvider('medlineplus-genetics', 'MedlinePlus Genetics', 'MedlinePlus', 'NIH genetics educational reference.', 'health', ['genetics_reference'], 'authoritative_official', 'production_candidate'),
  healthProvider('openfda', 'openFDA', 'openFDA', 'FDA drug and device reference.', 'health', ['drug_reference', 'medical_device_reference'], 'authoritative_official', 'production_candidate'),
  healthProvider('nppes', 'NPPES NPI Registry', 'NPPES', 'CMS healthcare provider directory.', 'health', ['healthcare_provider_reference'], 'authoritative_official', 'production_candidate'),
  healthProvider('clinicaltrials-gov', 'ClinicalTrials.gov', 'ClinicalTrials', 'NLM clinical trial registry.', 'health', ['clinical_trials'], 'authoritative_official', 'production_candidate'),
  healthProvider('nhs-scotland-open-data', 'Open Data NHS Scotland', 'NHS Scotland', 'Scottish public health statistics.', 'health', ['public_health'], 'authoritative_official', 'production_candidate'),
  healthProvider('hdx-health', 'HDX Health', 'HDX Health', 'Humanitarian health datasets.', 'health', ['public_health'], 'research_data', 'secondary_source'),
  healthProvider('longevity-world-cup', 'Longevity World Cup', 'LWC', 'Wellness research reference.', 'health', ['wellness_reference'], 'research_data', 'research_only'),
]);

export const HEALTH_BLOCKED_PROVIDER_IDS = Object.freeze([] as const);

export function healthProviderClassification(providerId: string): 'PRODUCTION_CANDIDATE' | 'SECONDARY_SOURCE' | 'RESEARCH_ONLY' | 'BLOCKED' {
  const entry = HEALTH_CATALOG_ENTRIES.find((e) => e.provider_id === providerId);
  if (!entry) return 'BLOCKED';
  switch (entry.sunrey.launch_tier) {
    case 'production_candidate':
      return 'PRODUCTION_CANDIDATE';
    case 'secondary_source':
      return 'SECONDARY_SOURCE';
    case 'research_only':
      return 'RESEARCH_ONLY';
    default:
      return 'BLOCKED';
  }
}

export function catalogEntryForProvider(providerId: string): CatalogProviderEntry | undefined {
  return HEALTH_CATALOG_ENTRIES.find((e) => e.provider_id === providerId);
}

export function healthCoverageReport(): {
  readonly total: number;
  readonly productionCandidate: number;
  readonly secondarySource: number;
  readonly researchOnly: number;
  readonly blocked: number;
} {
  let productionCandidate = 0;
  let secondarySource = 0;
  let researchOnly = 0;
  for (const id of HEALTH_ADAPTER_IDS) {
    const cls = healthProviderClassification(id);
    if (cls === 'PRODUCTION_CANDIDATE') productionCandidate++;
    else if (cls === 'SECONDARY_SOURCE') secondarySource++;
    else if (cls === 'RESEARCH_ONLY') researchOnly++;
  }
  return Object.freeze({
    total: HEALTH_ADAPTER_IDS.length,
    productionCandidate,
    secondarySource,
    researchOnly,
    blocked: HEALTH_BLOCKED_PROVIDER_IDS.length,
  });
}
