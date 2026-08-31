/**
 * Catalog-backed market reference adapter factory.
 *
 * When the Wave 0 catalog is populated, adapters are created per eligible entry.
 * Until then, only the simulation fallback adapter is available.
 */

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import type { MarketReferenceProvider } from '../provider.ts';
import { providerPriorityOf, type MarketReferenceCatalogMatch } from '../registry.ts';
import { SimulationMarketReferenceAdapter } from './simulation.ts';

export type MarketReferenceAdapterFactory = {
  readonly catalogProviders: readonly MarketReferenceCatalogMatch[];
  createFromCatalog(entry: CatalogProviderEntry): MarketReferenceProvider | null;
  createSimulationFallback(): MarketReferenceProvider;
};

export function createMarketReferenceAdapterFactory(
  catalogMatches: readonly MarketReferenceCatalogMatch[],
): MarketReferenceAdapterFactory {
  return Object.freeze({
    catalogProviders: catalogMatches,
    createFromCatalog(entry: CatalogProviderEntry): MarketReferenceProvider | null {
      const match = catalogMatches.find((row) => row.entry.provider_id === entry.provider_id);
      if (!match) {
        return null;
      }
      return createCatalogBackedAdapter(entry, match.matchedCapabilities, providerPriorityOf(entry));
    },
    createSimulationFallback(): MarketReferenceProvider {
      return new SimulationMarketReferenceAdapter();
    },
  });
}

function createCatalogBackedAdapter(
  entry: CatalogProviderEntry,
  capabilities: readonly string[],
  priority: 'primary' | 'secondary' | 'fallback',
): MarketReferenceProvider {
  const simulation = new SimulationMarketReferenceAdapter();
  return Object.freeze({
    providerId: entry.provider_id,
    capabilities: Object.freeze([...capabilities]) as MarketReferenceProvider['capabilities'],
    priority,
    productionAuthorized: false as const,
    liveProviderConnected: false as const,
    health: (nowUtc) => ({
      ...simulation.health(nowUtc),
      providerId: entry.provider_id,
      message: 'catalog adapter uses simulation transport until live binding is authorized',
    }),
    supportsCapability: (capability) => capabilities.includes(capability),
    getQuote: (assetId, nowUtc) => simulation.getQuote(assetId, nowUtc).then((result) => remapProvider(result, entry.provider_id)),
    getQuotes: (assetIds, nowUtc) => simulation.getQuotes(assetIds, nowUtc).then((result) => remapProvider(result, entry.provider_id)),
    getHistory: (assetId, interval, range, nowUtc) =>
      simulation.getHistory(assetId, interval, range, nowUtc).then((result) => remapProvider(result, entry.provider_id)),
    getCommodityPrice: (commodity, nowUtc) =>
      simulation.getCommodityPrice(commodity, nowUtc).then((result) => remapProvider(result, entry.provider_id)),
    getCommodityHistory: (commodity, interval, range, nowUtc) =>
      simulation.getCommodityHistory(commodity, interval, range, nowUtc).then((result) => remapProvider(result, entry.provider_id)),
    searchAssets: (query, nowUtc) => simulation.searchAssets(query, nowUtc).then((result) => remapProvider(result, entry.provider_id)),
    getAssetMetadata: (assetId, nowUtc) =>
      simulation.getAssetMetadata(assetId, nowUtc).then((result) => remapProvider(result, entry.provider_id)),
  });
}

function remapProvider<T>(result: import('../types.ts').MarketReferenceResult<T>, providerId: string) {
  if (!result.ok) {
    return { ...result, providerId: result.providerId ?? providerId };
  }
  return {
    ...result,
    value: result.value,
    fallbackProviderId: result.fallbackProviderId,
  };
}
