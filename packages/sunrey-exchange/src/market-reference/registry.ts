/**
 * Catalog-driven market reference provider discovery.
 *
 * Only providers present in config/providers/free-api-catalog.yaml with
 * eligible categories/capabilities are registered.
 */

import {
  listCatalogByCapability,
  loadCatalogFromYaml,
  type CatalogIndex,
} from '../../../provider-sdk/src/catalog/loader.ts';
import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import type { MarketReferenceCapability } from './types.ts';

export const MARKET_REFERENCE_CATEGORIES = Object.freeze([
  'markets',
  'securities',
  'commodities',
  'natural_resources',
  'cryptocurrency',
]);

export const MARKET_REFERENCE_SCOPE_CAPABILITIES: readonly MarketReferenceCapability[] = Object.freeze([
  'market_prices',
  'securities',
  'commodity_prices',
  'resource_prices',
  'asset_metadata',
  'market_history',
  'metals',
]);

export type MarketReferenceCatalogMatch = {
  readonly entry: CatalogProviderEntry;
  readonly matchedCapabilities: readonly string[];
};

export function isMarketReferenceCategory(entry: CatalogProviderEntry): boolean {
  if ((MARKET_REFERENCE_CATEGORIES as readonly string[]).includes(entry.primary_category)) {
    return true;
  }
  return (entry.secondary_categories ?? []).some((category) =>
    (MARKET_REFERENCE_CATEGORIES as readonly string[]).includes(category),
  );
}

export function marketReferenceCapabilitiesOf(entry: CatalogProviderEntry): readonly string[] {
  return entry.capabilities.filter((capability) =>
    (MARKET_REFERENCE_SCOPE_CAPABILITIES as readonly string[]).includes(capability as MarketReferenceCapability) ||
    capability === 'crypto_prices' ||
    capability === 'economic_indicators',
  );
}

export function listEligibleMarketReferenceProviders(index: CatalogIndex): readonly MarketReferenceCatalogMatch[] {
  const matches: MarketReferenceCatalogMatch[] = [];
  const seen = new Set<string>();
  for (const capability of MARKET_REFERENCE_SCOPE_CAPABILITIES) {
    for (const entry of listCatalogByCapability(index, capability)) {
      if (!isMarketReferenceCategory(entry) || seen.has(entry.provider_id)) {
        continue;
      }
      const matched = marketReferenceCapabilitiesOf(entry);
      if (matched.length === 0) {
        continue;
      }
      seen.add(entry.provider_id);
      matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
    }
  }
  for (const entry of index.catalog.providers) {
    if (!isMarketReferenceCategory(entry) || seen.has(entry.provider_id)) {
      continue;
    }
    const matched = marketReferenceCapabilitiesOf(entry);
    if (matched.length === 0) {
      continue;
    }
    seen.add(entry.provider_id);
    matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
  }
  return Object.freeze(matches);
}

export function loadMarketReferenceCatalog(index?: CatalogIndex): readonly MarketReferenceCatalogMatch[] {
  const catalog = index ?? loadCatalogFromYaml();
  return listEligibleMarketReferenceProviders(catalog);
}

export function providerPriorityOf(
  entry: CatalogProviderEntry,
): 'primary' | 'secondary' | 'fallback' {
  if (entry.sunrey.priority === 'critical' || entry.sunrey.priority === 'high') {
    return 'primary';
  }
  if (entry.sunrey.launch_tier === 'fallback_source' || entry.sunrey.launch_tier === 'research_only') {
    return 'fallback';
  }
  return 'secondary';
}
