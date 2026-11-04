/**
 * Temporally valid conformal intervals from strictly prior residuals.
 */

import type { UtcInstant } from '@solstice/domain';
import type { EarningsEstimateTarget } from './taxonomy.ts';
import type { ConformalInterval, ConformalResidualRecord } from './types.ts';

export function filterPriorConformalResiduals(
  residuals: readonly ConformalResidualRecord[],
  target: EarningsEstimateTarget,
  asOf: UtcInstant,
): readonly ConformalResidualRecord[] {
  return Object.freeze(residuals.filter((row) => row.target === target && row.outcomeKnownAt < asOf));
}

export function conformalQuantileAbsoluteError(
  residuals: readonly ConformalResidualRecord[],
  coverageLevel: number,
): number | null {
  if (residuals.length === 0) return null;
  const sorted = residuals.map((r) => r.scaledError).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(coverageLevel * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? null;
}

export function buildConformalInterval(input: {
  readonly mean: number;
  readonly residuals: readonly ConformalResidualRecord[];
  readonly target: EarningsEstimateTarget;
  readonly asOf: UtcInstant;
  readonly coverageLevel: number;
}): ConformalInterval | null {
  const prior = filterPriorConformalResiduals(input.residuals, input.target, input.asOf);
  const radius = conformalQuantileAbsoluteError(prior, input.coverageLevel);
  if (radius === null) return null;
  return Object.freeze({
    lower: input.mean - radius,
    upper: input.mean + radius,
    coverageLevel: input.coverageLevel,
    temporallyValidAsOf: input.asOf,
    disclaimer: 'NOT_GUARANTEED_UNDER_REGIME_SHIFT',
  });
}

export function recordConformalResidual(input: {
  readonly target: EarningsEstimateTarget;
  readonly fiscalPeriodKey: string;
  readonly outcomeKnownAt: UtcInstant;
  readonly predicted: number;
  readonly actual: number;
  readonly scale: number;
}): ConformalResidualRecord {
  const absoluteError = Math.abs(input.actual - input.predicted);
  const scaledError = absoluteError / Math.max(input.scale, 1e-9);
  return Object.freeze({
    target: input.target,
    fiscalPeriodKey: input.fiscalPeriodKey,
    outcomeKnownAt: input.outcomeKnownAt,
    absoluteError,
    scaledError,
  });
}
