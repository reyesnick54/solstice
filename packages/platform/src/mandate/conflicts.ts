import { Money } from '../../../money/src/money.ts';
import type { CompilerIssue, HardConstraint } from './types.ts';

function amountOf(constraint: HardConstraint): Money | undefined {
  if (!constraint.amount) {
    return undefined;
  }
  return Money.fromMinorUnitsString(constraint.amount.minorUnits, constraint.amount.currency);
}

/**
 * Detect contradictory hard constraints. Do not silently choose.
 */
export function detectMandateConflicts(constraints: readonly HardConstraint[]): readonly CompilerIssue[] {
  const issues: CompilerIssue[] = [];
  const keepAll = constraints.find((item) => item.kind === 'KEEP_ALL_LIQUID');
  const investAll = constraints.find((item) => item.kind === 'INVEST_ALL_AVAILABLE_IMMEDIATELY');
  if (keepAll && investAll) {
    const left = amountOf(keepAll);
    const right = amountOf(investAll);
    if (left && right && left.currency === right.currency && left.equals(right)) {
      issues.push({
        code: 'CONTRADICTORY_CONSTRAINTS',
        message: `Keep all ${left.toJSON().minorUnits} ${left.currency} liquid conflicts with invest all immediately.`,
        constraintKinds: ['KEEP_ALL_LIQUID', 'INVEST_ALL_AVAILABLE_IMMEDIATELY'],
      });
    } else {
      issues.push({
        code: 'CONTRADICTORY_CONSTRAINTS',
        message: 'Keeping all funds liquid conflicts with investing all funds immediately.',
        constraintKinds: ['KEEP_ALL_LIQUID', 'INVEST_ALL_AVAILABLE_IMMEDIATELY'],
      });
    }
  }

  const floor = constraints.find((item) => item.kind === 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR');
  if (keepAll && investAll && floor) {
    issues.push({
      code: 'CONTRADICTORY_CONSTRAINTS',
      message: 'A liquidity floor cannot be satisfied by investing the same reserved cash immediately.',
      constraintKinds: ['NEVER_SPEND_BELOW_LIQUIDITY_FLOOR', 'INVEST_ALL_AVAILABLE_IMMEDIATELY'],
    });
  }

  const reserve = constraints.find((item) => item.kind === 'MINIMUM_CASH_RESERVE');
  if (reserve && investAll) {
    const reserved = amountOf(reserve);
    const invest = amountOf(investAll);
    if (reserved && invest && reserved.currency === invest.currency && reserved.cmp(invest) >= 0) {
      issues.push({
        code: 'CONTRADICTORY_CONSTRAINTS',
        message: 'Minimum cash reserve covers the same amount the mandate would invest immediately.',
        constraintKinds: ['MINIMUM_CASH_RESERVE', 'INVEST_ALL_AVAILABLE_IMMEDIATELY'],
      });
    }
  }

  return Object.freeze(issues);
}
