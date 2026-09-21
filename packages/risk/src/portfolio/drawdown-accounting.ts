import { ratioFromUnits, RATIO_UNIT, shareOf, type Ratio } from '../arithmetic.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DailyLossLedger, ReconciledEquityPoint, StrategyDrawdownFact } from './types.ts';

export function utcDayKey(at: UtcInstant): string {
  return at.slice(0, 10);
}

export function adjustedEquityMinor(point: ReconciledEquityPoint): bigint {
  return point.equityMinor - point.cumulativeNetFlowMinor;
}

export function computePortfolioDrawdown(points: readonly ReconciledEquityPoint[]): Ratio | null {
  if (points.length < 2) {
    return null;
  }
  let peak = adjustedEquityMinor(points[0]!);
  let maxUnits = 0n;
  for (const point of points) {
    const adjusted = adjustedEquityMinor(point);
    if (adjusted > peak) {
      peak = adjusted;
    }
    if (peak > 0n) {
      const draw = ((peak - adjusted) * RATIO_UNIT) / peak;
      if (draw > maxUnits) {
        maxUnits = draw;
      }
    }
  }
  return ratioFromUnits(maxUnits);
}

export function computeStrategyDrawdowns(input: {
  readonly strategyEquitySeries: Readonly<Record<string, readonly ReconciledEquityPoint[]>>;
}): readonly StrategyDrawdownFact[] {
  const facts: StrategyDrawdownFact[] = [];
  for (const [strategyId, series] of Object.entries(input.strategyEquitySeries)) {
    if (series.length === 0) {
      continue;
    }
    let peak = adjustedEquityMinor(series[0]!);
    let current = adjustedEquityMinor(series[series.length - 1]!);
    for (const point of series) {
      const adjusted = adjustedEquityMinor(point);
      if (adjusted > peak) {
        peak = adjusted;
      }
      current = adjusted;
    }
    const drawdownRatio = peak > 0n ? shareOf(peak - current < 0n ? 0n : peak - current, peak) : ratioFromUnits(0n);
    facts.push(
      Object.freeze({
        strategyId,
        peakEquityMinor: peak,
        currentEquityMinor: current,
        drawdownRatio,
      }),
    );
  }
  return Object.freeze(facts);
}

export function buildDailyLossLedger(input: {
  readonly utcDay: string;
  readonly realizedLossMinor: bigint;
  readonly totalLossMinor: bigint;
  readonly consecutiveLossCount: number;
  readonly lastResetAt: UtcInstant;
}): DailyLossLedger {
  return Object.freeze({
    utcDay: input.utcDay,
    realizedLossMinor: input.realizedLossMinor < 0n ? -input.realizedLossMinor : input.realizedLossMinor,
    totalLossMinor: input.totalLossMinor < 0n ? -input.totalLossMinor : input.totalLossMinor,
    consecutiveLossCount: input.consecutiveLossCount,
    lastResetAt: input.lastResetAt,
  });
}

export function rollDailyLossLedger(input: {
  readonly prior: DailyLossLedger | null;
  readonly now: UtcInstant;
  readonly realizedPnlMinor: bigint;
  readonly totalPnlMinor: bigint;
}): DailyLossLedger {
  const day = utcDayKey(input.now);
  const prior = input.prior;
  if (!prior || prior.utcDay !== day) {
    const realizedLoss = input.realizedPnlMinor < 0n ? -input.realizedPnlMinor : 0n;
    const totalLoss = input.totalPnlMinor < 0n ? -input.totalPnlMinor : 0n;
    return buildDailyLossLedger({
      utcDay: day,
      realizedLossMinor: realizedLoss,
      totalLossMinor: totalLoss,
      consecutiveLossCount: input.realizedPnlMinor < 0n ? 1 : 0,
      lastResetAt: input.now,
    });
  }
  const realizedLoss =
    input.realizedPnlMinor < 0n ? prior.realizedLossMinor + (-input.realizedPnlMinor) : prior.realizedLossMinor;
  const totalLoss =
    input.totalPnlMinor < 0n ? prior.totalLossMinor + (-input.totalPnlMinor) : prior.totalLossMinor;
  const consecutive =
    input.realizedPnlMinor < 0n ? prior.consecutiveLossCount + 1 : 0;
  return buildDailyLossLedger({
    utcDay: day,
    realizedLossMinor: realizedLoss,
    totalLossMinor: totalLoss,
    consecutiveLossCount: consecutive,
    lastResetAt: prior.lastResetAt,
  });
}

export function depositsAndWithdrawalsExcludedFromPnl(): readonly string[] {
  return Object.freeze([
    'deposits increase cumulativeNetFlowMinor and are excluded from drawdown P&L',
    'withdrawals decrease cumulativeNetFlowMinor and are excluded from drawdown P&L',
    'unsettled estimates are not used for realized daily loss accounting',
  ]);
}
