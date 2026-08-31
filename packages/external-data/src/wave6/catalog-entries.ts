/**
 * Wave 6 provider catalog entries and implementation registry.
 *
 * Only providers present in the authoritative Wave 0 catalog (or wave6 fragment)
 * are listed as implemented. Missing master-list providers are tracked separately.
 */

const BASE = {
  endpoints: {
    base_url: null as string | null,
    api_version: null as string | null,
    documentation_url: null as string | null,
    status_url: null as string | null,
  },
  authentication: {
    type: 'none' as const,
    required: false,
    registration_required: false,
    environment_variable: null as string | null,
    notes: null as string | null,
  },
  access: {
    status: 'verified_free' as const,
    free_tier_verified: true,
    registration_required: false,
    notes: null as string | null,
  },
  commercial_use: { status: 'verified_allowed' as const, notes: null as string | null },
  redistribution: { status: 'attribution_required' as const, notes: null as string | null },
  rate_limits: {
    documented: true,
    requests_per_second: null as number | null,
    requests_per_minute: null as number | null,
    requests_per_hour: null as number | null,
    requests_per_day: null as number | null,
    monthly_quota: null as number | null,
    concurrency_limit: null as number | null,
    notes: 'Simulation fixtures only.',
  },
  data_characteristics: {
    freshness: 'daily' as const,
    geographic_scope: ['GLOBAL'] as string[],
    historical_data: true,
    realtime: false,
    data_format: 'json' as const,
    notes: null as string | null,
  },
  verification: {
    status: 'verified' as const,
    verified_against_official_docs: true,
    last_verified: '2026-08-31',
    notes: 'Wave 6 Prompt 24 fixture-backed adapter.',
  },
};

function entry(
  providerId: string,
  name: string,
  shortName: string,
  description: string,
  primaryCategory: string,
  capabilities: string[],
  domains: string[],
  iface: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    provider_id: providerId,
    name,
    short_name: shortName,
    description,
    primary_category: primaryCategory,
    capabilities,
    ...BASE,
    ...overrides,
    sunrey: {
      domain: domains,
      canonical_provider_interface: iface,
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'reference_data',
      integration_state: 'implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters.ts',
      ...(overrides.sunrey as object | undefined),
    },
    verification: { ...BASE.verification, ...(overrides.verification as object | undefined) },
  };
}

/** Providers with Wave 6 simulation adapters wired in this prompt. */
export const WAVE6_IMPLEMENTED_PROVIDER_IDS = Object.freeze([
  'sec-edgar',
  'federal-register',
  'indian-mandi-prices',
  'co2-offset',
  'website-carbon',
]);

export const WAVE6_BLOCKED_PROVIDER_IDS = Object.freeze([
  'tilth',
  'quandl-nasdaq-data-link',
]);

export const WAVE6_DEPRECATED_PROVIDER_IDS = Object.freeze(['treasury-direct-legacy-xml']);

/**
 * Providers referenced by Wave 6 scope but absent from the authoritative catalog.
 * Documented for coverage audit — not invented into the catalog.
 */
export const WAVE6_AWAITING_MASTER_LIST_PROVIDER_IDS = Object.freeze([
  'openalex',
  'arxiv',
  'osf',
  'share',
  'patentsview',
  'uspto-open-data',
  'wikidata',
  'wikipedia-api',
  'socrata',
  'openafrica',
  'teleport',
  'lowy-asia-power-index',
  'nasa',
  'google-earth-engine',
  'ai-economics-tools',
  'statlyte',
  'tensorfeed',
]);

