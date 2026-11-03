/**
 * Typed market logic tree (OpenChart Tea / conditions builder concepts; no eval).
 */

export const MARKET_LOGIC_OPERATORS = [
  'and',
  'or',
  'not',
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'crossover',
  'crossunder',
] as const;

export type MarketLogicOperator = (typeof MARKET_LOGIC_OPERATORS)[number];

export type MarketValueRef =
  | { readonly kind: 'bar'; readonly field: 'open' | 'high' | 'low' | 'close' | 'volume' }
  | { readonly kind: 'study'; readonly studyId: string; readonly output: string; readonly params?: Readonly<Record<string, number>> }
  | { readonly kind: 'literal'; readonly value: number };

export type MarketLogicExpression =
  | { readonly kind: 'value'; readonly ref: MarketValueRef }
  | { readonly kind: 'not'; readonly operand: MarketLogicExpression }
  | {
      readonly kind: 'binary';
      readonly op: Extract<MarketLogicOperator, 'and' | 'or' | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'crossover' | 'crossunder'>;
      readonly left: MarketLogicExpression;
      readonly right: MarketLogicExpression;
    };

export type MarketLogicValidation =
  | { readonly ok: true; readonly nodeCount: number }
  | { readonly ok: false; readonly code: string; readonly message: string };

const MAX_DEPTH = 12;
const MAX_NODES = 64;

function walk(
  expression: MarketLogicExpression,
  depth: number,
  nodeCount: { value: number },
): MarketLogicValidation | null {
  if (depth > MAX_DEPTH) {
    return { ok: false, code: 'EXPRESSION_TOO_DEEP', message: 'market logic exceeds max depth' };
  }
  nodeCount.value += 1;
  if (nodeCount.value > MAX_NODES) {
    return { ok: false, code: 'EXPRESSION_TOO_LARGE', message: 'market logic exceeds max nodes' };
  }
  switch (expression.kind) {
    case 'value':
      if (expression.ref.kind === 'literal' && !Number.isFinite(expression.ref.value)) {
        return { ok: false, code: 'INVALID_LITERAL', message: 'literal must be finite' };
      }
      return null;
    case 'not':
      return walk(expression.operand, depth + 1, nodeCount);
    case 'binary':
      if (!MARKET_LOGIC_OPERATORS.includes(expression.op)) {
        return { ok: false, code: 'INVALID_OPERATOR', message: `unsupported operator ${expression.op}` };
      }
      return walk(expression.left, depth + 1, nodeCount) ?? walk(expression.right, depth + 1, nodeCount);
    default: {
      const _exhaustive: never = expression;
      return _exhaustive;
    }
  }
}

export function validateMarketLogicExpression(expression: MarketLogicExpression): MarketLogicValidation {
  const nodeCount = { value: 0 };
  const err = walk(expression, 0, nodeCount);
  if (err) return err;
  return Object.freeze({ ok: true, nodeCount: nodeCount.value });
}
