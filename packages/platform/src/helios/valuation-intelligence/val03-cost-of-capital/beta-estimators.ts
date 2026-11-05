/**
 * Multi-estimator beta surface — do not trust a single historical regression.
 */

import { VAL03_BETA_BPS_SCALE } from './taxonomy.ts';
import type { BetaEstimate, CostOfCapitalInput } from './types.ts';
import { clampBps, medianOf, spreadUncertainty } from './numeric.ts';

function blumeAdjustedBetaBps(rawBetaBps: number): number {
  return clampBps(
    Math.round(0.67 * rawBetaBps + 0.33 * VAL03_BETA_BPS_SCALE),
    0,
    30_000,
  );
}

function shrinkageBetaBps(input: CostOfCapitalInput): number {
  const target = input.shrinkageTargetBetaBps ?? input.sectorBetaBps;
  const intensityBps = input.shrinkageIntensityBps ?? 3_500;
  const intensity = clampBps(intensityBps, 0, VAL03_BETA_BPS_SCALE) / VAL03_BETA_BPS_SCALE;
  return clampBps(Math.round(input.rawBetaBps * (1 - intensity) + target * intensity), 0, 30_000);
}

export function buildBetaEstimates(input: CostOfCapitalInput): readonly BetaEstimate[] {
  const raw = clampBps(input.rawBetaBps, -5_000, 30_000);
  const adjusted = blumeAdjustedBetaBps(raw);
  const sector = clampBps(input.sectorBetaBps, -5_000, 30_000);
  const bottomUp = clampBps(input.bottomUpBetaBps, -5_000, 30_000);
  const shrinkage = shrinkageBetaBps(input);

  const baseRefs = Object.freeze([...input.sourceRefs, 'helios:val03:beta']);

  return Object.freeze([
    Object.freeze({
      kind: 'RAW_REGRESSION' as const,
      betaBps: raw,
      uncertainty: spreadUncertainty(raw, 900),
      sourceRefs: Object.freeze([...baseRefs, 'estimator:raw_regression']),
    }),
    Object.freeze({
      kind: 'BLUME_ADJUSTED' as const,
      betaBps: adjusted,
      uncertainty: spreadUncertainty(adjusted, 700),
      sourceRefs: Object.freeze([...baseRefs, 'estimator:blume_adjusted']),
    }),
    Object.freeze({
      kind: 'SECTOR' as const,
      betaBps: sector,
      uncertainty: spreadUncertainty(sector, 600),
      sourceRefs: Object.freeze([...baseRefs, `estimator:sector:${input.sector}`]),
    }),
    Object.freeze({
      kind: 'BOTTOM_UP' as const,
      betaBps: bottomUp,
      uncertainty: spreadUncertainty(bottomUp, 500),
      sourceRefs: Object.freeze([...baseRefs, 'estimator:bottom_up']),
    }),
    Object.freeze({
      kind: 'SHRINKAGE' as const,
      betaBps: shrinkage,
      uncertainty: spreadUncertainty(shrinkage, 450),
      sourceRefs: Object.freeze([...baseRefs, 'estimator:shrinkage']),
    }),
  ]);
}

export function blendBetaEstimates(estimates: readonly BetaEstimate[]): {
  readonly blendedBetaBps: number;
  readonly blendedBetaUncertainty: ReturnType<typeof spreadUncertainty>;
  readonly disagreementBps: number;
} {
  const mids = estimates.map((e) => e.betaBps);
  const blendedBetaBps = medianOf(mids);
  const disagreementBps = Math.max(...mids) - Math.min(...mids);
  const halfWidth = 400 + Math.round(disagreementBps / 4);
  return Object.freeze({
    blendedBetaBps,
    blendedBetaUncertainty: spreadUncertainty(blendedBetaBps, halfWidth),
    disagreementBps,
  });
}
