/**
 * Government yield curve interpolation for risk-free anchors.
 */

import type { GovernmentYieldCurve, RateUncertaintyBps } from './types.ts';
import { clampBps, spreadUncertainty } from './numeric.ts';

export function interpolateYieldBps(curve: GovernmentYieldCurve, horizonYears: number): number {
  const target = Math.max(0, horizonYears);
  const points = [...curve.points].sort((a, b) => a.tenorYears - b.tenorYears);
  if (points.length === 0) {
    throw new Error('yield curve must contain at least one point');
  }
  if (target <= points[0]!.tenorYears) {
    return clampBps(points[0]!.yieldBps);
  }
  const last = points[points.length - 1]!;
  if (target >= last.tenorYears) {
    return clampBps(last.yieldBps);
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i]!;
    const right = points[i + 1]!;
    if (target >= left.tenorYears && target <= right.tenorYears) {
      const span = right.tenorYears - left.tenorYears;
      if (span <= 0) {
        return clampBps(left.yieldBps);
      }
      const weight = (target - left.tenorYears) / span;
      return clampBps(left.yieldBps + weight * (right.yieldBps - left.yieldBps));
    }
  }
  return clampBps(last.yieldBps);
}

export function riskFreeFromCurve(
  curve: GovernmentYieldCurve,
  horizonYears: number,
  uncertaintyHalfWidthBps = 25,
): RateUncertaintyBps {
  const mid = interpolateYieldBps(curve, horizonYears);
  return spreadUncertainty(mid, uncertaintyHalfWidthBps);
}
