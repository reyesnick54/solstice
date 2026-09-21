import type { EconomicWorkOrderId } from '../ids.ts';
import type { DecisionValidityEnvelopeId } from '../decision-validity/ids.ts';

export type ExecutionPlanId = `xplan_${string}`;
export type ExecutionPlanTransitionId = `xpt_${string}`;

export function asExecutionPlanId(value: string): ExecutionPlanId {
  if (!value.startsWith('xplan_')) throw new Error(`invalid ExecutionPlanId: ${value}`);
  return value as ExecutionPlanId;
}

export function asExecutionPlanTransitionId(value: string): ExecutionPlanTransitionId {
  if (!value.startsWith('xpt_')) throw new Error(`invalid ExecutionPlanTransitionId: ${value}`);
  return value as ExecutionPlanTransitionId;
}

/**
 * Stable execution plan identity derived from work order, envelope, and idempotency key.
 */
export function executionPlanIdFor(
  workOrderId: EconomicWorkOrderId | string,
  envelopeId: DecisionValidityEnvelopeId | string,
  idempotencyKey: string,
): ExecutionPlanId {
  return asExecutionPlanId(`xplan_${workOrderId}_${envelopeId}_${idempotencyKey}`);
}

export function transitionIdFor(
  executionPlanId: ExecutionPlanId | string,
  targetStatus: string,
  idempotencyKey: string,
): ExecutionPlanTransitionId {
  return asExecutionPlanTransitionId(`xpt_${executionPlanId}_${targetStatus}_${idempotencyKey}`);
}
