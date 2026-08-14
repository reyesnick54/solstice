import type { TournamentMetrics } from '../../contracts/src/strategy-types.ts';

export type StrategyPnLPoint = {
  readonly strategyId: string;
  readonly pnlMinorUnits: bigint;
  readonly turnoverMicros: bigint;
  readonly slippageBps: bigint;
};

/**
 * Tournament metrics only. Investment-account scoped. No blended wealth
 * return is computed. Sharpe-like is an integer ratio, not a percentage.
 */
export function recordTournamentMetrics(
  points: readonly StrategyPnLPoint[],
  currency: string,
): readonly TournamentMetrics[] {
  const byStrategy = new Map<string, StrategyPnLPoint[]>();
  for (const point of points) {
    const list = byStrategy.get(point.strategyId) ?? [];
    list.push(point);
    byStrategy.set(point.strategyId, list);
  }
  const out: TournamentMetrics[] = [];
  for (const [strategyId, rows] of byStrategy) {
    let sum = 0n;
    let abs = 0n;
    let peak = 0n;
    let equity = 0n;
    let maxDd = 0n;
    let turnover = 0n;
    let slip = 0n;
    for (const row of rows) {
      sum += row.pnlMinorUnits;
      equity += row.pnlMinorUnits;
      const a = row.pnlMinorUnits < 0n ? -row.pnlMinorUnits : row.pnlMinorUnits;
      abs += a;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDd) maxDd = dd;
      turnover += row.turnoverMicros;
      slip += row.slippageBps;
    }
    const n = BigInt(rows.length);
    const mad = n === 0n ? 0n : abs / n;
    const sharpeLike =
      mad === 0n
        ? null
        : { numerator: sum < 0n ? -sum : sum, denominator: mad };
    out.push(
      Object.freeze({
        strategyId,
        scopeLabel: 'INVESTMENT_ACCOUNT_ONLY',
        periodPnlMinorUnits: sum,
        currency,
        volatilityMadBps: mad,
        drawdownMinorUnits: maxDd,
        sharpeLikeRatio: sharpeLike,
        turnoverMicros: turnover,
        capacityMicros: 10_000_000n,
        correlationBps: 0n,
        slippageBps: n === 0n ? 0n : slip / n,
        liveBacktestDivergenceBps: 0n,
      }),
    );
  }
  return out;
}
