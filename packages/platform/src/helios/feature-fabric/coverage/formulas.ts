/**
 * Deterministic coverage metric formulas (AAF05).
 *
 * All ratios use integer basis points (bps): floor(numerator * 10_000 / denominator).
 * When denominator is 0, the ratio is defined as 0 bps.
 *
 * coverageRatioBps:
 *   floor(usableFeatureCount * 10_000 / expectedCellCount)
 *   where expectedCellCount = eligibleUniverseCount * featureIds.length
 *
 * crossSectionalCoverageRatioBps (per evaluation timestamp):
 *   For each instrument in the eligible universe at T, instrument is "covered" when
 *   every requested featureId has disposition USABLE for that instrument at T.
 *   floor(instrumentsFullyCovered * 10_000 / eligibleUniverseCount)
 *
 * featureCompletenessRatioBps (per featureId F):
 *   floor(usableCells(F) * 10_000 / eligibleUniverseCount)
 *
 * providerCoverageRatioBps (per provider P):
 *   Cells where providerId = P and disposition USABLE, over cells where providerId = P
 *   or missingnessReason is PROVIDER_UNAVAILABLE for provider P.
 *
 * rollingCoverageRatioBps:
 *   Arithmetic mean of coverageRatioBps over the last W snapshots (W >= 1), rounded down.
 *
 * coverageStabilityBps:
 *   10_000 - (max(coverageRatioBps in window) - min(coverageRatioBps in window)), floored at 0.
 *
 * coverageDriftBps:
 *   abs(current.coverageRatioBps - baseline.coverageRatioBps)
 */

export const COVERAGE_RATIO_SCALE_BPS = 10_000 as const;

export function ratioBps(numerator: number, denominator: number): number {
  if (denominator <= 0 || numerator <= 0) {
    return 0;
  }
  return Math.floor((numerator * COVERAGE_RATIO_SCALE_BPS) / denominator);
}

export function rollingMeanBps(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((acc, row) => acc + row, 0);
  return Math.floor(sum / values.length);
}

export function coverageStabilityBps(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  let min = values[0]!;
  let max = values[0]!;
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i]!;
    if (row < min) min = row;
    if (row > max) max = row;
  }
  return Math.max(0, COVERAGE_RATIO_SCALE_BPS - (max - min));
}

export function coverageDriftBps(baselineBps: number, currentBps: number): number {
  return Math.abs(currentBps - baselineBps);
}
