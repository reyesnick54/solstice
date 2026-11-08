/**
 * HELIOS Forward Alpha ALPHA09 — deterministic performance, risk, and tail measurements.
 */

import { integerSqrt, RATIO_UNIT, ratioFromUnits, type Ratio } from '@solstice/risk';

import type {
  ForwardAlpha09MeasureInput,
  ForwardPerformanceState,
  ForwardRiskState,
  ForwardTailState,
} from './types.ts';
import { ALPHA09_TAIL_CONFIDENCE_BPS } from './taxonomy.ts';

function meanUnits(values: readonly bigint[]): bigint | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0n) / BigInt(values.length);
}

function sampleStdevUnits(values: readonly bigint[]): bigint | null {
  if (values.length < 2) {
    return null;
  }
  const n = BigInt(values.length);
  const avg = meanUnits(values);
  if (avg === null) {
    return null;
  }
  const squared = values.reduce((sum, value) => {
    const delta = value - avg;
    return sum + delta * delta;
  }, 0n);
  const variance = squared / (n - 1n);
  return integerSqrt(variance < 0n ? 0n : variance);
}

function downsideDeviationUnits(
  values: readonly bigint[],
  targetUnits: bigint,
): bigint | null {
  if (values.length < 2) {
    return null;
  }
  const n = BigInt(values.length);
  const squared = values.reduce((sum, value) => {
    if (value >= targetUnits) {
      return sum;
    }
    const delta = value - targetUnits;
    return sum + delta * delta;
  }, 0n);
  if (squared === 0n) {
    return 0n;
  }
  return integerSqrt(squared / n);
}

function equityCurveFromReturns(startingMinor: bigint, returns: readonly bigint[]): readonly bigint[] {
  const out: bigint[] = [startingMinor];
  let equity = startingMinor;
  for (const r of returns) {
    if (equity <= 0n) {
      out.push(equity);
      continue;
    }
    equity += (equity * r) / RATIO_UNIT;
    out.push(equity);
  }
  return Object.freeze(out);
}

function maxDrawdownAndDuration(equity: readonly bigint[]): { maxDrawdownUnits: bigint; durationPeriods: number } {
  if (equity.length < 2) {
    return { maxDrawdownUnits: 0n, durationPeriods: 0 };
  }
  let peak = equity[0] ?? 0n;
  let maxDrawdown = 0n;
  let duration = 0;
  let currentDuration = 0;
  for (const value of equity) {
    if (value > peak) {
      peak = value;
      currentDuration = 0;
    } else if (peak > 0n) {
      currentDuration += 1;
      if (currentDuration > duration) {
        duration = currentDuration;
      }
      const draw = ((peak - value) * RATIO_UNIT) / peak;
      if (draw > maxDrawdown) {
        maxDrawdown = draw;
      }
    }
  }
  return { maxDrawdownUnits: maxDrawdown, durationPeriods: duration };
}

function annualizeFactor(observationDays: number, periodCount: number): bigint | null {
  if (observationDays < 30 || periodCount < 2) {
    return null;
  }
  return integerSqrt((BigInt(periodCount) * 365n * RATIO_UNIT) / BigInt(observationDays));
}

function ratioQuotient(numeratorUnits: bigint, denominatorUnits: bigint): Ratio | null {
  if (denominatorUnits === 0n) {
    return null;
  }
  return ratioFromUnits((numeratorUnits * RATIO_UNIT) / denominatorUnits);
}

function tradeWinLossStats(trades: readonly { readonly realizedPnlMinor: bigint }[]): {
  winCount: number;
  lossCount: number;
  grossProfitMinor: bigint;
  grossLossMinor: bigint;
  avgWinMinor: bigint;
  avgLossMinor: bigint;
  largestGainMinor: bigint;
  largestLossMinor: bigint;
} {
  let winCount = 0;
  let lossCount = 0;
  let grossProfit = 0n;
  let grossLoss = 0n;
  let largestGain = 0n;
  let largestLoss = 0n;
  let winSum = 0n;
  let lossSum = 0n;
  for (const trade of trades) {
    const pnl = trade.realizedPnlMinor;
    if (pnl > 0n) {
      winCount += 1;
      grossProfit += pnl;
      winSum += pnl;
      if (pnl > largestGain) {
        largestGain = pnl;
      }
    } else if (pnl < 0n) {
      lossCount += 1;
      const loss = -pnl;
      grossLoss += loss;
      lossSum += loss;
      if (loss > largestLoss) {
        largestLoss = loss;
      }
    }
  }
  const avgWin = winCount === 0 ? 0n : winSum / BigInt(winCount);
  const avgLoss = lossCount === 0 ? 0n : lossSum / BigInt(lossCount);
  return {
    winCount,
    lossCount,
    grossProfitMinor: grossProfit,
    grossLossMinor: grossLoss,
    avgWinMinor: avgWin,
    avgLossMinor: avgLoss,
    largestGainMinor: largestGain,
    largestLossMinor: largestLoss,
  };
}

