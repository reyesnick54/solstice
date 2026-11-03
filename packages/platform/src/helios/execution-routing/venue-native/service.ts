/**
 * HELIOS NATIVE05 — multi-venue native adapter qualification suite.
 */

import type { UtcInstant } from '@solstice/domain';
import { LIVE_TRADING_ENABLED } from '@solstice/config';
import {
  assertOs04VenueRegistryComplete,
  HELIOS_NATIVE_VENUE_ADAPTERS,
} from '@solstice/external-data';
import {
  evaluateNativeMultiVenueAdapterQualification,
  HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED,
  HELIOS_OS04_VENUE_IDS,
  runNativeVenueAdapterSuite,
  summarizeNativeVenueReports,
  type VenueConformanceReport,
} from '@solstice/provider-sdk';

export type NativeMultiVenueSuiteResult = Readonly<{
  readonly evaluatedAt: UtcInstant;
  readonly reports: readonly VenueConformanceReport[];
  readonly marker:
    | typeof HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED
    | 'HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_BLOCKED';
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly perVenue: Readonly<Record<string, boolean>>;
}>;

export async function runHeliosNativeMultiVenueAdapterSuite(input: {
  readonly now: UtcInstant;
  readonly ciEnvironment: boolean;
}): Promise<NativeMultiVenueSuiteResult> {
  const reports = await runNativeVenueAdapterSuite(HELIOS_NATIVE_VENUE_ADAPTERS, {
    qualificationMode: 'fixture',
    evaluatedAt: input.now,
    ciEnvironment: input.ciEnvironment,
  });

  const summary = summarizeNativeVenueReports(reports, HELIOS_OS04_VENUE_IDS);
  const qualification = evaluateNativeMultiVenueAdapterQualification({
    allReferenceVenuesRegistered: assertOs04VenueRegistryComplete(),
    allAdaptersNativeQualified: summary.allAdaptersNativeQualified,
    noLiveOrderPlacement: HELIOS_NATIVE_VENUE_ADAPTERS.every(
      (adapter) => adapter.liveOrderPlacementEnabled === false,
    ),
    noLiveExecutionEnabled: HELIOS_NATIVE_VENUE_ADAPTERS.every(
      (adapter) => adapter.liveExecutionEnabled === false,
    ),
    ciUsesFixturesOnly: input.ciEnvironment,
    productionTradingDisabled: LIVE_TRADING_ENABLED === false,
    normalizationFixturesPass: summary.normalizationFixturesPass,
  });

  return Object.freeze({
    evaluatedAt: input.now,
    reports,
    marker: qualification.marker,
    qualified: qualification.qualified,
    blockers: qualification.blockers,
    perVenue: summary.perVenue,
  });
}
