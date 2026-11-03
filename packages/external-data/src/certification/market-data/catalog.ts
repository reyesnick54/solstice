/**
 * Load HELIOS AAF07 market-data certification overlay.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { getCatalogEntry, loadCatalogFromYaml } from '../../../../provider-sdk/src/catalog/loader.ts';
import type { CatalogIndex } from '../../../../provider-sdk/src/catalog/types.ts';
import type { HeliosMarketDataCatalogOverlayEntry } from '../../../../provider-sdk/src/market-data-capability/build-from-catalog.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
export const HELIOS_MARKET_DATA_CERTIFICATION_CATALOG_PATH = join(
  ROOT,
  'config/providers/helios-external-market-data-certification.yaml',
);
export const FREE_API_CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

export type HeliosMarketDataCertificationCatalog = {
  readonly schema_version: string;
  readonly catalog_id: string;
  readonly notes: string | null;
  readonly providers: readonly HeliosMarketDataCatalogOverlayEntry[];
};

export function loadHeliosMarketDataCertificationCatalog(
  path = HELIOS_MARKET_DATA_CERTIFICATION_CATALOG_PATH,
): HeliosMarketDataCertificationCatalog {
  const raw = parseYaml(readFileSync(path, 'utf8')) as HeliosMarketDataCertificationCatalog;
  return Object.freeze({
    schema_version: String(raw.schema_version),
    catalog_id: String(raw.catalog_id),
    notes: raw.notes ?? null,
    providers: Object.freeze((raw.providers ?? []).map((row) => Object.freeze(row))),
  });
}

export function loadMarketDataCertificationCatalogIndex(
  freeApiPath = FREE_API_CATALOG_PATH,
): { readonly overlay: HeliosMarketDataCertificationCatalog; readonly catalog: CatalogIndex } {
  return Object.freeze({
    overlay: loadHeliosMarketDataCertificationCatalog(),
    catalog: loadCatalogFromYaml(freeApiPath),
  });
}

export function resolveOverlayProvider(
  overlay: HeliosMarketDataCertificationCatalog,
  providerId: string,
): HeliosMarketDataCatalogOverlayEntry | null {
  return overlay.providers.find((row) => row.provider_id === providerId) ?? null;
}

export function resolveFreeApiEntry(catalog: CatalogIndex, providerId: string) {
  return getCatalogEntry(catalog, providerId);
}
