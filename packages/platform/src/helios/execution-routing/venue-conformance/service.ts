/**
 * HELIOS OS04 — binds venue adapter conformance to execution routing posture.
 *
 * Routing may reference venue market-data routes; it never places live orders.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  evaluateOs04VenueAdapterConformanceQualification,
  HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED,
  type VenueConformanceReport,
} from '../../../../../provider-sdk/src/venue/index.ts';
import {
  assertOs04VenueRegistryComplete,
  HELIOS_OS04_VENUE_ADAPTERS,
  KRAKEN_VENUE_ADAPTER,
} from '../../../../../external-data/src/venue-adapters/index.ts';
import { LIVE_TRADING_ENABLED } from '../../../../../config/src/flags.ts';
import { capabilityAvailability } from '../../../../../provider-sdk/src/venue/types.ts';

export type VenueConformanceSuiteResult = Readonly<{
  readonly evaluatedAt: UtcInstant;
  readonly reports: readonly VenueConformanceReport[];
  readonly marker:
    | typeof HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED
    | 'HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_BLOCKED';
  readonly qualified: boolean;
  readonly blockers: readonly string[];
}>;

export async function runHeliosOs04VenueConformanceSuite(input: {
  readonly now: UtcInstant;
  readonly ciEnvironment: boolean;
}): Promise<VenueConformanceSuiteResult> {
  const reports: VenueConformanceReport[] = [];
  for (const adapter of HELIOS_OS04_VENUE_ADAPTERS) {
    reports.push(
      await adapter.runConformance({
        qualificationMode: 'fixture',
        evaluatedAt: input.now,
        ciEnvironment: input.ciEnvironment,
      }),
    );
  }

  const krakenReport = reports.find((row) => row.venueId === 'kraken');
  const skeletonReports = reports.filter((row) => row.venueId !== 'kraken');
  const skeletonsFailClosed = skeletonReports.every((report) =>
    report.checks.some(
      (check) => check.checkId === 'skeleton_no_assumed_orders' && check.outcome === 'PASS',
    ),
  );

  const qualification = evaluateOs04VenueAdapterConformanceQualification({
    krakenAdapterQualified: krakenReport?.adapterQualified === true,
    allVenueSkeletonsRegistered: assertOs04VenueRegistryComplete(),
    skeletonsFailClosed,
    noLiveOrderPlacement: HELIOS_OS04_VENUE_ADAPTERS.every(
      (adapter) => adapter.liveOrderPlacementEnabled === false,
    ),
    ciUsesFixturesOnly: input.ciEnvironment,
    productionTradingDisabled: LIVE_TRADING_ENABLED === false,
  });

  return Object.freeze({
    evaluatedAt: input.now,
    reports: Object.freeze(reports),
    marker: qualification.marker,
    qualified: qualification.qualified,
    blockers: qualification.blockers,
  });
}

export function describeVenueRoutingPosture(venueId: string): Readonly<{
  readonly routeId: string;
  readonly marketDataOnly: true;
  readonly executionEnabled: false;
  readonly healthState: string;
}> {
  const adapter =
    venueId === 'kraken'
      ? KRAKEN_VENUE_ADAPTER
      : (HELIOS_OS04_VENUE_ADAPTERS.find((row) => row.venueId === venueId) ?? null);
  if (!adapter) {
    return Object.freeze({
      routeId: `route_venue_${venueId}_unknown`,
      marketDataOnly: true,
      executionEnabled: false,
      healthState: 'UNAVAILABLE',
    });
  }
  const manifest = adapter.manifest();
  const rest = capabilityAvailability(manifest.marketData.restAvailable);
  return Object.freeze({
    routeId: `route_venue_${venueId}_market_data`,
    marketDataOnly: true,
    executionEnabled: false,
    healthState:
      rest === 'AVAILABLE' && manifest.healthState !== 'UNAVAILABLE'
        ? manifest.healthState
        : 'UNAVAILABLE',
  });
}
