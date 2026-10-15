/**
 * AAF04 qualification gate.
 */

export const HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED =
  'HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED' as const;
export const HELIOS_AAF04_POINT_IN_TIME_COMPILER_BLOCKED =
  'HELIOS_AAF04_POINT_IN_TIME_COMPILER_BLOCKED' as const;

export type Aaf04QualificationChecks = {
  readonly earningsAfterCloseRejected: boolean;
  readonly macroRevisionRejected: boolean;
  readonly tickerChangeRejected: boolean;
  readonly futureIndexConstituentRejected: boolean;
  readonly delayedProviderRejected: boolean;
  readonly lateAltDataRejected: boolean;
  readonly revisedCorporateActionRejected: boolean;
  readonly rollingWindowBoundary: boolean;
  readonly manifestReproducible: boolean;
  readonly asOfJoinDeterministic: boolean;
};

export type Aaf04QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED
    | typeof HELIOS_AAF04_POINT_IN_TIME_COMPILER_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAaf04Qualification(checks: Aaf04QualificationChecks): Aaf04QualificationResult {
  const blockers: string[] = [];
  if (!checks.earningsAfterCloseRejected) blockers.push('earnings after close leak not rejected');
  if (!checks.macroRevisionRejected) blockers.push('macro revision leak not rejected');
  if (!checks.tickerChangeRejected) blockers.push('future ticker metadata leak not rejected');
  if (!checks.futureIndexConstituentRejected) blockers.push('future index constituent leak not rejected');
  if (!checks.delayedProviderRejected) blockers.push('delayed provider feed leak not rejected');
  if (!checks.lateAltDataRejected) blockers.push('late alternative observation leak not rejected');
  if (!checks.revisedCorporateActionRejected) blockers.push('revised corporate action leak not rejected');
  if (!checks.rollingWindowBoundary) blockers.push('rolling window boundary case failed');
  if (!checks.manifestReproducible) blockers.push('manifest reproduction failed');
  if (!checks.asOfJoinDeterministic) blockers.push('as-of join determinism failed');

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_AAF04_POINT_IN_TIME_COMPILER_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
