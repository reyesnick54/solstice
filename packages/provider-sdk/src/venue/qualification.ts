/**
 * HELIOS OS04 — program qualification marker.
 */

export const HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED =
  'HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED' as const;

export const HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_BLOCKED =
  'HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_BLOCKED' as const;

export type Os04VenueConformanceQualificationChecks = Readonly<{
  readonly krakenAdapterQualified: boolean;
  readonly allVenueSkeletonsRegistered: boolean;
  readonly skeletonsFailClosed: boolean;
  readonly noLiveOrderPlacement: boolean;
  readonly ciUsesFixturesOnly: boolean;
  readonly productionTradingDisabled: boolean;
}>;

export function evaluateOs04VenueAdapterConformanceQualification(
  checks: Os04VenueConformanceQualificationChecks,
): Readonly<{
  readonly marker:
    | typeof HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED
    | typeof HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
}> {
  const entries = Object.entries(checks) as [keyof Os04VenueConformanceQualificationChecks, boolean][];
  const blockers = entries.filter(([, passed]) => !passed).map(([key]) => key);
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
