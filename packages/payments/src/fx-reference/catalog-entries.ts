/**
 * Wave 2 Prompt 9 FX reference provider catalog entries.
 * Partial population of the authoritative Wave 0 catalog.
 */

type CatalogEntry = Record<string, unknown>;

function fxCatalogEntry(input: {
  readonly provider_id: string;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly base_url: string;
  readonly documentation_url: string;
  readonly capabilities: readonly string[];
  readonly authority_class: 'authoritative_official' | 'reference_data';
  readonly launch_tier: 'production_candidate' | 'secondary_source' | 'fallback_source' | 'blocked_pending_review';
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly freshness: 'realtime' | 'daily' | 'delayed';
  readonly geographic_scope: readonly string[];
  readonly access_status: 'verified_free' | 'free_tier';
  readonly verification_status: 'verified' | 'partially_verified' | 'unverified';
  readonly requests_per_hour?: number | null;
  readonly requests_per_day?: number | null;
  readonly auth_type?: 'none' | 'api_key';
  readonly environment_variable?: string | null;
}): CatalogEntry {
  return Object.freeze({
    provider_id: input.provider_id,
    name: input.name,
    short_name: input.short_name,
    description: input.description,
    primary_category: 'foreign_exchange',
    secondary_categories: Object.freeze(['macroeconomics']),
    capabilities: Object.freeze([...input.capabilities]),
    endpoints: Object.freeze({
      base_url: input.base_url,
      api_version: 'v1',
      documentation_url: input.documentation_url,
      status_url: null,
    }),
    authentication: Object.freeze({
      type: input.auth_type ?? 'none',
      required: input.auth_type === 'api_key',
      registration_required: input.auth_type === 'api_key',
      environment_variable: input.environment_variable ?? null,
      notes: null,
    }),
    access: Object.freeze({
      status: input.access_status,
      free_tier_verified: true,
      registration_required: input.auth_type === 'api_key',
      notes: null,
    }),
    commercial_use: Object.freeze({
      status: 'verified_allowed',
      notes: 'Open reference FX feed for simulation integration.',
    }),
    redistribution: Object.freeze({
      status: 'attribution_required',
      notes: null,
    }),
    rate_limits: Object.freeze({
      documented: input.requests_per_hour !== null || input.requests_per_day !== null,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: input.requests_per_hour ?? null,
      requests_per_day: input.requests_per_day ?? null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: null,
    }),
    data_characteristics: Object.freeze({
      freshness: input.freshness,
      geographic_scope: Object.freeze([...input.geographic_scope]),
      historical_data: true,
      realtime: input.freshness === 'realtime',
      data_format: 'json',
      notes: null,
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['world', 'exchange', 'financial_agent', 'grow']),
      canonical_provider_interface: 'FxReferenceProvider',
      priority: input.priority,
      launch_tier: input.launch_tier,
      authority_class: input.authority_class,
      integration_state: 'adapter_implemented',
      existing_adapter: `packages/payments/src/fx-reference/adapters/index.ts`,
    }),
    verification: Object.freeze({
      status: input.verification_status,
      verified_against_official_docs: input.verification_status === 'verified',
      last_verified: '2026-08-30',
      notes: 'Wave 2 Prompt 9 fixture-backed adapter.',
    }),
  });
}

