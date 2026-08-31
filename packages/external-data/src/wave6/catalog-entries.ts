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
 * Wave 6 Prompt 23 — opportunity intelligence catalog entries.
 */

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';

export const OPPORTUNITY_CATALOG_PROVIDER_IDS = [
  'arbeitnow',
  'ai-dev-jobs',
  'artificial-intelligence-jobs',
  'freehire',
  'graphql-jobs',
  'techrole-index',
  'open-skills',
  'noozra',
  'datacube-ai',
  'hackernews',
  'bluesky-public',
] as const;

export type OpportunityCatalogProviderId = (typeof OPPORTUNITY_CATALOG_PROVIDER_IDS)[number];

export const JOB_PROVIDER_IDS = [
  'arbeitnow',
  'ai-dev-jobs',
  'artificial-intelligence-jobs',
  'freehire',
  'graphql-jobs',
] as const;

export const SKILLS_PROVIDER_IDS = ['open-skills', 'techrole-index'] as const;

export const INTELLIGENCE_PROVIDER_IDS = ['noozra', 'datacube-ai', 'hackernews', 'bluesky-public'] as const;

function oppProvider(
  overrides: Partial<CatalogProviderEntry> &
    Pick<CatalogProviderEntry, 'provider_id' | 'name' | 'short_name' | 'description' | 'primary_category' | 'capabilities'>,
): CatalogProviderEntry {
  return Object.freeze({
    secondary_categories: Object.freeze([]),
    endpoints: Object.freeze({
      base_url: null,
      api_version: null,
      documentation_url: null,
      status_url: null,
    }),
    authentication: Object.freeze({
      type: 'none' as const,
      required: false,
      registration_required: false,
      environment_variable: null,
      notes: null,
    }),
    access: Object.freeze({
      status: 'verified_free' as const,
      free_tier_verified: true,
      registration_required: false,
      notes: null,
    }),
    commercial_use: Object.freeze({
      status: 'verified_allowed' as const,
      notes: null,
    }),
    redistribution: Object.freeze({
      status: 'attribution_required' as const,
      notes: null,
    }),
    rate_limits: Object.freeze({
      documented: false,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: 'Respect provider quotas; simulation uses fixtures only.',
    }),
    data_characteristics: Object.freeze({
      freshness: 'realtime',
      geographic_scope: Object.freeze(['GLOBAL']),
      historical_data: false,
      realtime: true,
      data_format: 'json',
      notes: null,
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'economic_graph', 'world', 'action_center']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'community_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
    verification: Object.freeze({
      status: 'verified' as const,
      verified_against_official_docs: true,
      last_verified: '2026-08-31',
      notes: 'Wave 6 Prompt 23 opportunity intelligence subset.',
    }),
    ...overrides,
  });
}

export const OPPORTUNITY_CATALOG_ENTRIES: readonly CatalogProviderEntry[] = Object.freeze([
  oppProvider({
    provider_id: 'arbeitnow',
    name: 'Arbeitnow Job Board API',
    short_name: 'Arbeitnow',
    description: 'Free public job board API with remote and visa-sponsorship filters.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['job_search', 'employment_market', 'career_opportunities']),
    endpoints: Object.freeze({
      base_url: 'https://www.arbeitnow.com/api',
      api_version: 'v1',
      documentation_url: 'https://www.arbeitnow.com/api',
      status_url: null,
    }),
    data_characteristics: Object.freeze({
      freshness: 'realtime',
      geographic_scope: Object.freeze(['EU', 'GLOBAL']),
      historical_data: false,
      realtime: true,
      data_format: 'json',
      notes: 'Job listings expire quickly.',
    }),
  }),
  oppProvider({
    provider_id: 'ai-dev-jobs',
    name: 'AI Dev Jobs API',
    short_name: 'AI Dev Jobs',
    description: 'Free public API listing AI and ML developer job opportunities.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['job_search', 'career_opportunities']),
    endpoints: Object.freeze({
      base_url: 'https://ai.devjobs.app/api',
      api_version: 'v1',
      documentation_url: 'https://ai.devjobs.app/',
      status_url: null,
    }),
  }),
  oppProvider({
    provider_id: 'artificial-intelligence-jobs',
    name: 'Artificial Intelligence Jobs',
    short_name: 'AI Jobs',
    description: 'Free public job board API focused on AI, data science, and ML careers.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['job_search', 'career_opportunities']),
    endpoints: Object.freeze({
      base_url: 'https://artificialintelligencejobs.co.uk/api',
      api_version: 'v1',
      documentation_url: 'https://artificialintelligencejobs.co.uk/',
      status_url: null,
    }),
    data_characteristics: Object.freeze({
      freshness: 'realtime',
      geographic_scope: Object.freeze(['GB', 'EU', 'GLOBAL']),
      historical_data: false,
      realtime: true,
      data_format: 'json',
      notes: null,
    }),
  }),
  oppProvider({
    provider_id: 'freehire',
    name: 'Freehire Job API',
    short_name: 'Freehire',
    description: 'Free public job listings API for technology and startup roles.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['job_search', 'employment_market', 'career_opportunities']),
    endpoints: Object.freeze({
      base_url: 'https://freehire.app/api',
      api_version: 'v1',
      documentation_url: 'https://freehire.app/',
      status_url: null,
    }),
  }),
  oppProvider({
    provider_id: 'graphql-jobs',
    name: 'GraphQL Jobs API',
    short_name: 'GraphQL Jobs',
    description: 'Free public job board API for GraphQL and TypeScript developer roles.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['job_search', 'career_opportunities']),
    endpoints: Object.freeze({
      base_url: 'https://graphql.jobs/api',
      api_version: 'v1',
      documentation_url: 'https://graphql.jobs/',
      status_url: null,
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'economic_graph', 'world']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'medium',
      launch_tier: 'production_candidate',
      authority_class: 'community_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
  }),
  oppProvider({
    provider_id: 'techrole-index',
    name: 'TechRole Index',
    short_name: 'TechRole Index',
    description: 'Free public technology role and skill demand index.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['occupations', 'skills', 'employment_market', 'salaries']),
    endpoints: Object.freeze({
      base_url: 'https://techroleindex.com/api',
      api_version: 'v1',
      documentation_url: 'https://techroleindex.com/',
      status_url: null,
    }),
    data_characteristics: Object.freeze({
      freshness: 'daily',
      geographic_scope: Object.freeze(['US', 'GLOBAL']),
      historical_data: true,
      realtime: false,
      data_format: 'json',
      notes: 'Occupation and skill demand reference.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'economic_graph', 'world']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'derived_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
  }),
  oppProvider({
    provider_id: 'open-skills',
    name: 'Open Skills API',
    short_name: 'Open Skills',
    description: 'Free open skills taxonomy API with canonical names and occupation mappings.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['skills', 'occupations']),
    endpoints: Object.freeze({
      base_url: 'https://api.openskills.network',
      api_version: 'v1',
      documentation_url: 'https://openskills.network/',
      status_url: null,
    }),
    data_characteristics: Object.freeze({
      freshness: 'weekly',
      geographic_scope: Object.freeze(['GLOBAL']),
      historical_data: true,
      realtime: false,
      data_format: 'json',
      notes: 'Skills taxonomy.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'economic_graph', 'world']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'critical',
      launch_tier: 'production_candidate',
      authority_class: 'community_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
  }),
  oppProvider({
    provider_id: 'noozra',
    name: 'Noozra News API',
    short_name: 'Noozra',
    description: 'Free public news aggregation for job-market and economic opportunity context.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['public_opportunity_data', 'employment_market']),
    endpoints: Object.freeze({
      base_url: 'https://api.noozra.com',
      api_version: 'v1',
      documentation_url: 'https://noozra.com/',
      status_url: null,
    }),
    authentication: Object.freeze({
      type: 'api_key' as const,
      required: false,
      registration_required: false,
      environment_variable: 'NOOZRA_API_KEY',
      notes: 'Optional API key.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'world', 'action_center']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'medium',
      launch_tier: 'production_candidate',
      authority_class: 'derived_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
  }),
  oppProvider({
    provider_id: 'datacube-ai',
    name: 'DataCube AI Intelligence',
    short_name: 'DataCube AI',
    description: 'Free public market intelligence for technology trends and hiring signals.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['public_opportunity_data', 'employment_market']),
    endpoints: Object.freeze({
      base_url: 'https://api.datacube.ai',
      api_version: 'v1',
      documentation_url: 'https://datacube.ai/',
      status_url: null,
    }),
    data_characteristics: Object.freeze({
      freshness: 'daily',
      geographic_scope: Object.freeze(['GLOBAL']),
      historical_data: true,
      realtime: false,
      data_format: 'json',
      notes: 'Derived intelligence.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'world']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'medium',
      launch_tier: 'production_candidate',
      authority_class: 'derived_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
  }),
  oppProvider({
    provider_id: 'hackernews',
    name: 'Hacker News API',
    short_name: 'HackerNews',
    description: 'Free public Hacker News API for technology hiring signals and startup opportunities.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['public_opportunity_data', 'employment_market', 'career_opportunities']),
    endpoints: Object.freeze({
      base_url: 'https://hn.algolia.com/api',
      api_version: 'v1',
      documentation_url: 'https://hn.algolia.com/api',
      status_url: null,
    }),
    rate_limits: Object.freeze({
      documented: true,
      requests_per_second: 10,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: 'Algolia HN API rate limits.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'world', 'action_center']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'medium',
      launch_tier: 'production_candidate',
      authority_class: 'community_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
  }),
  oppProvider({
    provider_id: 'bluesky-public',
    name: 'Bluesky Public Feeds',
    short_name: 'Bluesky',
    description: 'Free public Bluesky feeds for technology career signals and hiring announcements.',
    primary_category: 'jobs_skills',
    capabilities: Object.freeze(['public_opportunity_data', 'employment_market']),
    endpoints: Object.freeze({
      base_url: 'https://public.api.bsky.app',
      api_version: 'v1',
      documentation_url: 'https://docs.bsky.app/',
      status_url: null,
    }),
    commercial_use: Object.freeze({
      status: 'unclear' as const,
      notes: 'Review Bluesky terms for commercial redistribution.',
    }),
    rate_limits: Object.freeze({
      documented: true,
      requests_per_second: 3,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: 'Bluesky public API rate limits.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['grow', 'financial_agent', 'world']),
      canonical_provider_interface: 'OpportunityProvider',
      priority: 'low',
      launch_tier: 'production_candidate',
      authority_class: 'community_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/external-data/src/wave6/adapters/index.ts',
    }),
  }),
]);
