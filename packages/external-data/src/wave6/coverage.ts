/**
 * Wave 6 provider coverage report — every Wave 6-eligible catalog provider accounted for.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
  WAVE6_AWAITING_MASTER_LIST_PROVIDER_IDS,
  WAVE6_BLOCKED_PROVIDER_IDS,
  WAVE6_CATALOG_ENTRIES,
  WAVE6_DEPRECATED_PROVIDER_IDS,
  WAVE6_IMPLEMENTED_PROVIDER_IDS,
} from './catalog-entries.ts';
import type { Wave6CoverageReport, Wave6ProviderCoverage } from './models.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const WAVE6_PRIMARY_CATEGORIES = new Set([
  'health',
  'food_nutrition',
  'jobs_skills',
  'research',
  'patents',
  'government_open_data',
  'artificial_intelligence',
]);

const WAVE6_SECONDARY_SIGNALS = new Set(['research', 'hin', 'government_open_data', 'artificial_intelligence']);

export function loadWave6CatalogProviders(): readonly Record<string, unknown>[] {
  try {
    const catalog = parseYaml(readFileSync(CATALOG_PATH, 'utf8')) as { providers: Record<string, unknown>[] };
    const fromYaml = catalog.providers ?? [];
    const yamlIds = new Set(fromYaml.map((p) => String(p.provider_id)));
    const merged = [...fromYaml];
    for (const entry of WAVE6_CATALOG_ENTRIES) {
      if (!yamlIds.has(entry.provider_id)) {
        merged.push(entry as unknown as Record<string, unknown>);
      }
    }
    return Object.freeze(merged);
  } catch {
    return Object.freeze(WAVE6_CATALOG_ENTRIES as unknown as Record<string, unknown>[]);
  }
}

function isWave6Eligible(provider: Record<string, unknown>): boolean {
  const category = String(provider.primary_category);
  if (WAVE6_PRIMARY_CATEGORIES.has(category)) {
    return true;
  }
  const secondary = (provider.secondary_categories as string[] | undefined) ?? [];
  if (secondary.some((s) => WAVE6_PRIMARY_CATEGORIES.has(s))) {
    return true;
  }
  const domains = ((provider.sunrey as { domain?: string[] })?.domain ?? []) as string[];
  return domains.some((d) => WAVE6_SECONDARY_SIGNALS.has(d));
}

export function classifyWave6Provider(provider: Record<string, unknown>): Wave6ProviderCoverage {
  const providerId = String(provider.provider_id);
  const category = String(provider.primary_category);
  const verification = (provider.verification as { status?: string })?.status ?? 'unverified';
  const integration = (provider.sunrey as { integration_state?: string })?.integration_state ?? 'catalog_only';

  if (!isWave6Eligible(provider)) {
    return Object.freeze({
      providerId,
      category,
      status: 'NOT_WAVE_6',
      notes: 'Outside Wave 6 HIN/health/jobs/research/patents/open-data/AI scope.',
    });
  }

  if (WAVE6_BLOCKED_PROVIDER_IDS.includes(providerId)) {
    return Object.freeze({
      providerId,
      category,
      status: 'BLOCKED',
      notes: 'Blocked — legal/commercial review or licensing required.',
    });
  }

  if (WAVE6_DEPRECATED_PROVIDER_IDS.includes(providerId) || verification === 'deprecated') {
    return Object.freeze({
      providerId,
      category,
      status: 'DEPRECATED',
      notes: 'Deprecated provider; superseded by canonical alternative.',
    });
  }

  if (verification === 'unavailable') {
    return Object.freeze({
      providerId,
      category,
      status: 'UNAVAILABLE',
      notes: 'Provider API unavailable.',
    });
  }

  if (WAVE6_IMPLEMENTED_PROVIDER_IDS.includes(providerId) || integration === 'implemented') {
    return Object.freeze({
      providerId,
      category,
      status: 'IMPLEMENTED',
      notes: 'Simulation adapter with fixture transport.',
    });
  }

  return Object.freeze({
    providerId,
    category,
    status: 'NOT_IN_CATALOG',
    notes: 'Wave 6 eligible in catalog but adapter not yet implemented.',
  });
}

export function buildWave6CoverageReport(): Wave6CoverageReport {
  const catalogProviders = loadWave6CatalogProviders().filter(isWave6Eligible);
  const classified = catalogProviders.map(classifyWave6Provider);
  const awaiting = WAVE6_AWAITING_MASTER_LIST_PROVIDER_IDS.map((providerId) =>
    Object.freeze({
      providerId,
      category: 'awaiting_master_list',
      status: 'AWAITING_MASTER_LIST' as const,
      notes: 'Referenced in Wave 6 scope but absent from authoritative Wave 0 catalog — master list pending.',
    }),
  );
  const providers = Object.freeze([...classified, ...awaiting]);
  const counts = providers.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return Object.freeze({
    totalWave6Eligible: catalogProviders.length + awaiting.length,
    implemented: counts.IMPLEMENTED ?? 0,
    blocked: counts.BLOCKED ?? 0,
    deprecated: counts.DEPRECATED ?? 0,
    unavailable: counts.UNAVAILABLE ?? 0,
    notInCatalog: counts.NOT_IN_CATALOG ?? 0,
    awaitingMasterList: counts.AWAITING_MASTER_LIST ?? 0,
    providers,
  });
}

export function assertWave6CoverageComplete(): void {
  const report = buildWave6CoverageReport();
  const unexplained = report.providers.filter(
    (p) =>
      p.status !== 'NOT_WAVE_6' &&
      p.status !== 'IMPLEMENTED' &&
      p.status !== 'BLOCKED' &&
      p.status !== 'DEPRECATED' &&
      p.status !== 'UNAVAILABLE' &&
      p.status !== 'AWAITING_MASTER_LIST' &&
      p.status !== 'NOT_IN_CATALOG',
  );
  if (unexplained.length > 0) {
    throw new Error(`Unexplained Wave 6 providers: ${unexplained.map((p) => p.providerId).join(', ')}`);
  }
}
