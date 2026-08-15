import { err, ok, type Result } from '../../domain/src/result.ts';
import { STRATEGY_RESOURCE_LIMITS, type StrategyFailure } from './types.ts';

export const APPROVED_OPERATORS = [
  'COMPARE',
  'THRESHOLD',
  'MOVING_WINDOW',
  'RANK',
  'ALLOCATION',
  'REBALANCE_TRIGGER',
  'RISK_CONDITION',
  'CASH_RULE',
  'AND',
  'OR',
  'NOT',
] as const;

export type ApprovedOperator = (typeof APPROVED_OPERATORS)[number];

export const FORBIDDEN_STRATEGY_CODE = [
  'javascript',
  'python',
  'shell',
  'sql',
  'eval',
  'Function',
  'child_process',
  'fetch(',
  'http://',
  'https://',
  'fs.',
  'require(',
  'import(',
] as const;

export const COMPARATORS = ['GT', 'GTE', 'LT', 'LTE', 'EQ'] as const;
export type Comparator = (typeof COMPARATORS)[number];

export const WINDOW_STATISTICS = ['MEAN', 'MAX', 'MIN', 'SUM'] as const;
export type WindowStatistic = (typeof WINDOW_STATISTICS)[number];

export const MARKET_FACTS = ['CLOSE', 'OPEN', 'HIGH', 'LOW', 'MEMBERSHIP'] as const;
export type MarketFactKind = (typeof MARKET_FACTS)[number];

export type MarketFactRef = {
  readonly kind: MarketFactKind;
  readonly instrumentId: string;
};

export type StrategyExpr =
  | {
      readonly op: 'COMPARE';
      readonly left: MarketFactRef;
      readonly comparator: Comparator;
      readonly right: { readonly kind: 'THRESHOLD'; readonly minorUnits: bigint } | MarketFactRef;
    }
  | {
      readonly op: 'THRESHOLD';
      readonly fact: MarketFactRef;
      readonly minMinor?: bigint;
      readonly maxMinor?: bigint;
    }
  | {
      readonly op: 'MOVING_WINDOW';
      readonly statistic: WindowStatistic;
      readonly window: number;
      readonly fact: MarketFactRef;
    }
  | {
      readonly op: 'RANK';
      readonly statistic: MarketFactKind;
      readonly n: number;
      readonly higherIsBetter: boolean;
    }
  | {
      readonly op: 'ALLOCATION';
      readonly weightsBps: Readonly<Record<string, number>>;
    }
  | {
      readonly op: 'REBALANCE_TRIGGER';
      readonly cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    }
  | {
      readonly op: 'RISK_CONDITION';
      readonly kind: 'CASH_BELOW_BPS' | 'DRAWDOWN_ABOVE_BPS' | 'CONCENTRATION_ABOVE_BPS';
      readonly bps: number;
    }
  | {
      readonly op: 'CASH_RULE';
      readonly minCashBps: number;
    }
  | { readonly op: 'AND'; readonly clauses: readonly StrategyExpr[] }
  | { readonly op: 'OR'; readonly clauses: readonly StrategyExpr[] }
  | { readonly op: 'NOT'; readonly clause: StrategyExpr };

export function countRules(expr: StrategyExpr): number {
  if (expr.op === 'AND' || expr.op === 'OR') {
    return 1 + expr.clauses.reduce((sum, clause) => sum + countRules(clause), 0);
  }
  if (expr.op === 'NOT') {
    return 1 + countRules(expr.clause);
  }
  return 1;
}

export function countStrategyParameters(expr: StrategyExpr): number {
  if (expr.op === 'AND' || expr.op === 'OR') {
    return expr.clauses.reduce((sum, clause) => sum + countStrategyParameters(clause), 0);
  }
  if (expr.op === 'NOT') {
    return countStrategyParameters(expr.clause);
  }
  if (expr.op === 'THRESHOLD') {
    return (expr.minMinor !== undefined ? 1 : 0) + (expr.maxMinor !== undefined ? 1 : 0);
  }
  if (expr.op === 'ALLOCATION') {
    return Object.keys(expr.weightsBps).length;
  }
  return 1;
}

function scanForbidden(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    for (const token of FORBIDDEN_STRATEGY_CODE) {
      if (lower.includes(token.toLowerCase())) {
        out.push(token);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      scanForbidden(item, out);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      scanForbidden(key, out);
      scanForbidden(item, out);
    }
  }
}

export function assertApprovedOperator(op: string): op is ApprovedOperator {
  return (APPROVED_OPERATORS as readonly string[]).includes(op);
}

export function validateStrategyAst(expr: StrategyExpr): Result<StrategyExpr, StrategyFailure> {
  const forbidden: string[] = [];
  scanForbidden(expr, forbidden);
  if (forbidden.length > 0) {
    return err({
      code: 'ARBITRARY_CODE_FORBIDDEN',
      message: `strategy DSL forbids executable or networked tokens: ${forbidden.join(', ')}`,
    });
  }
  const rules = countRules(expr);
  if (rules > STRATEGY_RESOURCE_LIMITS.maximumRules) {
    return err({
      code: 'RESOURCE_LIMIT',
      message: `strategy exceeds maximumRules=${String(STRATEGY_RESOURCE_LIMITS.maximumRules)}`,
    });
  }
  const queue: StrategyExpr[] = [expr];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      break;
    }
    if (!assertApprovedOperator(current.op)) {
      return err({
        code: 'INVALID_OPERATOR',
        message: `operator ${String((current as { op: string }).op)} is not in the approved set`,
      });
    }
    if (current.op === 'AND' || current.op === 'OR') {
      queue.push(...current.clauses);
    } else if (current.op === 'NOT') {
      queue.push(current.clause);
    } else if (current.op === 'ALLOCATION') {
      const total = Object.values(current.weightsBps).reduce((sum, bps) => sum + bps, 0);
      if (total > 10_000) {
        return err({
          code: 'LEVERAGE_FORBIDDEN',
          message: 'allocation weights may not exceed 100 percent; leverage is forbidden',
        });
      }
    }
  }
  return ok(Object.freeze(expr));
}

export function collectInstrumentIds(expr: StrategyExpr, into = new Set<string>()): readonly string[] {
  if (expr.op === 'COMPARE') {
    into.add(expr.left.instrumentId);
    if ('instrumentId' in expr.right) {
      into.add(expr.right.instrumentId);
    }
  } else if (expr.op === 'THRESHOLD' || expr.op === 'MOVING_WINDOW') {
    into.add(expr.fact.instrumentId);
  } else if (expr.op === 'ALLOCATION') {
    for (const instrumentId of Object.keys(expr.weightsBps)) {
      into.add(instrumentId);
    }
  } else if (expr.op === 'AND' || expr.op === 'OR') {
    for (const clause of expr.clauses) {
      collectInstrumentIds(clause, into);
    }
  } else if (expr.op === 'NOT') {
    collectInstrumentIds(expr.clause, into);
  }
  return Object.freeze([...into]);
}