export const WAVE6_CATALOG_ENTRIES = Object.freeze([
  entry(
    'sec-edgar',
    'SEC EDGAR',
    'SEC EDGAR',
    'Corporate filings and registrant metadata for research and innovation intelligence.',
    'corporate_filings',
    ['corporate_filings', 'research_papers', 'company_metadata'],
    ['research', 'financial_agent', 'grow', 'world'],
    'ResearchIntelligenceProvider',
    {
      sunrey: {
        authority_class: 'authoritative_official',
        launch_tier: 'production_candidate',
      },
    },
  ),
  entry(
    'federal-register',
    'Federal Register API',
    'Federal Register',
    'U.S. regulatory documents for research and policy intelligence.',
    'government_open_data',
    ['regulatory_documents', 'research_papers'],
    ['research', 'world', 'compliance', 'grow'],
    'ResearchIntelligenceProvider',
    {
      secondary_categories: ['research'],
      sunrey: { authority_class: 'authoritative_official', launch_tier: 'secondary_source' },
    },
  ),
  entry(
    'indian-mandi-prices',
    'Indian Mandi Prices (data.gov.in)',
    'Mandi Prices',
    'Public agricultural commodity prices for food reference — not private HIN data.',
    'food_nutrition',
    ['agriculture_prices', 'food_reference'],
    ['hin', 'world', 'grow'],
    'HinReferenceProvider',
    {
      secondary_categories: ['government_open_data'],
      sunrey: { authority_class: 'authoritative_official', launch_tier: 'production_candidate' },
    },
  ),
  entry(
    'co2-offset',
    'CO2 Offset API',
    'CO2 Offset',
    'Environmental research and sustainability reference data.',
    'environmental',
    ['carbon_intensity', 'research_papers'],
    ['research', 'grow', 'moonrey'],
    'ResearchIntelligenceProvider',
    {
      secondary_categories: ['natural_resources'],
      sunrey: { authority_class: 'community_data', launch_tier: 'research_only' },
      verification: { status: 'partially_verified', verified_against_official_docs: false },
    },
  ),
  entry(
    'website-carbon',
    'Website Carbon API',
    'Website Carbon',
    'Derived carbon estimates and AI model metadata reference for research context.',
    'environmental',
    ['carbon_intensity', 'ai_model_metadata'],
    ['research', 'moonrey', 'grow'],
    'AiModelMetadataProvider',
    {
      sunrey: { authority_class: 'derived_data', launch_tier: 'research_only' },
      verification: { status: 'partially_verified', verified_against_official_docs: true },
    },
  ),
]);

export const WAVE6_CACHE_POLICIES = Object.freeze({
  patent_metadata: Object.freeze({ ttlMs: 86_400_000 * 7, staleWhileRevalidateMs: 86_400_000 }),
  research_metadata: Object.freeze({ ttlMs: 86_400_000, staleWhileRevalidateMs: 43_200_000 }),
  ai_model_pricing: Object.freeze({ ttlMs: 3_600_000, staleWhileRevalidateMs: 1_800_000 }),
  knowledge_graph: Object.freeze({ ttlMs: 86_400_000 * 3, staleWhileRevalidateMs: 86_400_000 }),
  open_government_static: Object.freeze({ ttlMs: 86_400_000 * 14, staleWhileRevalidateMs: 86_400_000 }),
  hin_food_reference: Object.freeze({ ttlMs: 86_400_000, staleWhileRevalidateMs: 43_200_000 }),
  opportunity_listings: Object.freeze({ ttlMs: 21_600_000, staleWhileRevalidateMs: 10_800_000 }),
});

export function wave6CachePolicy(capability: string): { readonly ttlMs: number; readonly staleWhileRevalidateMs: number } {
  if (capability.startsWith('patent')) {
    return WAVE6_CACHE_POLICIES.patent_metadata;
  }
  if (capability.startsWith('ai_model') || capability.startsWith('ai_economic')) {
    return WAVE6_CACHE_POLICIES.ai_model_pricing;
  }
  if (capability.startsWith('knowledge')) {
    return WAVE6_CACHE_POLICIES.knowledge_graph;
  }
  if (capability.startsWith('hin') || capability.startsWith('food')) {
    return WAVE6_CACHE_POLICIES.hin_food_reference;
  }
  if (capability.startsWith('opportunity') || capability.startsWith('job') || capability.startsWith('skill')) {
    return WAVE6_CACHE_POLICIES.opportunity_listings;
  }
  if (capability.startsWith('government')) {
    return WAVE6_CACHE_POLICIES.open_government_static;
  }
  return WAVE6_CACHE_POLICIES.research_metadata;
}
