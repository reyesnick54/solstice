/**
 * HELIOS NATIVE05 — extends OS04 conformance with normalization fixture checks.
 */

import type { HeliosVenueAdapter } from './helios-venue-adapter.ts';
import type { VenueConformanceRunInput } from './contract.ts';
import type { VenueConformanceCheck, VenueConformanceReport } from './types.ts';
import {
  NATIVE05_VENUE_QUALIFICATION_PROFILE,
  runVenueAdapterConformance,
} from './conformance.ts';
import { HELIOS_VENUE_ADAPTER_SCHEMA_VERSION } from './taxonomy.ts';

function check(
  checkId: string,
  outcome: 'PASS' | 'FAIL' | 'SKIPPED',
  message: string,
): VenueConformanceCheck {
  return Object.freeze({ checkId, outcome, message });
}

function evaluateNormalizationFixtures(adapter: HeliosVenueAdapter): VenueConformanceCheck[] {
  const checks: VenueConformanceCheck[] = [];
  if (adapter.normalizationFixtures.length === 0) {
    checks.push(check('normalization_fixtures', 'FAIL', 'native adapter requires normalization fixtures'));
    return checks;
  }

  for (const fixture of adapter.normalizationFixtures) {
    const symbol = adapter.resolveSymbol({ kind: 'canonical', value: 'BTC/USD' });
    try {
      if (fixture.quote !== undefined) {
        adapter.normalizeQuote(fixture.quote, symbol);
      }
      if (fixture.trade !== undefined) {
        adapter.normalizeTrade(fixture.trade, symbol);
      }
      if (fixture.book !== undefined) {
        adapter.normalizeBook(fixture.book, symbol);
      }
      if (fixture.candle !== undefined) {
        adapter.normalizeCandle(fixture.candle, symbol);
      }
      if (fixture.order !== undefined) {
        adapter.normalizeOrderState(fixture.order, symbol);
      }
      checks.push(
        check(`normalization_fixture_${fixture.fixtureId}`, 'PASS', 'fixture normalized successfully'),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push(
        check(`normalization_fixture_${fixture.fixtureId}`, 'FAIL', message),
      );
    }
  }
  return checks;
}

export async function runNativeVenueAdapterConformance(
  adapter: HeliosVenueAdapter,
  input: VenueConformanceRunInput,
): Promise<VenueConformanceReport> {
  const base = await runVenueAdapterConformance(adapter, input, NATIVE05_VENUE_QUALIFICATION_PROFILE);
  const normalizationChecks = evaluateNormalizationFixtures(adapter);
  const checks = Object.freeze([...base.checks, ...normalizationChecks]);
  const conformancePassed = checks.every((row) => row.outcome !== 'FAIL');
  const adapterQualified =
    conformancePassed &&
    base.adapterQualified &&
    normalizationChecks.every((row) => row.outcome === 'PASS');

  return Object.freeze({
    ...base,
    checks,
    conformancePassed,
    adapterQualified,
  });
}

export async function runNativeVenueAdapterSuite(
  adapters: readonly HeliosVenueAdapter[],
  input: VenueConformanceRunInput,
): Promise<readonly VenueConformanceReport[]> {
  const reports: VenueConformanceReport[] = [];
  for (const adapter of adapters) {
    reports.push(await runNativeVenueAdapterConformance(adapter, input));
  }
  return Object.freeze(reports);
}

export function nativeAdapterReportIdentity(report: VenueConformanceReport): boolean {
  return report.schemaVersion === HELIOS_VENUE_ADAPTER_SCHEMA_VERSION;
}
