import { RATIO_UNIT, integerSqrt, ratioFromUnits, type Ratio } from '../../risk/src/arithmetic.ts';

/**
 * Analytical statistics use the Risk Engine's deterministic scale-8 ratio.
 * Money remains integer minor units. These figures are historical
 * engineering statistics, not future-return guarantees.
 *
 * Volatility: sample standard deviation of simple period returns
 * (`SAMPLE_STDDEV_INTEGER_RETURNS`), matching `packages/risk` analytics.
 *
 * Downside volatility: semideviation from zero over all periods
 * (`SEMIDEVIATION_FROM_ZERO_POPULATION`), not a Sortino ratio.
 *
 * Annualized return: linear extrapolation of total return to a 365-day year
 * (`LINEAR_EXTRAPOLATION_365_DAY`). Not compound annual growth (CAGR).
 *
 * Risk-adjusted: total return divided by period volatility when volatility > 0.
 * Not a Sharpe ratio (no risk-free rate, not annualized).
 */
export type PerformanceMetrics = {
  readonly startingCapitalMinor: bigint;
  readonly endingCapitalMinor: bigint;
  readonly totalReturn: Ratio;
  readonly annualizedReturn: Ratio | null;
  readonly annualizedReturnMethod: 'LINEAR_EXTRAPOLATION_365_DAY' | null;
  readonly maximumDrawdown: Ratio;
  readonly volatility: Ratio | null;
  readonly volatilityMethod: 'SAMPLE_STDDEV_INTEGER_RETURNS' | null;
  readonly downsideVolatility: Ratio | null;
  readonly downsideVolatilityMethod: 'SEMIDEVIATION_FROM_ZERO_POPULATION' | null;
  readonly riskAdjusted: Ratio | null;
  readonly turnoverBps: bigint;
  readonly feesMinor: bigint;
  readonly cashUtilization: Ratio;
  readonly tradeCount: number;
  readonly winCount: number;
  readonly lossCount: number;
  readonly futureReturnGuarantee: false;
};

export type EquityPoint = {
  readonly at: string;
  readonly totalMinor: bigint;
};

function mean(values: readonly bigint[]): bigint {
  if (values.length === 0) {
    return 0n;
  }
  return values.reduce((sum, value) => sum + value, 0n) / BigInt(values.length);
}

/** Sample stdev of scale-8 simple returns; matches `packages/risk` analytics. */
function sampleStdevRatioUnits(returns: readonly bigint[]): bigint | null {
  if (returns.length < 2) {
    return null;
  }
  const n = BigInt(returns.length);
  const avg = mean(returns);
  const squared = returns.reduce((sum, value) => {
    const delta = value - avg;
    return sum + delta * delta;
  }, 0n);
  const variance = squared / (n - 1n);
  return integerSqrt(variance < 0n ? 0n : variance);
}

/** Semideviation from zero across all periods (population denominator). */
function semideviationFromZeroRatioUnits(returns: readonly bigint[]): bigint | null {
  if (returns.length < 2) {
    return null;
  }
  const n = BigInt(returns.length);
  const squared = returns.reduce((sum, value) => (value < 0n ? sum + value * value : sum), 0n);
  if (squared === 0n) {
    return 0n;
  }
  return integerSqrt(squared / n);
}

function periodReturns(points: readonly EquityPoint[]): readonly bigint[] {
  const out: bigint[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    if (!prev || !current || prev.totalMinor <= 0n) {
      continue;
    }
    out.push(((current.totalMinor - prev.totalMinor) * RATIO_UNIT) / prev.totalMinor);
  }
  return out;
}

export function calculateMetrics(input: {
  readonly startingCapitalMinor: bigint;
  readonly endingCapitalMinor: bigint;
  readonly equity: readonly EquityPoint[];
  readonly feesMinor: bigint;
  readonly tradedNotionalMinor: bigint;
  readonly cashMinorSeries: readonly bigint[];
  readonly tradeCount: number;
  readonly winCount: number;
  readonly lossCount: number;
  readonly observationDays: number;
}): PerformanceMetrics {
  const totalReturn =
    input.startingCapitalMinor <= 0n
      ? ratioFromUnits(0n)
      : ratioFromUnits(((input.endingCapitalMinor - input.startingCapitalMinor) * RATIO_UNIT) / input.startingCapitalMinor);
  let peak = input.startingCapitalMinor;
  let maxDrawdown = 0n;
  for (const point of input.equity) {
    if (point.totalMinor > peak) {
      peak = point.totalMinor;
    }
    if (peak > 0n) {
      const draw = ((peak - point.totalMinor) * RATIO_UNIT) / peak;
      if (draw > maxDrawdown) {
        maxDrawdown = draw;
      }
    }
  }
  const returns = periodReturns(input.equity);
  const stdevUnits = sampleStdevRatioUnits(returns);
  const volatility = stdevUnits === null ? null : ratioFromUnits(stdevUnits);
  const downUnits = semideviationFromZeroRatioUnits(returns);
  const downsideVolatility = downUnits === null ? null : ratioFromUnits(downUnits);
  const riskAdjusted =
    volatility && volatility.units > 0n ? ratioFromUnits((totalReturn.units * RATIO_UNIT) / volatility.units) : null;
  const annualized =
    input.observationDays >= 30 && input.startingCapitalMinor > 0n
      ? ratioFromUnits((totalReturn.units * 365n) / BigInt(input.observationDays))
      : null;
  const avgCash =
    input.cashMinorSeries.length === 0
      ? 0n
      : input.cashMinorSeries.reduce((sum, value) => sum + value, 0n) / BigInt(input.cashMinorSeries.length);
  const cashUtilization =
    input.endingCapitalMinor <= 0n ? ratioFromUnits(0n) : ratioFromUnits((avgCash * RATIO_UNIT) / input.endingCapitalMinor);
  const turnoverBps =
    input.startingCapitalMinor <= 0n ? 0n : (input.tradedNotionalMinor * 10_000n) / input.startingCapitalMinor;
  return Object.freeze({
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: input.endingCapitalMinor,
    totalReturn,
    annualizedReturn: annualized,
    annualizedReturnMethod: annualized === null ? null : 'LINEAR_EXTRAPOLATION_365_DAY',
    maximumDrawdown: ratioFromUnits(maxDrawdown),
    volatility,
    volatilityMethod: volatility === null ? null : 'SAMPLE_STDDEV_INTEGER_RETURNS',
    downsideVolatility,
    downsideVolatilityMethod:
      downsideVolatility === null ? null : 'SEMIDEVIATION_FROM_ZERO_POPULATION',
    riskAdjusted,
    turnoverBps,
    feesMinor: input.feesMinor,
    cashUtilization,
    tradeCount: input.tradeCount,
    winCount: input.winCount,
    lossCount: input.lossCount,
    futureReturnGuarantee: false,
  });
}
