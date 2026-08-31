/**
 * Wave 2 provider coverage report — every Wave 2-eligible catalog provider accounted for.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { WAVE2_IMPLEMENTED_PROVIDER_IDS } from './adapters.ts';
import type { Wave2CoverageStatus, Wave2ProviderCoverage } from './models.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const WAVE2_CATEGORIES = new Set([
  'macroeconomics',
  'foreign_exchange',
  'markets',
  'securities',
  'commodities',
  'corporate_filings',
  'government_open_data',
]);

const WAVE3_CATEGORIES = new Set(['cryptocurrency', 'blockchain']);

const BLOCKED_IDS = new Set(['yahoo-finance-unofficial', 'quandl-nasdaq-data-link', 'currencyapi-com']);
const DEPRECATED_IDS = new Set(['treasury-direct-legacy-xml']);

export function loadCatalogProviders(): readonly Record<string, unknown>[] {
  try {
    const catalog = parseYaml(readFileSync(CATALOG_PATH, 'utf8')) as { providers: Record<string, unknown>[] };
    if (catalog.providers?.length) {
      return Object.freeze(catalog.providers);
    }
  } catch {
    // fall through to wave2 entries
  }
  const wave2Path = join(ROOT, 'config/providers/wave2-catalog-entries.yaml');
  const wave2 = parseYaml(readFileSync(wave2Path, 'utf8')) as { providers: Record<string, unknown>[] };
  return Object.freeze(wave2.providers ?? []);
}

export function classifyWave2Provider(provider: Record<string, unknown>): Wave2ProviderCoverage {
  const providerId = String(provider.provider_id);
  const category = String(provider.primary_category);
  const verification = (provider.verification as { status?: string })?.status ?? 'unverified';
  const integration = (provider.sunrey as { integration_state?: string })?.integration_state ?? 'catalog_only';

  if (!WAVE2_CATEGORIES.has(category)) {
    return Object.freeze({
      providerId,
      category,
      status: WAVE3_CATEGORIES.has(category) ? 'NOT_WAVE_2' : 'NOT_WAVE_2',
      notes: WAVE3_CATEGORIES.has(category)
        ? 'Wave 3 crypto/blockchain scope; accounted outside Wave 2 coverage.'
        : 'Outside Wave 2 economics/markets scope.',
    });
  }

  if (BLOCKED_IDS.has(providerId)) {
    return Object.freeze({
      providerId,
      category,
      status: 'BLOCKED',
      notes: 'Blocked pending legal/commercial review.',
    });
  }

  if (DEPRECATED_IDS.has(providerId) || verification === 'deprecated' || verification === 'unavailable') {
    return Object.freeze({
      providerId,
      category,
      status: verification === 'unavailable' ? 'UNAVAILABLE' : 'DEPRECATED',
      notes: 'Provider API deprecated or unavailable.',
    });
  }

  if (WAVE2_IMPLEMENTED_PROVIDER_IDS.includes(providerId) || integration === 'implemented' || integration === 'adapter_implemented') {
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
    status: 'NOT_WAVE_2',
    notes: 'Awaiting authoritative 126-provider master list.',
  });
}

export function buildWave2CoverageReport(): {
  readonly providers: readonly Wave2ProviderCoverage[];
  readonly summary: Record<Wave2CoverageStatus, number>;
  readonly wave2Expected: number;
  readonly implemented: number;
} {
  const providers = loadCatalogProviders().map(classifyWave2Provider);
  const summary: Record<Wave2CoverageStatus, number> = {
    IMPLEMENTED: 0,
    BLOCKED: 0,
    DEPRECATED: 0,
    UNAVAILABLE: 0,
    NOT_WAVE_2: 0,
  };
  for (const entry of providers) {
    summary[entry.status] += 1;
  }
  const wave2Entries = providers.filter((p) => p.status !== 'NOT_WAVE_2');
  return Object.freeze({
    providers: Object.freeze(providers),
    summary: Object.freeze(summary),
    wave2Expected: wave2Entries.length,
    implemented: summary.IMPLEMENTED,
  });
}

export function assertWave2CoverageComplete(): void {
  const report = buildWave2CoverageReport();
  const unexplained = report.providers.filter(
    (p) =>
      WAVE2_CATEGORIES.has(p.category) &&
      p.status === 'NOT_WAVE_2' &&
      !p.providerId.startsWith('fixture'),
  );
  if (unexplained.length > 0) {
    throw new Error(
      `Unexplained Wave 2 providers: ${unexplained.map((p) => p.providerId).join(', ')}`,
    );
  }
}
