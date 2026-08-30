import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { ProviderId } from '../types.ts';
import {
  CATALOG_ID,
  EXPECTED_PROVIDER_COUNT,
  type CatalogIndex,
  type CatalogProviderEntry,
  type FreeApiCatalog,
} from './types.ts';

export type { CatalogIndex };

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_CATALOG_PATH = join(PACKAGE_ROOT, '..', '..', 'config', 'providers', 'free-api-catalog.yaml');

export function buildCatalogIndex(catalog: FreeApiCatalog): CatalogIndex {
  if (catalog.catalog_id !== CATALOG_ID) {
    throw new TypeError(`unexpected catalog_id '${catalog.catalog_id}'`);
  }
  if (catalog.expected_provider_count !== EXPECTED_PROVIDER_COUNT) {
    throw new TypeError(`expected_provider_count must be ${EXPECTED_PROVIDER_COUNT}`);
  }
  const byId = new Map<ProviderId, CatalogProviderEntry>();
  for (const entry of catalog.providers) {
    if (byId.has(entry.provider_id)) {
      throw new TypeError(`duplicate catalog provider_id '${entry.provider_id}'`);
    }
    byId.set(entry.provider_id, entry);
  }
  return Object.freeze({ catalog: Object.freeze({ ...catalog }), byId });
}

export function loadCatalogFromYaml(catalogPath = DEFAULT_CATALOG_PATH): CatalogIndex {
  const text = readFileSync(catalogPath, 'utf8');
  const parsed = parseYaml(text) as FreeApiCatalog;
  return buildCatalogIndex(parsed);
}

export function catalogEntryToDescriptor(
  entry: CatalogProviderEntry,
  activationMode: import('../types.ts').ProviderActivationMode = 'disabled',
): import('../types.ts').ProviderDescriptor {
  const secretReference =
    entry.authentication.environment_variable !== null
      ? Object.freeze({
          environmentVariable: entry.authentication.environment_variable,
          resolved: false as const,
        })
      : null;

  return Object.freeze({
    id: entry.provider_id,
    name: entry.name,
    shortName: entry.short_name,
    description: entry.description,
    primaryCategory: entry.primary_category,
    capabilities: Object.freeze([...entry.capabilities]),
    domains: Object.freeze([...entry.sunrey.domain]),
    authorityClass: entry.sunrey.authority_class,
    priority: entry.sunrey.priority,
    launchTier: entry.sunrey.launch_tier,
    activationMode,
    catalogOnly: entry.sunrey.integration_state === 'catalog_only' || entry.sunrey.integration_state == null,
    secretReference,
  });
}

export function getCatalogEntry(index: CatalogIndex, providerId: ProviderId): CatalogProviderEntry | undefined {
  return index.byId.get(providerId);
}

export function hasCatalogEntry(index: CatalogIndex, providerId: ProviderId): boolean {
  return index.byId.has(providerId);
}

export function listCatalogEntries(index: CatalogIndex): readonly CatalogProviderEntry[] {
  return Object.freeze([...index.byId.values()]);
}

export function listCatalogByCategory(
  index: CatalogIndex,
  category: import('../types.ts').ProviderCategory,
): readonly CatalogProviderEntry[] {
  return Object.freeze(
    [...index.byId.values()].filter(
      (entry) =>
        entry.primary_category === category ||
        (entry.secondary_categories ?? []).includes(category),
    ),
  );
}

export function listCatalogByCapability(index: CatalogIndex, capability: string): readonly CatalogProviderEntry[] {
  return Object.freeze([...index.byId.values()].filter((entry) => entry.capabilities.includes(capability)));
}

export function listCatalogProductionCandidates(index: CatalogIndex): readonly CatalogProviderEntry[] {
  return Object.freeze(
    [...index.byId.values()].filter((entry) => entry.sunrey.launch_tier === 'production_candidate'),
  );
}