function historicalExpectedShortfall(returns: readonly bigint[], confidenceBps: number): bigint | null {
  if (returns.length < 8) {
    return null;
  }
  const sorted = [...returns].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const tailCount = Math.max(1, Math.floor((sorted.length * confidenceBps) / 10_000));
  const tail = sorted.slice(0, tailCount);
  const mean = tail.reduce((sum, value) => sum + value, 0n) / BigInt(tail.length);
  return mean;
}

function sampleSkewKurtosis(returns: readonly bigint[]): { skew: number | null; kurtosisExcess: number | null } {
  if (returns.length < 4) {
    return { skew: null, kurtosisExcess: null };
  }
  const xs = returns.map((r) => Number(r) / Number(RATIO_UNIT));
  const n = xs.length;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const m2 = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (n - 1);
  if (m2 <= 1e-18) {
    return { skew: null, kurtosisExcess: null };
  }
  const m3 = xs.reduce((acc, x) => acc + (x - m) ** 3, 0) / n;
  const m4 = xs.reduce((acc, x) => acc + (x - m) ** 4, 0) / n;
  const skew = m3 / m2 ** 1.5;
  const kurtosisExcess = m4 / (m2 * m2) - 3;
  return { skew, kurtosisExcess };
}

export function measureForwardPerformance(input: ForwardAlpha09MeasureInput): ForwardPerformanceState {
  const totalReturn =
    input.startingCapitalMinor <= 0n
      ? ratioFromUnits(0n)
      : ratioFromUnits(
          ((input.endingCapitalMinor - input.startingCapitalMinor) * RATIO_UNIT) / input.startingCapitalMinor,
        );

  const annualized =
    input.observationDays >= 30 && input.startingCapitalMinor > 0n
      ? ratioFromUnits((totalReturn.units * 365n) / BigInt(input.observationDays))
      : null;

  const tradeStats = tradeWinLossStats(input.trades);
  const decisive = tradeStats.winCount + tradeStats.lossCount;
  const winRate =
    decisive === 0 ? null : ratioFromUnits((BigInt(tradeStats.winCount) * RATIO_UNIT) / BigInt(decisive));
  const payoffRatio =
    tradeStats.avgLossMinor === 0n
      ? null
      : ratioQuotient(tradeStats.avgWinMinor, tradeStats.avgLossMinor);
  const profitFactor =
    tradeStats.grossLossMinor === 0n
      ? null
      : ratioQuotient(tradeStats.grossProfitMinor, tradeStats.grossLossMinor);

  return Object.freeze({
    schema: 'sunrey.helios.forward-alpha.forward-performance-state.v1',
    totalReturn,
    annualizedReturn: annualized,
    annualizedReturnMethod: annualized === null ? null : 'LINEAR_EXTRAPOLATION_365_DAY',
    winRate,
    payoffRatio,
    profitFactor,
    largestGainMinor: tradeStats.largestGainMinor,
    largestLossMinor: tradeStats.largestLossMinor,
    periodCount: input.periodReturns.length,
    tradeCount: input.trades.length,
    futureReturnGuarantee: false,
  });
}

