import {
  RESEARCH_MONITOR_MAX_EXPRESSION_DEPTH,
  RESEARCH_MONITOR_MAX_EXPRESSION_NODES,
  type ResearchMonitorBinaryOp,
} from './taxonomy.ts';
import type { ResearchMonitorExpression } from './types.ts';

export type ExpressionValidationResult =
  | { readonly ok: true; readonly featureRefs: readonly string[]; readonly nodeCount: number }
  | { readonly ok: false; readonly code: string; readonly message: string };

const FEATURE_ID_PATTERN = /^[A-Z0-9][A-Z0-9_]*[a-z0-9][A-Za-z0-9_]*$/;

export function isValidFeatureId(featureId: string): boolean {
  return FEATURE_ID_PATTERN.test(featureId) && featureId.length <= 128;
}

function walkExpression(
  expression: ResearchMonitorExpression,
  depth: number,
  featureRefs: Set<string>,
  nodeCount: { value: number },
): ExpressionValidationResult | null {
  if (depth > RESEARCH_MONITOR_MAX_EXPRESSION_DEPTH) {
    return { ok: false, code: 'EXPRESSION_TOO_DEEP', message: 'expression exceeds maximum depth' };
  }
  nodeCount.value += 1;
  if (nodeCount.value > RESEARCH_MONITOR_MAX_EXPRESSION_NODES) {
    return { ok: false, code: 'EXPRESSION_TOO_LARGE', message: 'expression exceeds maximum node count' };
  }

  switch (expression.kind) {
    case 'feature': {
      if (!isValidFeatureId(expression.featureId)) {
        return { ok: false, code: 'INVALID_FEATURE_ID', message: `invalid feature id: ${expression.featureId}` };
      }
      featureRefs.add(expression.featureId);
      return null;
    }
    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(expression.value.trim())) {
        return { ok: false, code: 'INVALID_NUMBER', message: `invalid numeric literal: ${expression.value}` };
      }
      return null;
    }
    case 'not': {
      return walkExpression(expression.operand, depth + 1, featureRefs, nodeCount);
    }
    case 'binary': {
      if (!isValidBinaryOp(expression.op)) {
        return { ok: false, code: 'INVALID_OPERATOR', message: `unsupported operator: ${expression.op}` };
      }
      const leftErr = walkExpression(expression.left, depth + 1, featureRefs, nodeCount);
      if (leftErr) return leftErr;
      const rightErr = walkExpression(expression.right, depth + 1, featureRefs, nodeCount);
      if (rightErr) return rightErr;
      if ((expression.op === 'and' || expression.op === 'or') && expression.left.kind === 'number') {
        return { ok: false, code: 'INVALID_LOGIC_OPERAND', message: 'logical operators require boolean-compatible operands' };
      }
      return null;
    }
    default: {
      const _exhaustive: never = expression;
      return _exhaustive;
    }
  }
}

function isValidBinaryOp(op: ResearchMonitorBinaryOp): boolean {
  return (
    op === 'and' ||
    op === 'or' ||
    op === 'gt' ||
    op === 'gte' ||
    op === 'lt' ||
    op === 'lte' ||
    op === 'eq' ||
    op === 'neq' ||
    op === 'add' ||
    op === 'sub' ||
    op === 'mul' ||
    op === 'div'
  );
}

export function validateResearchMonitorExpression(expression: ResearchMonitorExpression): ExpressionValidationResult {
  const featureRefs = new Set<string>();
  const nodeCount = { value: 0 };
  const err = walkExpression(expression, 0, featureRefs, nodeCount);
  if (err) {
    return err;
  }
  return Object.freeze({
    ok: true,
    featureRefs: Object.freeze([...featureRefs].sort()),
    nodeCount: nodeCount.value,
  });
}

export function collectFeatureRefs(expression: ResearchMonitorExpression): readonly string[] {
  const validated = validateResearchMonitorExpression(expression);
  if (!validated.ok) {
    return Object.freeze([]);
  }
  return validated.featureRefs;
}
