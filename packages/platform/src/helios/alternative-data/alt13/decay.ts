/**
 * HELIOS ALT13 — signal half-life, lag-to-usefulness, and regime sensitivity.
 */

import { pearsonCorrelation } from './metrics.ts';
import type { Alt13EvaluationRow, SignalDecayPoint, SignalDecayState } from './types.ts';

function laggedSeries(values: readonly number[], lag: number): number[] {
  if (lag <= 0) return [...values];
  const out: number[] = [];
  for (let i = lag; i < values.length; i += 1) {
    out.push(values[i - lag]!);
  }
  return out;
}

export function buildSignalDecayState(input: {
  readonly featureId: string;
  readonly rows: readonly Alt13EvaluationRow[];
  readonly targetKey: keyof Alt13EvaluationRow['targets'];
  readonly maxLag?: number;
}): SignalDecayState {
  const maxLag = input.maxLag ?? 8;
  const feature: number[] = [];
  const target: number[] = [];
  const regimes = new Set<string>();

  for (const row of input.rows) {
    const f = row.altFeatures[input.featureId];
    const y = row.targets[input.targetKey];
    if (f === undefined || y === undefined) continue;
    feature.push(f);
    target.push(y);
    regimes.add(row.regimeId);
  }

  const curve: SignalDecayPoint[] = [];
  let bestLag = 0;
  let bestUtility = -Infinity;

  for (let lag = 0; lag <= maxLag; lag += 1) {
    const lagged = laggedSeries(feature, lag);
    const alignedTarget = target.slice(lag);
    const rho = pearsonCorrelation(lagged, alignedTarget);
    const utility = rho === null ? 0 : Math.abs(rho);
    curve.push(Object.freeze({ lagPeriods: lag, predictiveUtility: utility }));
    if (utility > bestUtility) {
      bestUtility = utility;
      bestLag = lag;
    }
  }

  const halfLife = estimateHalfLife(curve);
  const stableHorizon = estimateStableHorizon(curve);

  return Object.freeze({
    featureId: input.featureId,
    lagToUsefulnessPeriods: bestUtility > 0.05 ? bestLag : null,
    halfLifePeriods: halfLife,
    stableHorizonPeriods: stableHorizon,
    decayCurve: Object.freeze(curve),
    regimeDependent: regimes.size > 1,
    grantsExecutionAuthority: false,
  });
}

function estimateHalfLife(curve: readonly SignalDecayPoint[]): number | null {
  if (curve.length < 2) return null;
  const peak = Math.max(...curve.map((c) => c.predictiveUtility));
  if (peak <= 0) return null;
  const threshold = peak / 2;
  for (let i = 1; i < curve.length; i += 1) {
    if (curve[i]!.predictiveUtility <= threshold) {
      return i;
    }
  }
  return curve[curve.length - 1]!.lagPeriods;
}

function estimateStableHorizon(curve: readonly SignalDecayPoint[]): number | null {
  if (curve.length === 0) return null;
  const peak = Math.max(...curve.map((c) => c.predictiveUtility));
  if (peak <= 0) return null;
  const floor = peak * 0.75;
  let lastStable = 0;
  for (const point of curve) {
    if (point.predictiveUtility >= floor) {
      lastStable = point.lagPeriods;
    }
  }
  return lastStable > 0 ? lastStable : null;
}