export const FX_REFERENCE_CATALOG_ENTRIES: readonly CatalogEntry[] = Object.freeze([
  fxCatalogEntry({
    provider_id: 'bank-of-russia',
    name: 'Bank of Russia FX Reference',
    short_name: 'CBR FX',
    description: 'Official daily foreign-exchange reference rates published by the Central Bank of Russia.',
    base_url: 'https://www.cbr-xml-daily.ru',
    documentation_url: 'https://www.cbr.ru/development/SXML/',
    capabilities: Object.freeze(['fx_rates', 'central_bank_fx', 'currency_conversion']),
    authority_class: 'authoritative_official',
    launch_tier: 'production_candidate',
    priority: 'critical',
    freshness: 'daily',
    geographic_scope: Object.freeze(['RU', 'GLOBAL']),
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_day: 1000,
  }),
  fxCatalogEntry({
    provider_id: 'national-bank-poland',
    name: 'National Bank of Poland FX Tables',
    short_name: 'NBP FX',
    description: 'Official NBP table A foreign exchange reference rates.',
    base_url: 'https://api.nbp.pl',
    documentation_url: 'https://api.nbp.pl/en.html',
    capabilities: Object.freeze(['fx_rates', 'central_bank_fx']),
    authority_class: 'authoritative_official',
    launch_tier: 'production_candidate',
    priority: 'high',
    freshness: 'daily',
    geographic_scope: Object.freeze(['PL', 'EU']),
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_hour: 120,
  }),
  fxCatalogEntry({
    provider_id: 'frankfurter',
    name: 'Frankfurter',
    short_name: 'Frankfurter',
    description: 'Free ECB-backed foreign exchange reference rates without API keys.',
    base_url: 'https://api.frankfurter.app',
    documentation_url: 'https://www.frankfurter.app/docs/',
    capabilities: Object.freeze(['fx_rates', 'foreign_exchange', 'currency_conversion']),
    authority_class: 'reference_data',
    launch_tier: 'production_candidate',
    priority: 'high',
    freshness: 'daily',
    geographic_scope: Object.freeze(['EU', 'GLOBAL']),
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_hour: 1000,
  }),
  fxCatalogEntry({
    provider_id: 'currency-api',
    name: 'Currency API',
    short_name: 'CurrencyAPI',
    description: 'Free-tier currency conversion and FX reference feed.',
    base_url: 'https://api.currencyapi.com',
    documentation_url: 'https://currencyapi.com/docs',
    capabilities: Object.freeze(['fx_rates', 'currency_conversion']),
    authority_class: 'reference_data',
    launch_tier: 'secondary_source',
    priority: 'medium',
    freshness: 'realtime',
    geographic_scope: Object.freeze(['GLOBAL']),
    access_status: 'free_tier',
    verification_status: 'partially_verified',
    auth_type: 'api_key',
    environment_variable: 'CURRENCY_API_KEY',
    requests_per_hour: 300,
  }),
  fxCatalogEntry({
    provider_id: 'exchangerate-dev',
    name: 'ExchangeRate.dev',
    short_name: 'ExchangeRate.dev',
    description: 'Free foreign exchange rates API with historical support.',
    base_url: 'https://api.exchangerate.dev',
    documentation_url: 'https://exchangerate.dev/docs',
    capabilities: Object.freeze(['fx_rates', 'foreign_exchange']),
    authority_class: 'reference_data',
    launch_tier: 'secondary_source',
    priority: 'medium',
    freshness: 'realtime',
    geographic_scope: Object.freeze(['GLOBAL']),
    access_status: 'free_tier',
    verification_status: 'partially_verified',
    requests_per_hour: 250,
  }),
  fxCatalogEntry({
    provider_id: 'exchangerate-host',
    name: 'ExchangeRate.host',
    short_name: 'ExchangeRate.host',
    description: 'Free FX conversion and reference rates with fallback usage.',
    base_url: 'https://api.exchangerate.host',
    documentation_url: 'https://exchangerate.host/documentation',
    capabilities: Object.freeze(['fx_rates', 'currency_conversion']),
    authority_class: 'reference_data',
    launch_tier: 'fallback_source',
    priority: 'low',
    freshness: 'realtime',
    geographic_scope: Object.freeze(['GLOBAL']),
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_hour: 100,
  }),
  fxCatalogEntry({
    provider_id: 'economia-awesome',
    name: 'Economia.AwesomeAPI',
    short_name: 'Economia',
    description: 'Brazilian open economics API including foreign exchange reference quotes.',
    base_url: 'https://economia.awesomeapi.com.br',
    documentation_url: 'https://docs.awesomeapi.com.br/api-de-moedas',
    capabilities: Object.freeze(['fx_rates', 'foreign_exchange']),
    authority_class: 'reference_data',
    launch_tier: 'secondary_source',
    priority: 'medium',
    freshness: 'realtime',
    geographic_scope: Object.freeze(['BR', 'GLOBAL']),
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_hour: 100,
  }),
]);

export const FX_REFERENCE_BLOCKED_CATALOG_ENTRY: CatalogEntry = fxCatalogEntry({
  provider_id: 'currencyapi-com',
  name: 'CurrencyAPI.com (blocked)',
  short_name: 'CurrencyAPI.com',
  description: 'Blocked pending commercial and legal review. Not activated.',
  base_url: 'https://api.currencyapi.com',
  documentation_url: 'https://currencyapi.com/docs',
  capabilities: Object.freeze(['fx_rates']),
  authority_class: 'reference_data',
  launch_tier: 'blocked_pending_review',
  priority: 'low',
  freshness: 'realtime',
  geographic_scope: Object.freeze(['GLOBAL']),
  access_status: 'free_tier',
  verification_status: 'unverified',
  auth_type: 'api_key',
  environment_variable: 'CURRENCYAPI_COM_KEY',
});
