/**
 * Wave 5 catalog entries for productive-economy provider runtime.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';

const CATALOG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../config/providers/wave5-energy-resource-catalog-entries.yaml',
);

const WAVE5_YAML = parseYaml(readFileSync(CATALOG_PATH, 'utf8')) as { providers: CatalogProviderEntry[] };

const FRED_COMMODITY_ENTRY: CatalogProviderEntry = Object.freeze({
  provider_id: 'fred-commodity',
  name: 'FRED Commodity Prices',
  short_name: 'FRED Commodities',
  description: 'FRED commodity and energy price series (Wave 2 extension).',
  primary_category: 'commodities',
  secondary_categories: [],
  capabilities: ['commodity_prices', 'energy_prices', 'agriculture_prices'],
  endpoints: {
    base_url: 'https://api.stlouisfed.org/fred',
    api_version: 'v1',
    documentation_url: 'https://fred.stlouisfed.org/docs/api/fred/',
    status_url: null,
  },
  authentication: {
    type: 'api_key',
    required: true,
    registration_required: true,
    environment_variable: 'FRED_API_KEY',
    notes: null,
  },
  access: {
    status: 'verified_free',
    free_tier_verified: true,
    registration_required: true,
    notes: null,
  },
  commercial_use: { status: 'verified_allowed', notes: null },
  redistribution: { status: 'attribution_required', notes: null },
  rate_limits: {
    documented: true,
    requests_per_second: null,
    requests_per_minute: 120,
    requests_per_hour: null,
    requests_per_day: null,
    monthly_quota: null,
    concurrency_limit: null,
    notes: null,
  },
  data_characteristics: {
    freshness: 'daily',
    geographic_scope: ['US', 'global'],
    historical_data: true,
    realtime: false,
    data_format: 'json',
    notes: null,
  },
  sunrey: {
    domain: ['world', 'economic_graph', 'moonrey'],
    canonical_provider_interface: 'MacroDataProvider',
    priority: 'medium',
    launch_tier: 'secondary_source',
    authority_class: 'authoritative_official',
    integration_state: 'implemented',
    existing_adapter: null,
  },
  verification: {
    status: 'verified',
    verified_against_official_docs: true,
    last_verified: '2026-08-31',
    notes: 'Wave 2 commodity adapter extended for energy/resource normalization.',
  },
});

export const WAVE5_CATALOG_ENTRIES: readonly CatalogProviderEntry[] = Object.freeze(
  [...WAVE5_YAML.providers.map((entry) => Object.freeze({ ...entry })), FRED_COMMODITY_ENTRY],
);

export const WAVE5_ADAPTER_IDS = Object.freeze([
  'national-grid-eso',
  'uk-carbon-intensity',
  'energi-data-service',
  'co2-offset',
  'website-carbon',
  'indian-mandi-prices',
  'fred-commodity',
] as const);

export type Wave5AdapterId = (typeof WAVE5_ADAPTER_IDS)[number];

export const WAVE5_BLOCKED_PROVIDER_IDS = Object.freeze(['tilth'] as const);

export function wave5ProviderClassification(providerId: string): import('./types.ts').Wave5ProviderClassification {
  const entry = WAVE5_CATALOG_ENTRIES.find((e) => e.provider_id === providerId);
  if (!entry) {
    if (providerId === 'fred-commodity') {
      return 'PRODUCTION_CANDIDATE';
    }
    return 'UNAVAILABLE';
  }
  switch (entry.sunrey.launch_tier) {
    case 'production_candidate':
      return 'PRODUCTION_CANDIDATE';
    case 'research_only':
      return 'PREVIEW_ONLY';
    case 'blocked_pending_review':
      return 'BLOCKED';
    default:
      return 'PREVIEW_ONLY';
  }
}

export function wave5CoverageReport(): readonly import('./types.ts').Wave5ProviderCoverage[] {
  const entries = [
    ...WAVE5_CATALOG_ENTRIES,
    ...WAVE5_BLOCKED_PROVIDER_IDS.map((id) => WAVE5_CATALOG_ENTRIES.find((e) => e.provider_id === id)).filter(Boolean),
  ];
  const seen = new Set<string>();
  const result: import('./types.ts').Wave5ProviderCoverage[] = [];

  for (const entry of WAVE5_CATALOG_ENTRIES) {
    if (seen.has(entry.provider_id)) {
      continue;
    }
    seen.add(entry.provider_id);
    result.push(
      Object.freeze({
        providerId: entry.provider_id,
        classification: wave5ProviderClassification(entry.provider_id),
        category: entry.primary_category,
        capabilities: Object.freeze([...entry.capabilities]),
        geographicScope: Object.freeze([...(entry.data_characteristics.geographic_scope ?? [])]),
        notes: entry.verification.notes ?? '',
      }),
    );
  }

  result.push(
    Object.freeze({
      providerId: 'fred-commodity',
      classification: 'PRODUCTION_CANDIDATE',
      category: 'commodities',
      capabilities: Object.freeze(['commodity_prices', 'energy_prices', 'agriculture_prices']),
      geographicScope: Object.freeze(['US', 'global']),
      notes: 'Wave 2 commodity adapter extended for energy/resource normalization.',
    }),
  );

  return Object.freeze(result);
}
