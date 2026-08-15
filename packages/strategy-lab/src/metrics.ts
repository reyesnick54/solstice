import { RATIO_UNIT, integerSqrt, ratioFromUnits, type Ratio } from '../../risk/src/arithmetic.ts';

/**
 * Analytical statistics use the Risk Engine's deterministic scale-8 ratio.
 * Money remains integer minor units. These figures are historical
 * engineering statistics, not future-return guarantees.
 */
export type PerformanceMetrics = {
  readonly startingCapitalMinor: bigint;
  readonly endingCapitalMinor: bigint;
  readonly totalReturn: Ratio;
  readonly annualizedReturn: Ratio | null;
  readonly maximumDrawdown: Ratio;
  readonly volatility: Ratio | null;
  readonly downsideVolatility: Ratio | null;
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
  const avg = mean(returns);
  const variance =
    returns.length === 0
      ? 0n
      : mean(returns.map((value) => {
          const delta = value - avg;
          return delta * delta;
        })) / RATIO_UNIT;
  const volatility = returns.length >= 2 ? ratioFromUnits(integerSqrt(variance < 0n ? 0n : variance)) : null;
  const downside = returns.filter((value) => value < 0n);
  const downVar =
    downside.length === 0
      ? 0n
      : mean(downside.map((value) => (value * value) / RATIO_UNIT));
  const downsideVolatility = downside.length >= 2 ? ratioFromUnits(integerSqrt(downVar < 0n ? 0n : downVar)) : null;
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
    maximumDrawdown: ratioFromUnits(maxDrawdown),
    volatility,
    downsideVolatility,
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
