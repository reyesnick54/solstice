/**
 * HELIOS NATIVE05 program qualification marker.
 */

import type { HeliosOs04VenueId } from './taxonomy.ts';
import type { VenueConformanceReport } from './types.ts';

export const HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED =
  'HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED' as const;

export const HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_BLOCKED =
  'HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_BLOCKED' as const;

export type NativeMultiVenueQualificationChecks = Readonly<{
  readonly allReferenceVenuesRegistered: boolean;
  readonly allAdaptersNativeQualified: boolean;
  readonly noLiveOrderPlacement: boolean;
  readonly noLiveExecutionEnabled: boolean;
  readonly ciUsesFixturesOnly: boolean;
  readonly productionTradingDisabled: boolean;
  readonly normalizationFixturesPass: boolean;
}>;

export function evaluateNativeMultiVenueAdapterQualification(
  checks: NativeMultiVenueQualificationChecks,
): Readonly<{
  readonly marker:
    | typeof HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED
    | typeof HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
}> {
  const entries = Object.entries(checks) as [keyof NativeMultiVenueQualificationChecks, boolean][];
  const blockers = entries.filter(([, passed]) => !passed).map(([key]) => key);
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

export function summarizeNativeVenueReports(
  reports: readonly VenueConformanceReport[],
  expectedVenueIds: readonly HeliosOs04VenueId[],
): Readonly<{
  readonly allAdaptersNativeQualified: boolean;
  readonly normalizationFixturesPass: boolean;
  readonly perVenue: Readonly<Record<string, boolean>>;
}> {
  const perVenue: Record<string, boolean> = {};
  for (const venueId of expectedVenueIds) {
    const report = reports.find((row) => row.venueId === venueId);
    perVenue[venueId] = report?.adapterQualified === true;
  }
  const allAdaptersNativeQualified = expectedVenueIds.every((id) => perVenue[id] === true);
  const normalizationFixturesPass = reports.every((report) =>
    report.checks
      .filter((check) => check.checkId.startsWith('normalization_fixture_'))
      .every((check) => check.outcome === 'PASS'),
  );
  return Object.freeze({ allAdaptersNativeQualified, normalizationFixturesPass, perVenue: Object.freeze(perVenue) });
}
