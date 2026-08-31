/**
 * Wave 3 Prompt 12 crypto market reference provider catalog entries.
 *
 * Providers sourced from Wave 0 catalog scope and WAVE1 observability metadata.
 * Only real, documented free/public crypto market APIs are included.
 */

type CatalogEntry = Record<string, unknown>;

function cryptoCatalogEntry(input: {
  readonly provider_id: string;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly base_url: string;
  readonly documentation_url: string;
  readonly capabilities: readonly string[];
  readonly launch_tier: 'production_candidate' | 'secondary_source' | 'fallback_source' | 'blocked_pending_review';
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly access_status: 'verified_free' | 'free_tier';
  readonly verification_status: 'verified' | 'partially_verified' | 'unverified';
  readonly auth_type?: 'none' | 'api_key';
  readonly environment_variable?: string | null;
  readonly commercial_use?: 'verified_allowed' | 'restricted' | 'unclear' | 'unknown';
  readonly redistribution?: 'allowed' | 'attribution_required' | 'restricted' | 'prohibited' | 'unclear';
  readonly requests_per_minute?: number | null;
  readonly requests_per_day?: number | null;
  readonly realtime?: boolean;
  readonly blocked?: boolean;
}): CatalogEntry {
  return Object.freeze({
    provider_id: input.provider_id,
    name: input.name,
    short_name: input.short_name,
    description: input.description,
    primary_category: 'cryptocurrency',
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
      status: input.commercial_use ?? 'verified_allowed',
      notes: null,
    }),
    redistribution: Object.freeze({
      status: input.redistribution ?? 'attribution_required',
      notes: null,
    }),
    rate_limits: Object.freeze({
      documented: input.requests_per_minute !== null || input.requests_per_day !== null,
      requests_per_second: null,
      requests_per_minute: input.requests_per_minute ?? null,
      requests_per_hour: null,
      requests_per_day: input.requests_per_day ?? null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: null,
    }),
    data_characteristics: Object.freeze({
      freshness: input.realtime ? 'realtime' : 'delayed',
      geographic_scope: Object.freeze(['global']),
      historical_data: true,
      realtime: input.realtime ?? false,
      data_format: 'json',
      notes: null,
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['exchange', 'world', 'grow', 'financial_agent', 'blockchain_intelligence', 'moonrey']),
      canonical_provider_interface: 'CryptoMarketReferenceProvider',
      priority: input.priority,
      launch_tier: input.blocked ? 'blocked_pending_review' : input.launch_tier,
      authority_class: 'reference_data',
      integration_state: input.blocked ? 'catalog_only' : 'adapter_implemented',
      existing_adapter: input.blocked
        ? null
        : 'packages/sunrey-exchange/src/crypto-market/adapters/index.ts',
    }),
    verification: Object.freeze({
      status: input.verification_status,
      verified_against_official_docs: input.verification_status === 'verified',
      last_verified: '2026-08-30',
      notes: input.blocked ? 'Blocked pending credential and commercial review.' : 'Wave 3 Prompt 12 fixture-backed adapter.',
    }),
  });
}

export const CRYPTO_MARKET_CATALOG_PROVIDER_IDS = Object.freeze([
  'coingecko',
  'coincap',
  'coinpaprika',
  'coinlore',
  'cryptocompare',
  'coinmarketcap',
]);

export type CryptoMarketCatalogProviderId = (typeof CRYPTO_MARKET_CATALOG_PROVIDER_IDS)[number];

export const CRYPTO_MARKET_CATALOG_ENTRIES: readonly CatalogEntry[] = Object.freeze([
  cryptoCatalogEntry({
    provider_id: 'coingecko',
    name: 'CoinGecko',
    short_name: 'CoinGecko',
    description:
      'CoinGecko public API providing aggregated cryptocurrency prices, capitalization metrics, volume, and historical data.',
    base_url: 'https://api.coingecko.com',
    documentation_url: 'https://www.coingecko.com/en/api/documentation',
    capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history', 'crypto_metadata'],
    launch_tier: 'production_candidate',
    priority: 'high',
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_minute: 30,
    realtime: false,
  }),
  cryptoCatalogEntry({
    provider_id: 'coincap',
    name: 'CoinCap',
    short_name: 'CoinCap',
    description: 'CoinCap public API providing real-time cryptocurrency prices and market data.',
    base_url: 'https://api.coincap.io',
    documentation_url: 'https://docs.coincap.io/',
    capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history'],
    launch_tier: 'secondary_source',
    priority: 'high',
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_minute: 200,
    realtime: true,
  }),
  cryptoCatalogEntry({
    provider_id: 'coinpaprika',
    name: 'CoinPaprika',
    short_name: 'Paprika',
    description: 'CoinPaprika public API providing cryptocurrency market data, tickers, and historical OHLCV.',
    base_url: 'https://api.coinpaprika.com',
    documentation_url: 'https://api.coinpaprika.com/',
    capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_market_history', 'crypto_metadata'],
    launch_tier: 'secondary_source',
    priority: 'medium',
    access_status: 'verified_free',
    verification_status: 'verified',
    requests_per_day: 25_000,
    realtime: false,
  }),
  cryptoCatalogEntry({
    provider_id: 'coinlore',
    name: 'CoinLore',
    short_name: 'CoinLore',
    description: 'CoinLore public API providing cryptocurrency prices, capitalization metrics, and global market statistics.',
    base_url: 'https://api.coinlore.net',
    documentation_url: 'https://www.coinlore.com/cryptocurrency-data-api',
    capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap'],
    launch_tier: 'fallback_source',
    priority: 'low',
    access_status: 'verified_free',
    verification_status: 'partially_verified',
    realtime: false,
  }),
  cryptoCatalogEntry({
    provider_id: 'cryptocompare',
    name: 'CryptoCompare',
    short_name: 'CryptoCompare',
    description:
      'CryptoCompare public API providing cryptocurrency prices, historical data, and exchange-specific quotes.',
    base_url: 'https://min-api.cryptocompare.com',
    documentation_url: 'https://min-api.cryptocompare.com/documentation',
    capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_history', 'crypto_exchange_reference'],
    launch_tier: 'secondary_source',
    priority: 'medium',
    access_status: 'free_tier',
    verification_status: 'verified',
    auth_type: 'api_key',
    environment_variable: 'CRYPTOCOMPARE_API_KEY',
    commercial_use: 'restricted',
    redistribution: 'restricted',
    requests_per_day: 100_000,
    realtime: true,
  }),
  cryptoCatalogEntry({
    provider_id: 'coinmarketcap',
    name: 'CoinMarketCap',
    short_name: 'CMC',
    description: 'CoinMarketCap API providing cryptocurrency quotes, capitalization metrics, and metadata. Requires API key.',
    base_url: 'https://pro-api.coinmarketcap.com',
    documentation_url: 'https://coinmarketcap.com/api/documentation/v1/',
    capabilities: ['crypto_prices', 'crypto_market_data', 'crypto_market_cap', 'crypto_metadata'],
    launch_tier: 'blocked_pending_review',
    priority: 'medium',
    access_status: 'free_tier',
    verification_status: 'partially_verified',
    auth_type: 'api_key',
    environment_variable: 'COINMARKETCAP_API_KEY',
    commercial_use: 'restricted',
    redistribution: 'prohibited',
    requests_per_day: 10_000,
    blocked: true,
  }),
]);
