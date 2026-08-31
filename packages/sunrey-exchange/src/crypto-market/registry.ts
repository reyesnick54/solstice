/**
 * Catalog-driven crypto market provider discovery.
 */

import {
  listCatalogByCapability,
  loadCatalogFromYaml,
  type CatalogIndex,
} from '../../../provider-sdk/src/catalog/loader.ts';
import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import { CRYPTO_MARKET_CATALOG_PROVIDER_IDS } from './catalog-entries.ts';
import type { CryptoMarketCapability } from './types.ts';

export const CRYPTO_MARKET_SCOPE_CAPABILITIES: readonly CryptoMarketCapability[] = Object.freeze([
  'crypto_prices',
  'crypto_market_data',
  'crypto_assets',
  'crypto_market_history',
  'crypto_market_cap',
  'crypto_exchange_reference',
  'crypto_metadata',
]);

export type CryptoMarketCatalogMatch = {
  readonly entry: CatalogProviderEntry;
  readonly matchedCapabilities: readonly string[];
};

export function isCryptoMarketCategory(entry: CatalogProviderEntry): boolean {
  if (entry.primary_category === 'cryptocurrency') {
    return true;
  }
  return (entry.secondary_categories ?? []).includes('cryptocurrency');
}

export function cryptoMarketCapabilitiesOf(entry: CatalogProviderEntry): readonly string[] {
  return entry.capabilities.filter((capability) =>
    (CRYPTO_MARKET_SCOPE_CAPABILITIES as readonly string[]).includes(capability),
  );
}

export function listEligibleCryptoMarketProviders(index: CatalogIndex): readonly CryptoMarketCatalogMatch[] {
  const matches: CryptoMarketCatalogMatch[] = [];
  const seen = new Set<string>();
  for (const capability of CRYPTO_MARKET_SCOPE_CAPABILITIES) {
    for (const entry of listCatalogByCapability(index, capability)) {
      if (!isCryptoMarketCategory(entry) || seen.has(entry.provider_id)) {
        continue;
      }
      const matched = cryptoMarketCapabilitiesOf(entry);
      if (matched.length === 0) {
        continue;
      }
      seen.add(entry.provider_id);
      matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
    }
  }
  for (const entry of index.catalog.providers) {
    if (!isCryptoMarketCategory(entry) || seen.has(entry.provider_id)) {
      continue;
    }
    const matched = cryptoMarketCapabilitiesOf(entry);
    if (matched.length === 0) {
      continue;
    }
    seen.add(entry.provider_id);
    matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
  }
  return Object.freeze(matches);
}

export function loadCryptoMarketCatalog(index?: CatalogIndex): readonly CryptoMarketCatalogMatch[] {
  const catalog = index ?? loadCatalogFromYaml();
  return listEligibleCryptoMarketProviders(catalog);
}

export function providerPriorityOf(entry: CatalogProviderEntry): 'primary' | 'secondary' | 'fallback' {
  if (entry.sunrey.launch_tier === 'blocked_pending_review') {
    return 'fallback';
  }
  if (entry.sunrey.priority === 'critical' || entry.sunrey.priority === 'high') {
    return entry.sunrey.launch_tier === 'production_candidate' ? 'primary' : 'secondary';
  }
  if (entry.sunrey.launch_tier === 'fallback_source' || entry.sunrey.launch_tier === 'research_only') {
    return 'fallback';
  }
  return 'secondary';
}

export function isKnownCryptoProviderId(providerId: string): boolean {
  return (CRYPTO_MARKET_CATALOG_PROVIDER_IDS as readonly string[]).includes(providerId);
}

export function isProductionCandidate(entry: CatalogProviderEntry): boolean {
  return entry.sunrey.launch_tier === 'production_candidate' && entry.verification.status === 'verified';
}

export function isBlockedProvider(entry: CatalogProviderEntry): boolean {
  return entry.sunrey.launch_tier === 'blocked_pending_review' || entry.verification.status === 'unavailable';
}
