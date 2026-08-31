/**
 * Wave 4 provider coverage reporting.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import type { Wave4ProviderCoverage } from './models.ts';
import {
  WAVE4_BLOCKED_CATEGORIES,
  WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS,
  WAVE4_FIXTURE_PROVIDER_IDS,
  WAVE4_IMPLEMENTED_PROVIDER_IDS,
} from './catalog-entries.ts';

const ROOT = join(import.meta.dirname, '../../..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');
const WAVE2_CATALOG_PATH = join(ROOT, 'config/providers/wave2-catalog-entries.yaml');

const TARGET_CATEGORIES = Object.freeze([
  'kyb_identity',
  'fraud_risk',
  'cybersecurity',
  'corporate_filings',
] as const);

export function loadCatalogProviderIds(): readonly string[] {
  try {
    const raw = readFileSync(WAVE2_CATALOG_PATH, 'utf8');
    const parsed = parseYaml(raw) as { providers?: readonly { provider_id: string }[] };
    return Object.freeze((parsed.providers ?? []).map((p) => p.provider_id));
  } catch {
    return Object.freeze([]);
  }
}

export function listEligibleWave4Providers(): readonly Wave4ProviderCoverage[] {
  const catalogIds = new Set(loadCatalogProviderIds());
  const coverage: Wave4ProviderCoverage[] = [];

  for (const id of WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS) {
    coverage.push({
      providerId: id,
      category: 'corporate_filings',
      status: catalogIds.has(id) ? 'IMPLEMENTED' : 'NOT_IN_CATALOG',
      notes: 'US SEC EDGAR public corporate filings and company search',
    });
  }

  for (const id of WAVE4_FIXTURE_PROVIDER_IDS) {
    coverage.push({
      providerId: id,
      category: 'fixture',
      status: 'FIXTURE_ONLY',
      notes: 'Chunk 152 regulated simulation fixture — not a Wave 0 free API',
    });
  }

  for (const category of WAVE4_BLOCKED_CATEGORIES) {
    coverage.push({
      providerId: `[none:${category}]`,
      category,
      status: 'NOT_IN_CATALOG',
      notes: `Zero eligible free/public providers in Wave 0 catalog for ${category}`,
    });
  }

  return Object.freeze(coverage);
}

export function wave4CoverageSummary(): {
  readonly eligibleCatalogCount: number;
  readonly implementedCount: number;
  readonly fixtureCount: number;
  readonly missingCategoryCount: number;
  readonly providers: readonly Wave4ProviderCoverage[];
} {
  const providers = listEligibleWave4Providers();
  return Object.freeze({
    eligibleCatalogCount: WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS.length,
    implementedCount: WAVE4_IMPLEMENTED_PROVIDER_IDS.length,
    fixtureCount: WAVE4_FIXTURE_PROVIDER_IDS.length,
    missingCategoryCount: WAVE4_BLOCKED_CATEGORIES.length,
    providers,
  });
}

export { TARGET_CATEGORIES, CATALOG_PATH };
