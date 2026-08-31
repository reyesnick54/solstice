/**
 * Environmental oracle adapter factory and registry.
 */

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';
import {
  listCatalogByCapability,
  loadCatalogFromYaml,
  type CatalogIndex,
} from '../../../provider-sdk/src/catalog/loader.ts';
import { ENVIRONMENTAL_CATALOG_ENTRIES } from './catalog-entries.ts';
import type { EnvironmentalOracleProvider } from './provider.ts';
import { createAllEnvironmentalAdapters, createEnvironmentalAdapter, ENVIRONMENTAL_ADAPTER_IDS } from './adapters/index.ts';

export const ENVIRONMENTAL_CATEGORIES = Object.freeze(['weather', 'water', 'environmental', 'aviation']);

export const ENVIRONMENTAL_CAPABILITIES = Object.freeze([
  'weather',
  'precipitation',
  'water_data',
  'air_quality',
  'earthquake',
  'wildfire',
  'environmental',
  'environmental_risk',
  'climate',
]);

export type EnvironmentalCatalogMatch = {
  readonly entry: CatalogProviderEntry;
  readonly matchedCapabilities: readonly string[];
};

export function isEnvironmentalCategory(entry: CatalogProviderEntry): boolean {
  if ((ENVIRONMENTAL_CATEGORIES as readonly string[]).includes(entry.primary_category)) {
    return true;
  }
  return (entry.secondary_categories ?? []).some((c) =>
    (ENVIRONMENTAL_CATEGORIES as readonly string[]).includes(c),
  );
}

export function environmentalCapabilitiesOf(entry: CatalogProviderEntry): readonly string[] {
  return entry.capabilities.filter((cap) => (ENVIRONMENTAL_CAPABILITIES as readonly string[]).includes(cap));
}

export function listEligibleEnvironmentalProviders(index: CatalogIndex): readonly EnvironmentalCatalogMatch[] {
  const matches: EnvironmentalCatalogMatch[] = [];
  const seen = new Set<string>();
  for (const entry of index.catalog.providers) {
    if (!isEnvironmentalCategory(entry) || seen.has(entry.provider_id)) continue;
    const matched = environmentalCapabilitiesOf(entry);
    if (matched.length === 0) continue;
    seen.add(entry.provider_id);
    matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
  }
  for (const capability of ENVIRONMENTAL_CAPABILITIES) {
    for (const entry of listCatalogByCapability(index, capability)) {
      if (!isEnvironmentalCategory(entry) || seen.has(entry.provider_id)) continue;
      const matched = environmentalCapabilitiesOf(entry);
      if (matched.length === 0) continue;
      seen.add(entry.provider_id);
      matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
    }
  }
  for (const entry of ENVIRONMENTAL_CATALOG_ENTRIES) {
    if (seen.has(entry.provider_id)) continue;
    const matched = environmentalCapabilitiesOf(entry);
    if (matched.length === 0) continue;
    seen.add(entry.provider_id);
    matches.push(Object.freeze({ entry, matchedCapabilities: Object.freeze([...matched]) }));
  }
  return Object.freeze(matches);
}

export function loadEnvironmentalCatalog(index?: CatalogIndex): readonly EnvironmentalCatalogMatch[] {
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
        providers: Object.freeze([...ENVIRONMENTAL_CATALOG_ENTRIES]),
      }),
      byId: new Map(ENVIRONMENTAL_CATALOG_ENTRIES.map((e) => [e.provider_id, e])),
      byCapability: new Map(),
      byDomain: new Map(),
    };
  }
  return listEligibleEnvironmentalProviders(catalogIndex);
}

export function providerPriorityOf(entry: CatalogProviderEntry): 'primary' | 'secondary' | 'fallback' {
  if (entry.sunrey.priority === 'critical' || entry.provider_id === 'open-meteo') return 'primary';
  if (entry.sunrey.launch_tier === 'fallback_source') return 'fallback';
  return 'secondary';
}

export type EnvironmentalAdapterFactory = {
  createAll(): readonly EnvironmentalOracleProvider[];
  create(providerId: string): EnvironmentalOracleProvider | undefined;
};

export function createEnvironmentalAdapterFactory(): EnvironmentalAdapterFactory {
  return Object.freeze({
    createAll: () => createAllEnvironmentalAdapters(),
    create: (providerId: string) => {
      if (!(ENVIRONMENTAL_ADAPTER_IDS as readonly string[]).includes(providerId)) return undefined;
      return createEnvironmentalAdapter(providerId as (typeof ENVIRONMENTAL_ADAPTER_IDS)[number]);
    },
  });
}
