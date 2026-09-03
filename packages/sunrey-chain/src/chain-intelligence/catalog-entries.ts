/**
 * Wave 3 Prompt 13 — blockchain network intelligence catalog entries.
 *
 * Partial population from the Wave 0 catalog framework. Providers are real
 * documented free/public APIs; adapters use fixture transports in simulation.
 */

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';

export const CHAIN_INTELLIGENCE_CATALOG_PROVIDER_IDS = [
  'mempool-space',
  'blockchain-com',
  'blockscout',
  'btcglobe',
] as const;
export type ChainIntelligenceCatalogProviderId = (typeof CHAIN_INTELLIGENCE_CATALOG_PROVIDER_IDS)[number];

function chainProvider(
  overrides: Partial<CatalogProviderEntry> & Pick<CatalogProviderEntry, 'provider_id' | 'name' | 'short_name' | 'description'>,
): CatalogProviderEntry {
  return Object.freeze({
    primary_category: 'blockchain',
    secondary_categories: Object.freeze(['cryptocurrency']),
    capabilities: Object.freeze(['blockchain_intelligence', 'bitcoin_network', 'mempool', 'network_statistics']),
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
      documented: true,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: 'Respect free-tier quotas; simulation uses fixtures only.',
    }),
    data_characteristics: Object.freeze({
      freshness: 'realtime',
      geographic_scope: Object.freeze(['GLOBAL']),
      historical_data: true,
      realtime: true,
      data_format: 'json',
      notes: null,
    }),
    sunrey: Object.freeze({
      domain: ['blockchain_intelligence', 'world', 'exchange', 'financial_agent'] as const,
      canonical_provider_interface: 'BlockchainIntelligenceProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'reference_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/sunrey-chain/src/chain-intelligence/adapters/index.ts',
    }),
    verification: Object.freeze({
      status: 'verified' as const,
      verified_against_official_docs: true,
      last_verified: '2026-08-30',
      notes: 'Wave 3 Prompt 13 blockchain network intelligence subset.',
    }),
    ...overrides,
  });
}

export const CHAIN_INTELLIGENCE_CATALOG_ENTRIES: readonly CatalogProviderEntry[] = Object.freeze([
  chainProvider({
    provider_id: 'mempool-space',
    name: 'Mempool.space',
    short_name: 'Mempool',
    description:
      'Open-source Bitcoin block explorer and mempool API providing blocks, transactions, fees, hashrate, and network statistics.',
    capabilities: Object.freeze([
      'blockchain_intelligence',
      'bitcoin_network',
      'mempool',
      'block_explorer',
      'network_statistics',
      'onchain_reference',
    ]),
    endpoints: Object.freeze({
      base_url: 'https://mempool.space/api',
      api_version: 'v1',
      documentation_url: 'https://mempool.space/docs/api/rest',
      status_url: 'https://mempool.space/status',
    }),
    sunrey: Object.freeze({
      domain: ['blockchain_intelligence', 'world', 'exchange', 'financial_agent'] as const,
      canonical_provider_interface: 'BlockchainIntelligenceProvider',
      priority: 'critical',
      launch_tier: 'production_candidate',
      authority_class: 'community_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/sunrey-chain/src/chain-intelligence/adapters/mempool-space.ts',
    }),
  }),
  chainProvider({
    provider_id: 'blockchain-com',
    name: 'Blockchain.com Explorer API',
    short_name: 'Blockchain.com',
    description:
      'Public Bitcoin blockchain data API for blocks, transactions, charts, and network statistics.',
    capabilities: Object.freeze([
      'blockchain_intelligence',
      'bitcoin_network',
      'block_explorer',
      'network_statistics',
      'onchain_reference',
    ]),
    endpoints: Object.freeze({
      base_url: 'https://blockchain.info',
      api_version: 'v1',
      documentation_url: 'https://www.blockchain.com/explorer/api',
      status_url: null,
    }),
    sunrey: Object.freeze({
      domain: ['blockchain_intelligence', 'world', 'exchange', 'financial_agent'] as const,
      canonical_provider_interface: 'BlockchainIntelligenceProvider',
      priority: 'high',
      launch_tier: 'secondary_source',
      authority_class: 'reference_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/sunrey-chain/src/chain-intelligence/adapters/blockchain-com.ts',
    }),
  }),
  chainProvider({
    provider_id: 'blockscout',
    name: 'Blockscout',
    short_name: 'Blockscout',
    description:
      'Open-source multi-chain block explorer API for Ethereum and EVM networks with blocks, transactions, and address lookups.',
    capabilities: Object.freeze([
      'blockchain_intelligence',
      'block_explorer',
      'chain_intelligence',
      'onchain_reference',
    ]),
    endpoints: Object.freeze({
      base_url: 'https://eth.blockscout.com/api',
      api_version: 'v2',
      documentation_url: 'https://docs.blockscout.com/for-users/api',
      status_url: null,
    }),
    sunrey: Object.freeze({
      domain: ['blockchain_intelligence', 'world', 'financial_agent'] as const,
      canonical_provider_interface: 'BlockchainIntelligenceProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'community_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/sunrey-chain/src/chain-intelligence/adapters/blockscout.ts',
    }),
  }),
  chainProvider({
    provider_id: 'btcglobe',
    name: 'BTCGlobe',
    short_name: 'BTCGlobe',
    description:
      'Bitcoin network statistics and reference data including hashrate, difficulty, and mempool conditions.',
    capabilities: Object.freeze([
      'blockchain_intelligence',
      'bitcoin_network',
      'network_statistics',
      'mempool',
    ]),
    endpoints: Object.freeze({
      base_url: 'https://api.btcglobe.com',
      api_version: 'v1',
      documentation_url: 'https://btcglobe.com/api',
      status_url: null,
    }),
    sunrey: Object.freeze({
      domain: ['blockchain_intelligence', 'world'] as const,
      canonical_provider_interface: 'BlockchainIntelligenceProvider',
      priority: 'medium',
      launch_tier: 'fallback_source',
      authority_class: 'derived_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/sunrey-chain/src/chain-intelligence/adapters/btcglobe.ts',
    }),
    verification: Object.freeze({
      status: 'partially_verified',
      verified_against_official_docs: false,
      last_verified: '2026-08-30',
      notes: 'Fallback network statistics source; fixture-backed in simulation.',
    }),
  }),
]);
