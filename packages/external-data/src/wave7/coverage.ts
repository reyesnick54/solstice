/**
 * Wave 7 — final 126-provider program coverage classifier.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import type { Wave7CoverageReport, Wave7CoverageSummary, Wave7ProgramStatus, Wave7ProviderCoverage } from './models.ts';
import {
  WAVE7_ACCEPTED_GAP_COUNT,
  WAVE7_ACCEPTED_PROGRAM_GAPS,
  WAVE7_EXPECTED_PROGRAM_TOTAL,
} from './program-gaps.ts';
import {
  WAVE7_ADAPTER_BY_PROVIDER,
  WAVE7_BLOCKED_IDS,
  WAVE7_CANONICAL_SERVICE_BY_CATEGORY,
  WAVE7_DEPRECATED_IDS,
  WAVE7_IMPLEMENTED_ACTIVE_IDS,
  WAVE7_LEGAL_REVIEW_IDS,
  WAVE7_NOT_FREE_IDS,
  WAVE7_PREVIEW_ONLY_IDS,
} from './registry.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

export function loadWave7CatalogProviders(): readonly Record<string, unknown>[] {
  const catalog = parseYaml(readFileSync(CATALOG_PATH, 'utf8')) as { providers: Record<string, unknown>[] };
  return Object.freeze(catalog.providers ?? []);
}

export function classifyWave7Provider(provider: Record<string, unknown>): Wave7ProviderCoverage {
  const providerId = String(provider.provider_id);
  const category = String(provider.primary_category);
  const verification = (provider.verification as { status?: string })?.status ?? 'unverified';
  const integration = (provider.sunrey as { integration_state?: string })?.integration_state ?? 'catalog_only';
  const commercial = (provider.commercial_use as { status?: string })?.status ?? 'unknown';
  const access = (provider.access as { status?: string })?.status ?? 'unknown';
  const auth = (provider.authentication as { required?: boolean })?.required === true;
  const launchTier = (provider.sunrey as { launch_tier?: string })?.launch_tier ?? 'research_only';

  let status: Wave7ProgramStatus;
  let notes: string;

  if (WAVE7_DEPRECATED_IDS.has(providerId) || verification === 'deprecated') {
    status = 'DEPRECATED';
    notes = 'Provider deprecated; use alternative.';
  } else if (verification === 'unavailable') {
    status = 'UNAVAILABLE';
    notes = 'Provider API unavailable.';
  } else if (WAVE7_NOT_FREE_IDS.has(providerId) || access === 'no_longer_free') {
    status = 'NOT_FREE_ANYMORE';
    notes = 'No verified free tier; commercial only.';
  } else if (WAVE7_LEGAL_REVIEW_IDS.has(providerId) || commercial === 'requires_legal_review' || commercial === 'unclear') {
    status = 'LEGAL_REVIEW_REQUIRED';
    notes = 'Commercial or licensing review required before production activation.';
  } else if (WAVE7_BLOCKED_IDS.has(providerId) || launchTier === 'blocked_pending_review') {
    status = 'IMPLEMENTED_BLOCKED';
    notes = 'Adapter or catalog entry exists; production activation blocked.';
  } else if (WAVE7_IMPLEMENTED_ACTIVE_IDS.has(providerId) || integration === 'implemented' || integration === 'adapter_implemented') {
    status = WAVE7_PREVIEW_ONLY_IDS.has(providerId) ? 'IMPLEMENTED_PREVIEW_ONLY' : 'IMPLEMENTED_ACTIVE';
    notes =
      status === 'IMPLEMENTED_PREVIEW_ONLY'
        ? 'Simulation adapter with fixture transport; preview tier only.'
        : 'Simulation adapter with fixture transport.';
  } else {
    status = 'MISSING_IMPLEMENTATION';
    notes = 'Catalog entry present; adapter not implemented.';
  }

  return Object.freeze({
    providerId,
    category,
    status,
    adapterId: WAVE7_ADAPTER_BY_PROVIDER[providerId] ?? (status.startsWith('IMPLEMENTED') ? 'fixture-adapter' : null),
    environment: 'simulation',
    authRequired: auth,
    commercialStatus: commercial,
    canonicalService: WAVE7_CANONICAL_SERVICE_BY_CATEGORY[category] ?? null,
    notes,
  });
}

export function buildWave7CoverageReport(): Wave7CoverageReport {
  const providers = loadWave7CatalogProviders().map(classifyWave7Provider);
  const summary = emptySummary();
  const byCategory: Record<string, number> = {};

  for (const entry of providers) {
    summary[entry.status] += 1;
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  }

  return Object.freeze({
    catalogTotal: providers.length,
    expectedTotal: WAVE7_EXPECTED_PROGRAM_TOTAL,
    providers: Object.freeze(providers),
    summary: Object.freeze(summary),
    byCategory: Object.freeze(byCategory),
    acceptedProgramGaps: WAVE7_ACCEPTED_GAP_COUNT,
    programTotalAccounted: providers.length + WAVE7_ACCEPTED_GAP_COUNT,
  });
}

export function assertWave7CatalogCoverageComplete(): void {
  const report = buildWave7CoverageReport();
  const unexplained = report.providers.filter((p) => !p.status || !p.notes);
  if (unexplained.length > 0) {
    throw new Error(`Unexplained catalog providers: ${unexplained.map((p) => p.providerId).join(', ')}`);
  }
  if (report.catalogTotal !== report.summary.IMPLEMENTED_ACTIVE + report.summary.IMPLEMENTED_PREVIEW_ONLY + report.summary.IMPLEMENTED_BLOCKED + report.summary.DEPRECATED + report.summary.UNAVAILABLE + report.summary.NOT_FREE_ANYMORE + report.summary.LEGAL_REVIEW_REQUIRED + report.summary.MISSING_IMPLEMENTATION) {
    throw new Error('Wave 7 classification sum does not match catalog total');
  }
}

export function assertWave7ProgramAccounting(): void {
  const report = buildWave7CoverageReport();
  if (report.programTotalAccounted !== WAVE7_EXPECTED_PROGRAM_TOTAL) {
    throw new Error(
      `Program accounting mismatch: catalog ${report.catalogTotal} + gaps ${report.acceptedProgramGaps} = ${report.programTotalAccounted}, expected ${WAVE7_EXPECTED_PROGRAM_TOTAL}`,
    );
  }
}

export function wave7MissingImplementationProviders(): readonly Wave7ProviderCoverage[] {
  return buildWave7CoverageReport().providers.filter((p) => p.status === 'MISSING_IMPLEMENTATION');
}

export function wave7AcceptedGapSummary(): readonly { readonly category: string; readonly slotCount: number; readonly reason: string }[] {
  return WAVE7_ACCEPTED_PROGRAM_GAPS.map((g) =>
    Object.freeze({ category: g.category, slotCount: g.slotCount, reason: g.reason }),
  );
}

function emptySummary(): Wave7CoverageSummary {
  return {
    IMPLEMENTED_ACTIVE: 0,
    IMPLEMENTED_PREVIEW_ONLY: 0,
    IMPLEMENTED_BLOCKED: 0,
    DEPRECATED: 0,
    UNAVAILABLE: 0,
    NOT_FREE_ANYMORE: 0,
    LEGAL_REVIEW_REQUIRED: 0,
    MISSING_IMPLEMENTATION: 0,
  };
}
