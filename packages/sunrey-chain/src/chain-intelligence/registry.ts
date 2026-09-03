/**
 * Chain intelligence adapter factory and registry.
 */

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import {
  listCatalogByCapability,
  loadCatalogFromYaml,
  type CatalogIndex,
} from '../../../provider-sdk/src/catalog/loader.ts';
import { CHAIN_INTELLIGENCE_CATALOG_ENTRIES } from './catalog-entries.ts';
import type { BlockchainIntelligenceProvider } from './provider.ts';
import { createBlockchainComAdapter } from './adapters/blockchain-com.ts';
import { createBlockscoutAdapter } from './adapters/blockscout.ts';
import { createBtcGlobeAdapter } from './adapters/btcglobe.ts';
import { createMempoolSpaceAdapter } from './adapters/mempool-space.ts';

export const CHAIN_INTELLIGENCE_CATEGORIES = Object.freeze(['blockchain', 'cryptocurrency']);

export const CHAIN_INTELLIGENCE_CAPABILITIES = Object.freeze([
  'blockchain_intelligence',
  'bitcoin_network',
  'mempool',
  'block_explorer',
  'chain_intelligence',
  'network_statistics',
  'onchain_reference',
]);

export type ChainIntelligenceCatalogMatch = {
  readonly entry: CatalogProviderEntry;
  readonly matchedCapabilities: readonly string[];
};

export function isChainIntelligenceCategory(entry: CatalogProviderEntry): boolean {
  if ((CHAIN_INTELLIGENCE_CATEGORIES as readonly string[]).includes(entry.primary_category)) {
    return true;
  }
  return (entry.secondary_categories ?? []).some((c) =>
    (CHAIN_INTELLIGENCE_CATEGORIES as readonly string[]).includes(c),
  );
}

export function chainIntelligenceCapabilitiesOf(entry: CatalogProviderEntry): readonly string[] {
  return entry.capabilities.filter((cap) => (CHAIN_INTELLIGENCE_CAPABILITIES as readonly string[]).includes(cap));
}

export function listEligibleChainIntelligenceProviders(index: CatalogIndex): readonly ChainIntelligenceCatalogMatch[] {
  const matches: ChainIntelligenceCatalogMatch[] = [];
  const seen = new Set<string>();
  for (const entry of index.catalog.providers) {
    if (!isChainIntelligenceCategory(entry) || seen.has(entry.provider_id)) continue;
    const matched = chainIntelligenceCapabilitiesOf(entry);
    if (matched.length === 0) continue;
    seen.add(entry.provider_id);
    matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
  }
  for (const capability of CHAIN_INTELLIGENCE_CAPABILITIES) {
    for (const entry of listCatalogByCapability(index, capability)) {
      if (!isChainIntelligenceCategory(entry) || seen.has(entry.provider_id)) continue;
      const matched = chainIntelligenceCapabilitiesOf(entry);
      if (matched.length === 0) continue;
      seen.add(entry.provider_id);
      matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
    }
  }
  for (const entry of CHAIN_INTELLIGENCE_CATALOG_ENTRIES) {
    if (seen.has(entry.provider_id)) continue;
    const matched = chainIntelligenceCapabilitiesOf(entry);
    if (matched.length === 0) continue;
    seen.add(entry.provider_id);
    matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
  }
  return Object.freeze(matches);
}

export function loadChainIntelligenceCatalog(index?: CatalogIndex): readonly ChainIntelligenceCatalogMatch[] {
  let catalogIndex: CatalogIndex;
  try {
    catalogIndex = index ?? loadCatalogFromYaml();
  } catch {
    catalogIndex = {
      catalog: Object.freeze({
        schema_version: '1.0.0',
        catalog_id: 'sunrey-free-api-catalog',
        expected_provider_count: 126,
        population_status: 'partial',
        providers: Object.freeze([...CHAIN_INTELLIGENCE_CATALOG_ENTRIES]),
      }),
      byId: new Map(CHAIN_INTELLIGENCE_CATALOG_ENTRIES.map((e) => [e.provider_id, e])),
    };
  }
  return listEligibleChainIntelligenceProviders(catalogIndex);
}

export function providerPriorityOf(entry: CatalogProviderEntry): 'primary' | 'secondary' | 'fallback' {
  if (entry.sunrey.priority === 'critical' || entry.provider_id === 'mempool-space') return 'primary';
  if (entry.sunrey.launch_tier === 'fallback_source' || entry.provider_id === 'btcglobe') return 'fallback';
  return 'secondary';
}

export type ChainIntelligenceAdapterFactory = {
  createFromCatalog(entry: CatalogProviderEntry): BlockchainIntelligenceProvider | null;
  createAll(): readonly BlockchainIntelligenceProvider[];
};

export function createChainIntelligenceAdapterFactory(
  matches?: readonly ChainIntelligenceCatalogMatch[],
): ChainIntelligenceAdapterFactory {
  const catalogMatches = matches ?? loadChainIntelligenceCatalog();
  const adapterById: Record<string, () => BlockchainIntelligenceProvider> = {
    'mempool-space': createMempoolSpaceAdapter,
    'blockchain-com': createBlockchainComAdapter,
    blockscout: createBlockscoutAdapter,
    btcglobe: createBtcGlobeAdapter,
  };

  return Object.freeze({
    createFromCatalog(entry: CatalogProviderEntry): BlockchainIntelligenceProvider | null {
      const factory = adapterById[entry.provider_id];
      if (!factory) return null;
      const adapter = factory();
      return adapter;
    },
    createAll(): readonly BlockchainIntelligenceProvider[] {
      const providers: BlockchainIntelligenceProvider[] = [];
      const seen = new Set<string>();
      for (const match of catalogMatches) {
        if (seen.has(match.entry.provider_id)) continue;
        const adapter = adapterById[match.entry.provider_id]?.();
        if (!adapter) continue;
        seen.add(match.entry.provider_id);
        providers.push(adapter);
      }
      for (const id of Object.keys(adapterById)) {
        if (seen.has(id)) continue;
        providers.push(adapterById[id]!());
      }
      return Object.freeze(providers);
    },
  });
}
