import type { UtcInstant } from '@solstice/domain';
import type { ExecutionTacticType } from './taxonomy.ts';
import type { ExecutionTactic, OrderPlanningInput, TacticCondition } from './types.ts';

export function resolveRemainingQuantity(input: OrderPlanningInput): bigint {
  if (input.partialFillRemainingUnits != null) {
    return input.partialFillRemainingUnits > 0n ? input.partialFillRemainingUnits : 0n;
  }
  return input.executionPlan.totalQuantityUnits;
}

export function continuationTacticType(priorTactic: ExecutionTactic | null): ExecutionTacticType {
  if (priorTactic == null) {
    return 'PASSIVE_LIMIT';
  }
  if (priorTactic.tacticType === 'TWAP_SLICE' || priorTactic.tacticType === 'VWAP_AWARE') {
    return priorTactic.tacticType;
  }
  return 'PARTIAL_FILL_CONTINUATION';
}

export function buildCancelReplaceConditions(input: {
  readonly maxSlippageBps: number;
  readonly spreadBps: number | null;
  readonly now: UtcInstant;
}): readonly TacticCondition[] {
  return Object.freeze([
    Object.freeze({
      kind: 'SPREAD_WIDENS',
      thresholdBps: input.spreadBps != null ? input.spreadBps * 2 : null,
      action: 'REPLACE',
      explanation: 'Replace passive order when spread widens beyond tolerance.',
    }),
    Object.freeze({
      kind: 'STALE_DATA',
      thresholdBps: null,
      action: 'CANCEL',
      explanation: 'Cancel when market data becomes stale.',
    }),
    Object.freeze({
      kind: 'SLIPPAGE_BREACH',
      thresholdBps: input.maxSlippageBps,
      action: 'HALT',
      explanation: 'Halt when estimated slippage exceeds plan maximum.',
    }),
    Object.freeze({
      kind: 'TIMEOUT',
      thresholdBps: null,
      action: 'CANCEL',
      explanation: 'Cancel unfilled remainder at tactic timeout.',
    }),
  ]);
}

export function buildPartialFillConditions(): readonly TacticCondition[] {
  return Object.freeze([
    Object.freeze({
      kind: 'PARTIAL_FILL',
      thresholdBps: null,
      action: 'CONTINUE_REMAINING',
      explanation: 'Continue with remaining quantity after partial fill.',
    }),
  ]);
}
