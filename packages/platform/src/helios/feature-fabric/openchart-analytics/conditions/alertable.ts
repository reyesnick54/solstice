/**
 * Alertable condition evaluation (OpenChart `alertcondition` / `visual.Alert` semantics).
 */

import type { OhlcvBar } from '../market/bar.ts';
import { computeSma, crossunder, crossover } from '../indicators/math.ts';
import type { MarketLogicExpression } from './market-expression.ts';
import { validateMarketLogicExpression } from './market-expression.ts';

export const TEA_ALERT_TYPE_ID = 'visual.Alert' as const;

export type AlertEventPayload = {
  readonly title: string;
  readonly message: string;
};

export type AlertableEvaluation = {
  readonly fired: boolean;
  readonly events: readonly AlertEventPayload[];
};

export type AlertableCondition = {
  readonly alertId: string;
  readonly title: string;
  readonly message: string;
  readonly when: MarketLogicExpression;
  readonly requireFinalBar?: boolean;
};

function resolveCloseSeries(bars: readonly OhlcvBar[]): number[] {
  return bars.map((bar) => bar.close);
}

function evaluateExpression(
  expression: MarketLogicExpression,
  bars: readonly OhlcvBar[],
  barIndex: number,
): boolean {
  switch (expression.kind) {
    case 'value': {
      const ref = expression.ref;
      if (ref.kind === 'literal') return ref.value !== 0;
      if (ref.kind === 'bar') {
        const bar = bars[barIndex];
        if (!bar) return false;
        return bar[ref.field] !== 0;
      }
      if (ref.kind === 'study' && ref.studyId === 'sma' && ref.output === 'value') {
        const length = ref.params?.length ?? 14;
        const closes = resolveCloseSeries(bars);
        const sma = computeSma(closes, length);
        const value = sma[barIndex]!;
        return !Number.isNaN(value) && value !== 0;
      }
      return false;
    }
    case 'not':
      return !evaluateExpression(expression.operand, bars, barIndex);
    case 'binary': {
      if (expression.op === 'and') {
        return (
          evaluateExpression(expression.left, bars, barIndex) &&
          evaluateExpression(expression.right, bars, barIndex)
        );
      }
      if (expression.op === 'or') {
        return (
          evaluateExpression(expression.left, bars, barIndex) ||
          evaluateExpression(expression.right, bars, barIndex)
        );
      }
      if (expression.op === 'crossover' || expression.op === 'crossunder') {
        const left = resolveNumericSeriesFromExpression(expression.left, bars);
        const right = resolveNumericSeriesFromExpression(expression.right, bars);
        const flags = expression.op === 'crossover' ? crossover(left, right) : crossunder(left, right);
        return flags[barIndex] ?? false;
      }
      const left = resolveNumericAt(expression.left, bars, barIndex);
      const right = resolveNumericAt(expression.right, bars, barIndex);
      if (left === null || right === null) return false;
      switch (expression.op) {
        case 'gt':
          return left > right;
        case 'gte':
          return left >= right;
        case 'lt':
          return left < right;
        case 'lte':
          return left <= right;
        case 'eq':
          return left === right;
        default:
          return false;
      }
    }
    default: {
      const _exhaustive: never = expression;
      return _exhaustive;
    }
  }
}

function resolveNumericSeriesFromExpression(
  expression: MarketLogicExpression,
  bars: readonly OhlcvBar[],
): number[] {
  if (expression.kind !== 'value') {
    return bars.map(() => Number.NaN);
  }
  const ref = expression.ref;
  if (ref.kind === 'literal') {
    return bars.map(() => ref.value);
  }
  if (ref.kind === 'bar') {
    return bars.map((bar) => bar[ref.field]);
  }
  if (ref.kind === 'study' && ref.studyId === 'sma') {
    const length = ref.params?.length ?? 14;
    return computeSma(resolveCloseSeries(bars), length);
  }
  return bars.map(() => Number.NaN);
}

function resolveNumericAt(
  expression: MarketLogicExpression,
  bars: readonly OhlcvBar[],
  barIndex: number,
): number | null {
  if (expression.kind !== 'value') return null;
  if (expression.ref.kind === 'literal') return expression.ref.value;
  if (expression.ref.kind === 'bar') {
    const bar = bars[barIndex];
    return bar ? bar[expression.ref.field] : null;
  }
  if (expression.ref.kind === 'study' && expression.ref.studyId === 'sma') {
    const length = expression.ref.params?.length ?? 14;
    const sma = computeSma(resolveCloseSeries(bars), length);
    const value = sma[barIndex]!;
    return Number.isNaN(value) ? null : value;
  }
  return null;
}

export function evaluateAlertableCondition(
  condition: AlertableCondition,
  bars: readonly OhlcvBar[],
  barIndex: number,
): AlertableEvaluation {
  const validated = validateMarketLogicExpression(condition.when);
  if (!validated.ok) {
    return Object.freeze({ fired: false, events: Object.freeze([]) });
  }
  const bar = bars[barIndex];
  if (!bar) {
    return Object.freeze({ fired: false, events: Object.freeze([]) });
  }
  if (condition.requireFinalBar && bar.final === false) {
    return Object.freeze({ fired: false, events: Object.freeze([]) });
  }
  const fired = evaluateExpression(condition.when, bars, barIndex);
  if (!fired) {
    return Object.freeze({ fired: false, events: Object.freeze([]) });
  }
  return Object.freeze({
    fired: true,
    events: Object.freeze([Object.freeze({ title: condition.title, message: condition.message })]),
  });
}

/** Detect output columns that represent Tea alert streams (metadata parity). */
export function isTeaAlertTypeId(typeId: string | undefined): boolean {
  if (typeId === TEA_ALERT_TYPE_ID) return true;
  return typeId?.startsWith('visual.AlertEvent<') ?? false;
}
