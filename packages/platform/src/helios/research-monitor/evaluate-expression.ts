import {
  addMonitorDecimal,
  compareMonitorDecimal,
  divMonitorDecimal,
  mulMonitorDecimal,
  subMonitorDecimal,
} from './numeric.ts';
import type { ResearchMonitorExpression } from './types.ts';

export type ExpressionEvalContext = {
  readonly features: ReadonlyMap<string, string>;
};

export type ExpressionEvalResult =
  | { readonly ok: true; readonly truthy: boolean; readonly numeric: string | null }
  | { readonly ok: false; readonly code: string; readonly message: string };

function asTruthyNumeric(value: string): boolean {
  const cmp = compareMonitorDecimal(value, '0');
  return cmp !== null && cmp !== 0;
}

function evalNumeric(expression: ResearchMonitorExpression, ctx: ExpressionEvalContext): ExpressionEvalResult {
  switch (expression.kind) {
    case 'feature': {
      const value = ctx.features.get(expression.featureId);
      if (value === undefined) {
        return { ok: false, code: 'MISSING_FEATURE_VALUE', message: `missing feature ${expression.featureId}` };
      }
      return { ok: true, truthy: asTruthyNumeric(value), numeric: value };
    }
    case 'number':
      return { ok: true, truthy: asTruthyNumeric(expression.value), numeric: expression.value };
    case 'not': {
      const inner = evalNumeric(expression.operand, ctx);
      if (!inner.ok) return inner;
      return { ok: true, truthy: !inner.truthy, numeric: null };
    }
    case 'binary': {
      if (expression.op === 'and') {
        const left = evalNumeric(expression.left, ctx);
        if (!left.ok) return left;
        if (!left.truthy) {
          return { ok: true, truthy: false, numeric: null };
        }
        const right = evalNumeric(expression.right, ctx);
        if (!right.ok) return right;
        return { ok: true, truthy: right.truthy, numeric: null };
      }
      if (expression.op === 'or') {
        const left = evalNumeric(expression.left, ctx);
        if (!left.ok) return left;
        if (left.truthy) {
          return { ok: true, truthy: true, numeric: null };
        }
        const right = evalNumeric(expression.right, ctx);
        if (!right.ok) return right;
        return { ok: true, truthy: right.truthy, numeric: null };
      }

      const leftNum = evalNumeric(expression.left, ctx);
      if (!leftNum.ok || leftNum.numeric === null) {
        return { ok: false, code: 'NUMERIC_OPERAND_REQUIRED', message: 'binary comparison requires numeric operands' };
      }
      const rightNum = evalNumeric(expression.right, ctx);
      if (!rightNum.ok || rightNum.numeric === null) {
        return { ok: false, code: 'NUMERIC_OPERAND_REQUIRED', message: 'binary comparison requires numeric operands' };
      }

      let computed: string | null = null;
      switch (expression.op) {
        case 'add':
          computed = addMonitorDecimal(leftNum.numeric, rightNum.numeric);
          break;
        case 'sub':
          computed = subMonitorDecimal(leftNum.numeric, rightNum.numeric);
          break;
        case 'mul':
          computed = mulMonitorDecimal(leftNum.numeric, rightNum.numeric);
          break;
        case 'div':
          computed = divMonitorDecimal(leftNum.numeric, rightNum.numeric);
          break;
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
        case 'eq':
        case 'neq':
          computed = null;
          break;
        default:
          return { ok: false, code: 'INVALID_OPERATOR', message: 'unsupported operator' };
      }

      if (computed !== null) {
        return { ok: true, truthy: asTruthyNumeric(computed), numeric: computed };
      }

      const cmp = compareMonitorDecimal(leftNum.numeric, rightNum.numeric);
      if (cmp === null) {
        return { ok: false, code: 'COMPARE_FAILED', message: 'numeric comparison failed' };
      }
      let truthy = false;
      switch (expression.op) {
        case 'gt':
          truthy = cmp > 0;
          break;
        case 'gte':
          truthy = cmp >= 0;
          break;
        case 'lt':
          truthy = cmp < 0;
          break;
        case 'lte':
          truthy = cmp <= 0;
          break;
        case 'eq':
          truthy = cmp === 0;
          break;
        case 'neq':
          truthy = cmp !== 0;
          break;
        default:
          return { ok: false, code: 'INVALID_OPERATOR', message: 'unsupported operator' };
      }
      return { ok: true, truthy, numeric: null };
    }
    default: {
      const _exhaustive: never = expression;
      return _exhaustive;
    }
  }
}

export function evaluateResearchMonitorExpression(
  expression: ResearchMonitorExpression,
  ctx: ExpressionEvalContext,
): ExpressionEvalResult {
  return evalNumeric(expression, ctx);
}