export function measureForwardRisk(
  input: ForwardAlpha09MeasureInput,
  performanceAnnualizedUnits: bigint | null,
): ForwardRiskState {
  const rf = input.riskFreePeriodReturnUnits ?? 0n;
  const excess = input.periodReturns.map((r) => r - rf);
  const stdev = sampleStdevUnits(input.periodReturns);
  const volatility = stdev === null ? null : ratioFromUnits(stdev);
  const downDevUnits = downsideDeviationUnits(input.periodReturns, rf);
  const downsideDeviation = downDevUnits === null ? null : ratioFromUnits(downDevUnits);

  const meanExcess = meanUnits(excess);
  const annFactor = annualizeFactor(input.observationDays, input.periodReturns.length);

  let sharpe: Ratio | null = null;
  if (meanExcess !== null && stdev !== null && stdev > 0n && annFactor !== null) {
    const perPeriodSharpe = (meanExcess * RATIO_UNIT) / stdev;
    sharpe = ratioFromUnits((perPeriodSharpe * annFactor) / RATIO_UNIT);
  }

  let sortino: Ratio | null = null;
  if (meanExcess !== null && downDevUnits !== null && downDevUnits > 0n && annFactor !== null) {
    const perPeriodSortino = (meanExcess * RATIO_UNIT) / downDevUnits;
    sortino = ratioFromUnits((perPeriodSortino * annFactor) / RATIO_UNIT);
  }

  const equity = equityCurveFromReturns(input.startingCapitalMinor, input.periodReturns);
  const { maxDrawdownUnits, durationPeriods } = maxDrawdownAndDuration(equity);
  const maximumDrawdown = ratioFromUnits(maxDrawdownUnits);

  let calmar: Ratio | null = null;
  if (
    performanceAnnualizedUnits !== null &&
    maxDrawdownUnits > 0n &&
    performanceAnnualizedUnits > 0n
  ) {
    calmar = ratioQuotient(performanceAnnualizedUnits, maxDrawdownUnits);
  }

  let informationRatio: Ratio | null = null;
  if (
    input.benchmarkPeriodReturns &&
    input.benchmarkPeriodReturns.length === input.periodReturns.length &&
    input.periodReturns.length >= 2
  ) {
    const active: bigint[] = [];
    for (let i = 0; i < input.periodReturns.length; i += 1) {
      active.push(input.periodReturns[i]! - input.benchmarkPeriodReturns[i]!);
    }
    const activeMean = meanUnits(active);
    const tracking = sampleStdevUnits(active);
    if (activeMean !== null && tracking !== null && tracking > 0n) {
      informationRatio = ratioQuotient(activeMean, tracking);
    }
  }

  return Object.freeze({
    schema: 'sunrey.helios.forward-alpha.forward-risk-state.v1',
    volatility,
    volatilityMethod: volatility === null ? null : 'SAMPLE_STDDEV_INTEGER_RETURNS',
    sharpe,
    sharpeMethod: sharpe === null ? null : 'EXCESS_RETURN_OVER_SAMPLE_STDDEV_ANNUALIZED_SQRT',
    sortino,
    sortinoMethod: sortino === null ? null : 'EXCESS_RETURN_OVER_DOWNSIDE_DEVIATION_ANNUALIZED_SQRT',
    informationRatio,
    informationRatioMethod: informationRatio === null ? null : 'ACTIVE_RETURN_OVER_TRACKING_ERROR',
    calmar,
    calmarMethod: calmar === null ? null : 'ANNUALIZED_RETURN_OVER_MAX_DRAWDOWN',
    maximumDrawdown,
    drawdownDurationPeriods: durationPeriods,
    downsideDeviation,
    downsideDeviationMethod: downsideDeviation === null ? null : 'TARGET_SEMIDEVIATION_POPULATION',
    futureLossGuarantee: false,
  });
}

export function measureForwardTail(input: ForwardAlpha09MeasureInput): ForwardTailState {
  const esUnits = historicalExpectedShortfall(input.periodReturns, ALPHA09_TAIL_CONFIDENCE_BPS);
  const { skew, kurtosisExcess } = sampleSkewKurtosis(input.periodReturns);
  return Object.freeze({
    schema: 'sunrey.helios.forward-alpha.forward-tail-state.v1',
    tailConfidenceBps: ALPHA09_TAIL_CONFIDENCE_BPS,
    expectedShortfall: esUnits === null ? null : ratioFromUnits(esUnits),
    expectedShortfallMethod: esUnits === null ? null : 'HISTORICAL_TAIL_MEAN',
    skew,
    kurtosisExcess,
    distributionMomentsMethod: skew === null ? null : 'SAMPLE_MOMENTS_ENGINEERING',
    futureTailGuarantee: false,
  });
}
