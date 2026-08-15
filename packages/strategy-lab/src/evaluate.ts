import type { UtcInstant } from '../../domain/src/time.ts';
import { latestCloseAt, membersAt, windowCloses, type MarketDataset } from './dataset.ts';
import type { StrategyExpr } from './dsl.ts';
import type { StrategySpecification } from './specification.ts';

export type EvaluatedDecision = {
  readonly at: UtcInstant;
  readonly shouldRebalance: boolean;
  readonly enter: boolean;
  readonly exit: boolean;
  readonly targetWeightsBps: Readonly<Record<string, number>>;
  readonly rule: string;
};

function factValue(
  dataset: MarketDataset,
  at: UtcInstant,
  instrumentId: string,
  kind: 'CLOSE' | 'OPEN' | 'HIGH' | 'LOW' | 'MEMBERSHIP',
): bigint | null {
  if (kind === 'MEMBERSHIP') {
    return membersAt(dataset, at).includes(instrumentId) ? 1n : 0n;
  }
  const observation = latestCloseAt(dataset, instrumentId, at);
  if (!observation.ok) {
    return null;
  }
  if (kind === 'CLOSE') {
    return observation.value.closeMinor;
  }
  if (kind === 'OPEN') {
    return observation.value.openMinor;
  }
  if (kind === 'HIGH') {
    return observation.value.highMinor;
  }
  return observation.value.lowMinor;
}

function compare(left: bigint, comparator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ', right: bigint): boolean {
  if (comparator === 'GT') {
    return left > right;
  }
  if (comparator === 'GTE') {
    return left >= right;
  }
  if (comparator === 'LT') {
    return left < right;
  }
  if (comparator === 'LTE') {
    return left <= right;
  }
  return left === right;
}

function evalBoolean(expr: StrategyExpr, dataset: MarketDataset, at: UtcInstant, cashBps: number): boolean {
  if (expr.op === 'AND') {
    return expr.clauses.every((clause) => evalBoolean(clause, dataset, at, cashBps));
  }
  if (expr.op === 'OR') {
    return expr.clauses.some((clause) => evalBoolean(clause, dataset, at, cashBps));
  }
  if (expr.op === 'NOT') {
    return !evalBoolean(expr.clause, dataset, at, cashBps);
  }
  if (expr.op === 'COMPARE') {
    const left = factValue(dataset, at, expr.left.instrumentId, expr.left.kind);
    const right =
      'kind' in expr.right && expr.right.kind === 'THRESHOLD'
        ? expr.right.minorUnits
        : 'instrumentId' in expr.right
          ? factValue(dataset, at, expr.right.instrumentId, expr.right.kind)
          : null;
    if (left === null || right === null) {
      return false;
    }
    return compare(left, expr.comparator, right);
  }
  if (expr.op === 'THRESHOLD') {
    const value = factValue(dataset, at, expr.fact.instrumentId, expr.fact.kind);
    if (value === null) {
      return false;
    }
    if (expr.minMinor !== undefined && value < expr.minMinor) {
      return false;
    }
    if (expr.maxMinor !== undefined && value > expr.maxMinor) {
      return false;
    }
    return true;
  }
  if (expr.op === 'MOVING_WINDOW') {
    const closes = windowCloses(dataset, expr.fact.instrumentId, at, expr.window);
    if (closes.length < expr.window) {
      return false;
    }
    const latest = closes[closes.length - 1];
    if (latest === undefined) {
      return false;
    }
    const stat =
      expr.statistic === 'MEAN'
        ? closes.reduce((sum, value) => sum + value, 0n) / BigInt(closes.length)
        : expr.statistic === 'MAX'
          ? closes.reduce((max, value) => (value > max ? value : max), closes[0] ?? 0n)
          : expr.statistic === 'MIN'
            ? closes.reduce((min, value) => (value < min ? value : min), closes[0] ?? 0n)
            : closes.reduce((sum, value) => sum + value, 0n);
    return latest >= stat;
  }
  if (expr.op === 'RISK_CONDITION') {
    if (expr.kind === 'CASH_BELOW_BPS') {
      return cashBps < expr.bps;
    }
    return false;
  }
  if (expr.op === 'CASH_RULE') {
    return cashBps >= expr.minCashBps;
  }
  if (expr.op === 'REBALANCE_TRIGGER') {
    return true;
  }
  if (expr.op === 'RANK' || expr.op === 'ALLOCATION') {
    return true;
  }
  return false;
}

