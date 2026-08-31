/**
 * Wave 5 provider coverage report — every Wave 5-eligible catalog provider accounted for.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { WAVE5_BLOCKED_PROVIDER_IDS, WAVE5_IMPLEMENTED_PROVIDER_IDS } from './wave5-adapters.ts';
import type { Wave5CoverageStatus, Wave5ProviderCoverage } from './wave5-models.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

export const WAVE5_CATEGORIES = new Set([
  'energy',
  'natural_resources',
  'environmental',
  'weather',
  'water',
  'transportation',
  'aviation',
  'maritime',
  'travel',
  'geospatial',
  'logistics',
]);

const DEPRECATED_IDS = new Set<string>([]);
const UNAVAILABLE_IDS = new Set<string>([]);

export function loadCatalogProviders(): readonly Record<string, unknown>[] {
  const catalog = parseYaml(readFileSync(CATALOG_PATH, 'utf8')) as { providers: Record<string, unknown>[] };
  return Object.freeze(catalog.providers ?? []);
}

export function classifyWave5Provider(provider: Record<string, unknown>): Wave5ProviderCoverage {
  const providerId = String(provider.provider_id);
  const category = String(provider.primary_category);
  const verification = (provider.verification as { status?: string })?.status ?? 'unverified';
  const integration = (provider.sunrey as { integration_state?: string })?.integration_state ?? 'catalog_only';

  if (!WAVE5_CATEGORIES.has(category)) {
    return Object.freeze({
      providerId,
      category,
      status: 'NOT_WAVE_5',
      notes: 'Outside Wave 5 physical-economy scope.',
    });
  }

  if (WAVE5_BLOCKED_PROVIDER_IDS.includes(providerId) || integration === 'blocked') {
    return Object.freeze({
      providerId,
      category,
      status: 'BLOCKED',
      notes: 'Blocked pending legal/commercial review.',
    });
  }

  if (DEPRECATED_IDS.has(providerId) || verification === 'deprecated') {
    return Object.freeze({
      providerId,
      category,
      status: 'DEPRECATED',
      notes: 'Provider API deprecated.',
    });
  }

  if (UNAVAILABLE_IDS.has(providerId) || verification === 'unavailable') {
    return Object.freeze({
      providerId,
      category,
      status: 'UNAVAILABLE',
      notes: 'Provider API unavailable.',
    });
  }

  if (WAVE5_IMPLEMENTED_PROVIDER_IDS.includes(providerId) || integration === 'implemented' || integration === 'adapter_implemented') {
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
    status: 'NOT_WAVE_5',
    notes: 'Awaiting implementation or authoritative catalog entry.',
  });
}

export function buildWave5CoverageReport(): {
  readonly providers: readonly Wave5ProviderCoverage[];
  readonly summary: Record<Wave5CoverageStatus, number>;
  readonly wave5Expected: number;
  readonly implemented: number;
  readonly blocked: number;
  readonly previewOnly: number;
} {
  const providers = loadCatalogProviders().map(classifyWave5Provider);
  const summary: Record<Wave5CoverageStatus, number> = {
    IMPLEMENTED: 0,
    BLOCKED: 0,
    DEPRECATED: 0,
    UNAVAILABLE: 0,
    NOT_WAVE_5: 0,
  };
  for (const entry of providers) {
    summary[entry.status] += 1;
  }
  const wave5Entries = providers.filter((p) => WAVE5_CATEGORIES.has(p.category));
  const implemented = wave5Entries.filter((p) => p.status === 'IMPLEMENTED').length;
  const blocked = wave5Entries.filter((p) => p.status === 'BLOCKED').length;
  const previewOnly = WAVE5_IMPLEMENTED_PROVIDER_IDS.filter((id) =>
    ['open-meteo', 'opensky', 'nominatim', 'openstreetmap', 'geojs', 'ipapi', 'ipwhois', 'onwater', 'hormuz-ship-monitor', 'openvan'].includes(id),
  ).length;
  return Object.freeze({
    providers: Object.freeze(providers),
    summary: Object.freeze(summary),
    wave5Expected: wave5Entries.length,
    implemented,
    blocked,
    previewOnly,
  });
}

export function assertWave5CoverageComplete(): void {
  const report = buildWave5CoverageReport();
  const unexplained = report.providers.filter(
    (p) => WAVE5_CATEGORIES.has(p.category) && p.status === 'NOT_WAVE_5',
  );
  if (unexplained.length > 0) {
    throw new Error(
      `Unexplained Wave 5 providers: ${unexplained.map((p) => p.providerId).join(', ')}`,
    );
  }
}
