/**
 * Wave 4 — provider catalog inventory and domain classification audit.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import type { CatalogProviderEntry, FreeApiCatalog } from '../catalog/types.ts';
import {
  classifyProviderDomains,
  planeForDomain,
  type EconomicDomain,
  type EconomicDomainPlane,
} from './domain-taxonomy.ts';
import { defaultSourceClassForAuthority } from './source-class.ts';

const CONFIG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'config', 'providers');

export type ProviderInventoryEntry = {
  readonly providerId: string;
  readonly name: string;
  readonly primaryCategory: string;
  readonly economicDomains: readonly EconomicDomain[];
  readonly domainPlane: EconomicDomainPlane;
  readonly sourceClass: string;
  readonly integrationState: string | null;
  readonly launchTier: string;
  readonly catalogFile: string;
};

export type ProviderInventoryReport = {
  readonly totalDiscovered: number;
  readonly uniqueProviderIds: number;
  readonly byPlane: Readonly<Record<EconomicDomainPlane, number>>;
  readonly byDomain: Readonly<Partial<Record<EconomicDomain, number>>>;
  readonly bySourceClass: Readonly<Record<string, number>>;
  readonly entries: readonly ProviderInventoryEntry[];
  readonly migrationStatus: Readonly<Record<string, 'MIGRATED' | 'LEGACY_ADAPTER' | 'CATALOG_ONLY'>>;
};

const WAVE4_MIGRATED_IDS = new Set([
  'national-grid-eso',
  'usda-fooddata-central',
  'arbeitnow',
  'noozra',
]);

function loadYamlCatalog(path: string): FreeApiCatalog | null {
  try {
    return parseYaml(readFileSync(path, 'utf8')) as FreeApiCatalog;
  } catch {
    const overlay = parseYaml(readFileSync(path, 'utf8')) as { providers: CatalogProviderEntry[] };
    if (overlay.providers) {
      return {
        schema_version: '1.0.0',
        catalog_id: 'sunrey-free-api-catalog',
        expected_provider_count: 126,
        population_status: 'partial',
        providers: overlay.providers,
      };
    }
    return null;
  }
}

export function auditProviderCatalogs(): ProviderInventoryReport {
  const catalogFiles = [
    'free-api-catalog.yaml',
    'wave2-catalog-entries.yaml',
    'wave3-crypto-catalog-entries.yaml',
    'wave4-catalog-entries.yaml',
    'wave5-energy-resource-catalog-entries.yaml',
    'wave5-physical-economy-catalog-entries.yaml',
    'wave5-travel-catalog-entries.yaml',
    'wave6-health-hin-catalog-entries.yaml',
    'wave6-opportunity-skills-catalog-entries.yaml',
    'wave2-access-discovery-catalog-entries.yaml',
  ];

  const byId = new Map<string, { entry: CatalogProviderEntry; catalogFile: string }>();

  for (const file of catalogFiles) {
    const path = join(CONFIG_ROOT, file);
    const catalog = loadYamlCatalog(path);
    if (!catalog) {
      continue;
    }
    for (const entry of catalog.providers) {
      if (!byId.has(entry.provider_id)) {
        byId.set(entry.provider_id, { entry, catalogFile: file });
      }
    }
  }

  const entries: ProviderInventoryEntry[] = [];
  const byPlane: Record<EconomicDomainPlane, number> = {
    HUMAN_ECONOMY: 0,
    PRODUCTIVE_ECONOMY: 0,
    REFERENCE_CONTEXT: 0,
  };
  const byDomain: Partial<Record<EconomicDomain, number>> = {};
  const bySourceClass: Record<string, number> = {};
  const migrationStatus: Record<string, 'MIGRATED' | 'LEGACY_ADAPTER' | 'CATALOG_ONLY'> = {};

  for (const [providerId, { entry, catalogFile }] of byId) {
    const domains = classifyProviderDomains(
      entry.primary_category,
      entry.secondary_categories ?? [],
    );
    const firstDomain = domains[0];
    const plane = firstDomain !== undefined ? planeForDomain(firstDomain) : 'REFERENCE_CONTEXT';
    byPlane[plane] += 1;
    for (const d of domains) {
      byDomain[d] = (byDomain[d] ?? 0) + 1;
    }
    const sourceClass = defaultSourceClassForAuthority(entry.sunrey.authority_class);
    bySourceClass[sourceClass] = (bySourceClass[sourceClass] ?? 0) + 1;

    if (WAVE4_MIGRATED_IDS.has(providerId)) {
      migrationStatus[providerId] = 'MIGRATED';
    } else if (entry.sunrey.existing_adapter) {
      migrationStatus[providerId] = 'LEGACY_ADAPTER';
    } else {
      migrationStatus[providerId] = 'CATALOG_ONLY';
    }

    entries.push(
      Object.freeze({
        providerId,
        name: entry.name,
        primaryCategory: entry.primary_category,
        economicDomains: domains,
        domainPlane: plane,
        sourceClass,
        integrationState: entry.sunrey.integration_state ?? null,
        launchTier: entry.sunrey.launch_tier,
        catalogFile,
      }),
    );
  }

  entries.sort((a, b) => a.providerId.localeCompare(b.providerId));

  return Object.freeze({
    totalDiscovered: entries.length,
    uniqueProviderIds: byId.size,
    byPlane: Object.freeze(byPlane),
    byDomain: Object.freeze(byDomain),
    bySourceClass: Object.freeze(bySourceClass),
    entries: Object.freeze(entries),
    migrationStatus: Object.freeze(migrationStatus),
  });
}

export function summarizeInventoryForDocs(report: ProviderInventoryReport): string {
  const lines = [
    `Total unique providers: ${report.uniqueProviderIds}`,
    '',
    'By economic plane:',
    ...Object.entries(report.byPlane).map(([k, v]) => `- ${k}: ${v}`),
    '',
    'Migrated to Wave 4 connector framework:',
    ...Object.entries(report.migrationStatus)
      .filter(([, s]) => s === 'MIGRATED')
      .map(([id]) => `- ${id}`),
  ];
  return lines.join('\n');
}