function rankTargets(
  expr: Extract<StrategyExpr, { op: 'RANK' }>,
  dataset: MarketDataset,
  at: UtcInstant,
  universe: readonly string[],
  cashBps: number,
): Record<string, number> {
  const scored = universe
    .map((instrumentId) => {
      const value = factValue(dataset, at, instrumentId, expr.statistic === 'MEMBERSHIP' ? 'MEMBERSHIP' : 'CLOSE');
      return { instrumentId, value: value ?? 0n };
    })
    .sort((a, b) => (expr.higherIsBetter ? (a.value < b.value ? 1 : -1) : a.value > b.value ? 1 : -1));
  const selected = scored.slice(0, expr.n).map((row) => row.instrumentId);
  const remaining = 10_000 - cashBps;
  const each = selected.length === 0 ? 0 : Math.floor(remaining / selected.length);
  const weights: Record<string, number> = { CASH: cashBps };
  for (const instrumentId of selected) {
    weights[instrumentId] = each;
  }
  return weights;
}

function allocationTargets(
  expr: StrategyExpr,
  dataset: MarketDataset,
  at: UtcInstant,
  universe: readonly string[],
  cashBps: number,
): Record<string, number> {
  if (expr.op === 'ALLOCATION') {
    return { CASH: cashBps, ...expr.weightsBps };
  }
  if (expr.op === 'RANK') {
    return rankTargets(expr, dataset, at, universe, cashBps);
  }
  if (expr.op === 'AND' || expr.op === 'OR') {
    for (const clause of expr.clauses) {
      if (clause.op === 'ALLOCATION' || clause.op === 'RANK') {
        return allocationTargets(clause, dataset, at, universe, cashBps);
      }
    }
  }
  const remaining = 10_000 - cashBps;
  const each = universe.length === 0 ? 0 : Math.floor(remaining / universe.length);
  const weights: Record<string, number> = { CASH: cashBps };
  for (const instrumentId of universe) {
    weights[instrumentId] = each;
  }
  return weights;
}

function cadenceMatch(cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY', at: UtcInstant, start: UtcInstant): boolean {
  const day = Math.floor((Date.parse(at) - Date.parse(start)) / 86_400_000);
  if (cadence === 'DAILY') {
    return true;
  }
  if (cadence === 'WEEKLY') {
    return day % 7 === 0;
  }
  return day % 21 === 0;
}

export function evaluateDecision(input: {
  readonly specification: StrategySpecification;
  readonly dataset: MarketDataset;
  readonly at: UtcInstant;
  readonly start: UtcInstant;
  readonly cashBps: number;
}): EvaluatedDecision {
  const universe = membersAt(input.dataset, input.at).filter((id) =>
    input.specification.instrumentUniverse.includes(id),
  );
  const enter = evalBoolean(input.specification.entryConditions, input.dataset, input.at, input.cashBps);
  const exit = evalBoolean(input.specification.exitConditions, input.dataset, input.at, input.cashBps);
  const shouldRebalance =
    enter &&
    !exit &&
    cadenceMatch(input.specification.rebalanceCadence, input.at, input.start);
  const targetWeightsBps = shouldRebalance
    ? allocationTargets(input.specification.targetAllocation, input.dataset, input.at, universe, input.specification.cashAllocationBps)
    : { CASH: 10_000 };
  return Object.freeze({
    at: input.at,
    shouldRebalance,
    enter,
    exit,
    targetWeightsBps: Object.freeze({ ...targetWeightsBps }),
    rule: shouldRebalance ? 'rebalance-to-target' : exit ? 'exit-to-cash' : 'hold',
  });
}
