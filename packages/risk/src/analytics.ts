import { integerSqrt, RATIO_UNIT, ratioFromUnits, ratioZero, type Ratio } from './arithmetic.ts';
import type { ExtremeGoalAnalysis, ValuationObservation } from './types.ts';

export type VolatilityEstimate = {
  readonly window: number;
  readonly observations: number;
  readonly method: 'SAMPLE_STDDEV_INTEGER_RETURNS';
  readonly precision: 'RATIO_SCALE_8';
  readonly modelVersion: string;
  readonly value: Ratio;
  readonly sufficient: true;
};

export type InsufficientAnalytics = {
  readonly sufficient: false;
  readonly reason: string;
  readonly observations: number;
  readonly method: 'SAMPLE_STDDEV_INTEGER_RETURNS' | 'MAX_DRAWDOWN';
};

export function estimateVolatility(
  observations: readonly ValuationObservation[],
  modelVersion: string,
): VolatilityEstimate | InsufficientAnalytics {
  if (observations.length < 3) {
    return {
      sufficient: false,
      reason: 'volatility requires at least three valuation observations',
      observations: observations.length,
      method: 'SAMPLE_STDDEV_INTEGER_RETURNS',
    };
  }
  const returns: bigint[] = [];
  for (let i = 1; i < observations.length; i += 1) {
    const prior = observations[i - 1]!.portfolioMarketValueMinor;
    const current = observations[i]!.portfolioMarketValueMinor;
    if (prior <= 0n) {
      return {
        sufficient: false,
        reason: 'non-positive valuation observation',
        observations: observations.length,
        method: 'SAMPLE_STDDEV_INTEGER_RETURNS',
      };
    }
    returns.push(((current - prior) * RATIO_UNIT) / prior);
  }
  const n = BigInt(returns.length);
  const mean = returns.reduce((sum, value) => sum + value, 0n) / n;
  const squared = returns.reduce((sum, value) => {
    const delta = value - mean;
    return sum + delta * delta;
  }, 0n);
  const variance = squared / (n - 1n);
  return {
    window: observations.length,
    observations: observations.length,
    method: 'SAMPLE_STDDEV_INTEGER_RETURNS',
    precision: 'RATIO_SCALE_8',
    modelVersion,
    value: ratioFromUnits(integerSqrt(variance)),
    sufficient: true,
  };
}

export type DrawdownEstimate = {
  readonly sufficient: true;
  readonly maxDrawdown: Ratio;
  readonly method: 'PEAK_TO_TROUGH';
  readonly observations: number;
  readonly futureLossGuarantee: false;
};

export function estimateMaxDrawdown(
  observations: readonly ValuationObservation[],
): DrawdownEstimate | InsufficientAnalytics {
  if (observations.length < 2) {
    return {
      sufficient: false,
      reason: 'drawdown requires at least two valuation observations',
      observations: observations.length,
      method: 'MAX_DRAWDOWN',
    };
  }
  let peak = observations[0]!.portfolioMarketValueMinor;
  let maxUnits = 0n;
  for (const row of observations) {
    if (row.portfolioMarketValueMinor > peak) {
      peak = row.portfolioMarketValueMinor;
    }
    if (peak > 0n) {
      const draw = ((peak - row.portfolioMarketValueMinor) * RATIO_UNIT) / peak;
      if (draw > maxUnits) {
        maxUnits = draw;
      }
    }
  }
  return {
    sufficient: true,
    maxDrawdown: ratioFromUnits(maxUnits),
    method: 'PEAK_TO_TROUGH',
    observations: observations.length,
    futureLossGuarantee: false,
  };
}

export function analyzeExtremeGoal(input: {
  readonly goalText: string;
  readonly baselineMinor: bigint;
  readonly targetMinor: bigint;
  readonly intervalDays: bigint;
  readonly maxImpliedGrowth: Ratio;
}): ExtremeGoalAnalysis {
  const implied =
    input.baselineMinor <= 0n
      ? ratioZero()
      : ratioFromUnits(((input.targetMinor - input.baselineMinor) * RATIO_UNIT) / input.baselineMinor);
  const compatible = implied.units <= input.maxImpliedGrowth.units;
  return Object.freeze({
    preservedGoal: input.goalText,
    baselineMinor: input.baselineMinor,
    targetMinor: input.targetMinor,
    intervalDays: input.intervalDays,
    impliedGrowth: implied,
    guaranteed: false,
    limitsRelaxed: false,
    compatibleWithCurrentLimits: compatible,
    uncertaintyNotes: Object.freeze([
      'Implied growth is an arithmetic identity, not a forecast',
      'Risk limits are not relaxed because a user wants a high return',
      'The planner may conclude the target is incompatible with current constraints',
    ]),
  });
}
