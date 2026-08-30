/**
 * Test fixtures for provider-sdk unit tests.
 */

import { buildCatalogIndex, catalogEntryToDescriptor } from '../catalog/loader.ts';
import type { CatalogProviderEntry, FreeApiCatalog } from '../catalog/types.ts';
import { CATALOG_ID, EXPECTED_PROVIDER_COUNT } from '../catalog/types.ts';

function baseProvider(overrides: Partial<CatalogProviderEntry> & Pick<CatalogProviderEntry, 'provider_id'>): CatalogProviderEntry {
  const {
    provider_id,
    name = 'Fixture Provider',
    short_name = 'Fixture',
    description = 'Fixture provider for provider-sdk tests.',
    primary_category = 'macroeconomics',
    capabilities = ['macroeconomic_indicators'],
    endpoints = {
      base_url: 'https://api.example.com',
      api_version: 'v1',
      documentation_url: 'https://docs.example.com',
      status_url: null,
    },
    authentication = {
      type: 'none',
      required: false,
      registration_required: false,
      environment_variable: null,
      notes: null,
    },
    access = {
      status: 'verified_free',
      free_tier_verified: true,
      registration_required: false,
      notes: null,
    },
    commercial_use = {
      status: 'verified_allowed',
      notes: null,
    },
    redistribution = {
      status: 'allowed',
      notes: null,
    },
    rate_limits = {
      documented: false,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: null,
    },
    data_characteristics = {
      freshness: 'daily',
      geographic_scope: ['US'],
      historical_data: true,
      realtime: false,
      data_format: 'json',
      notes: null,
    },
    sunrey = {
      domain: ['world', 'grow'],
      canonical_provider_interface: 'MacroDataProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'reference_data',
      integration_state: 'catalog_only',
      existing_adapter: null,
    },
    verification = {
      status: 'verified',
      verified_against_official_docs: true,
      last_verified: '2026-01-01',
      notes: 'Test fixture.',
    },
    ...rest
  } = overrides;

  return Object.freeze({
    provider_id,
    name,
    short_name,
    description,
    primary_category,
    capabilities,
    endpoints,
    authentication,
    access,
    commercial_use,
    redistribution,
    rate_limits,
    data_characteristics,
    sunrey,
    verification,
    ...rest,
  });
}

export const FIXTURE_CATALOG_ENTRIES = Object.freeze({
  healthy: baseProvider({
    provider_id: 'fixture-healthy',
    name: 'Fixture Healthy Provider',
    capabilities: ['macroeconomic_indicators', 'inflation'],
    sunrey: {
      domain: ['world', 'economic_graph'],
      canonical_provider_interface: 'MacroDataProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'reference_data',
      integration_state: 'catalog_only',
      existing_adapter: null,
    },
  }),
  failing: baseProvider({
    provider_id: 'fixture-failing',
    name: 'Fixture Failing Provider',
    primary_category: 'foreign_exchange',
    capabilities: ['fx_rates'],
    sunrey: {
      domain: ['exchange', 'world'],
      canonical_provider_interface: 'FxRateProvider',
      priority: 'medium',
      launch_tier: 'secondary_source',
      authority_class: 'reference_data',
      integration_state: 'catalog_only',
      existing_adapter: null,
    },
  }),
  blocked: baseProvider({
    provider_id: 'fixture-blocked',
    name: 'Fixture Blocked Provider',
    primary_category: 'compliance',
    capabilities: ['sanctions', 'pep_screening'],
    sunrey: {
      domain: ['compliance'],
      canonical_provider_interface: 'SanctionsProvider',
      priority: 'critical',
      launch_tier: 'blocked_pending_review',
      authority_class: 'regulated_provider',
      integration_state: 'catalog_only',
      existing_adapter: null,
    },
    verification: {
      status: 'unverified',
      verified_against_official_docs: false,
      last_verified: null,
      notes: 'Blocked fixture.',
    },
  }),
  credentialRequired: baseProvider({
    provider_id: 'fixture-credential',
    name: 'Fixture Credential Provider',
    primary_category: 'weather',
    capabilities: ['weather'],
    authentication: {
      type: 'api_key',
      required: true,
      registration_required: true,
      environment_variable: 'FIXTURE_WEATHER_API_KEY',
      notes: null,
    },
    sunrey: {
      domain: ['world', 'infrastructure'],
      canonical_provider_interface: 'WeatherProvider',
      priority: 'low',
      launch_tier: 'research_only',
      authority_class: 'community_data',
      integration_state: 'catalog_only',
      existing_adapter: null,
    },
    verification: {
      status: 'partially_verified',
      verified_against_official_docs: false,
      last_verified: null,
      notes: null,
    },
    commercial_use: {
      status: 'unclear',
      notes: null,
    },
  }),
});

export function createFixtureCatalog(
  providers: readonly CatalogProviderEntry[] = Object.values(FIXTURE_CATALOG_ENTRIES),
): FreeApiCatalog {
  return Object.freeze({
    schema_version: '1.0.0',
    catalog_id: CATALOG_ID,
    expected_provider_count: EXPECTED_PROVIDER_COUNT,
    population_status: 'partial',
    providers: Object.freeze([...providers]),
  });
}

export function createFixtureCatalogIndex(
  providers: readonly CatalogProviderEntry[] = Object.values(FIXTURE_CATALOG_ENTRIES),
) {
  return buildCatalogIndex(createFixtureCatalog(providers));
}

export function descriptorFromFixture(entry: CatalogProviderEntry) {
  return catalogEntryToDescriptor(entry, 'preview_only');
}
