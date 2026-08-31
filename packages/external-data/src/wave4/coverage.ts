/**
 * Wave 4 provider coverage report — every Wave 4-eligible catalog provider accounted for.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
  WAVE4_BLOCKED_PROVIDER_IDS,
  WAVE4_CATALOG_ENTRIES,
  WAVE4_DEPRECATED_PROVIDER_IDS,
  WAVE4_IMPLEMENTED_PROVIDER_IDS,
} from './catalog-entries.ts';
import type { Wave4CoverageStatus, Wave4ProviderCoverage } from './models.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const WAVE4_CATEGORIES = new Set(['compliance', 'kyb_identity', 'fraud_risk', 'cybersecurity']);

export function loadWave4CatalogProviders(): readonly Record<string, unknown>[] {
  try {
    const catalog = parseYaml(readFileSync(CATALOG_PATH, 'utf8')) as { providers: Record<string, unknown>[] };
    const fromYaml = catalog.providers ?? [];
    const yamlIds = new Set(fromYaml.map((p) => String(p.provider_id)));
    const merged = [...fromYaml];
    for (const entry of WAVE4_CATALOG_ENTRIES) {
      if (!yamlIds.has(entry.provider_id)) {
        merged.push(entry as unknown as Record<string, unknown>);
      }
    }
    if (merged.length > 0) {
      return Object.freeze(merged);
    }
  } catch {
    // fall through
  }
  return Object.freeze(WAVE4_CATALOG_ENTRIES as unknown as Record<string, unknown>[]);
}

export function classifyWave4Provider(provider: Record<string, unknown>): Wave4ProviderCoverage {
  const providerId = String(provider.provider_id);
  const category = String(provider.primary_category);
  const verification = (provider.verification as { status?: string })?.status ?? 'unverified';
  const integration = (provider.sunrey as { integration_state?: string })?.integration_state ?? 'catalog_only';

  if (!WAVE4_CATEGORIES.has(category)) {
    return Object.freeze({
      providerId,
      category,
      status: 'NOT_WAVE_4',
      notes: 'Outside Wave 4 compliance/KYB/fraud/cybersecurity scope.',
    });
  }

  if (WAVE4_BLOCKED_PROVIDER_IDS.includes(providerId)) {
    return Object.freeze({
      providerId,
      category,
      status: 'BLOCKED',
      notes: 'Blocked — commercial only or legal review required.',
    });
  }

  if (WAVE4_DEPRECATED_PROVIDER_IDS.includes(providerId) || verification === 'deprecated') {
    return Object.freeze({
      providerId,
      category,
      status: 'DEPRECATED',
      notes: 'Deprecated provider; use alternative.',
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

  if (
    WAVE4_IMPLEMENTED_PROVIDER_IDS.includes(providerId) ||
    integration === 'implemented' ||
    integration === 'adapter_implemented'
  ) {
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
    status: 'NOT_WAVE_4',
    notes: 'Awaiting Wave 4 integration.',
  });
}

export function buildWave4CoverageReport(): {
  readonly providers: readonly Wave4ProviderCoverage[];
  readonly summary: Record<Wave4CoverageStatus, number>;
  readonly wave4Expected: number;
  readonly implemented: number;
} {
  const providers = loadWave4CatalogProviders().map(classifyWave4Provider);
  const summary: Record<Wave4CoverageStatus, number> = {
    IMPLEMENTED: 0,
    BLOCKED: 0,
    DEPRECATED: 0,
    UNAVAILABLE: 0,
    NOT_WAVE_4: 0,
  };
  for (const entry of providers) {
    summary[entry.status] += 1;
  }
  const wave4Entries = providers.filter((p) => p.status !== 'NOT_WAVE_4');
  return Object.freeze({
    providers: Object.freeze(providers),
    summary: Object.freeze(summary),
    wave4Expected: wave4Entries.length,
    implemented: summary.IMPLEMENTED,
  });
}

export function assertWave4CoverageComplete(): void {
  const report = buildWave4CoverageReport();
  const unexplained = report.providers.filter(
    (p) => WAVE4_CATEGORIES.has(p.category) && p.status === 'NOT_WAVE_4',
  );
  if (unexplained.length > 0) {
    throw new Error(
      `Unexplained Wave 4 providers: ${unexplained.map((p) => p.providerId).join(', ')}`,
    );
  }
}
