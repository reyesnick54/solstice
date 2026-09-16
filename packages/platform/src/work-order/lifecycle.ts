import type { UtcInstant } from '../../../domain/src/time.ts';
import { transitionIdFor } from './ids.ts';
import type { WorkOrderState } from './taxonomy.ts';
import type { EconomicWorkOrder, WorkOrderTransition } from './types.ts';
import { nextRevision } from './types.ts';

const ALLOWED: Readonly<Record<WorkOrderState, readonly WorkOrderState[]>> = {
  CREATED: ['READY', 'CANCELLED'],
  READY: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  ACTIVE: ['PAUSED', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'],
  PAUSED: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  BLOCKED: ['ACTIVE', 'CANCELLED', 'FAILED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
};

export function isTerminalWorkOrderState(state: WorkOrderState): boolean {
  return ALLOWED[state].length === 0;
}

export function canTransitionWorkOrder(from: WorkOrderState, to: WorkOrderState): boolean {
  return ALLOWED[from].includes(to);
}

export function applyWorkOrderTransition(input: {
  readonly workOrder: EconomicWorkOrder;
  readonly toState: WorkOrderState;
  readonly actorId: string;
  readonly actorSource: WorkOrderTransition['actorSource'];
  readonly reason: string;
  readonly now: UtcInstant;
  readonly eventReference?: string | null;
}): EconomicWorkOrder {
  if (!canTransitionWorkOrder(input.workOrder.state, input.toState)) {
    throw new Error(`invalid transition ${input.workOrder.state} -> ${input.toState}`);
  }
  if (input.workOrder.completion.expirationAt && input.workOrder.completion.expirationAt <= input.now) {
    if (input.toState !== 'EXPIRED' && !isTerminalWorkOrderState(input.workOrder.state)) {
      throw new Error('work order has expired');
    }
  }
  const revision = nextRevision(input.workOrder.revision);
  const transition: WorkOrderTransition = Object.freeze({
    transitionId: transitionIdFor(input.workOrder.workOrderId, revision, input.toState),
    workOrderId: input.workOrder.workOrderId,
    revision,
    previousState: input.workOrder.state,
    nextState: input.toState,
    actorId: input.actorId,
    actorSource: input.actorSource,
    reason: input.reason,
    occurredAt: input.now,
    eventReference: input.eventReference ?? null,
  });
  return Object.freeze({
    ...input.workOrder,
    state: input.toState,
    revision,
    updatedAt: input.now,
    transitions: Object.freeze([...input.workOrder.transitions, transition]),
  });
}

export function expireWorkOrderIfDue(workOrder: EconomicWorkOrder, now: UtcInstant): EconomicWorkOrder {
  if (isTerminalWorkOrderState(workOrder.state)) {
    return workOrder;
  }
  if (!workOrder.completion.expirationAt || workOrder.completion.expirationAt > now) {
    return workOrder;
  }
  if (canTransitionWorkOrder(workOrder.state, 'EXPIRED')) {
    return applyWorkOrderTransition({
      workOrder,
      toState: 'EXPIRED',
      actorId: 'system',
      actorSource: 'SYSTEM',
      reason: 'expiration criteria met',
      now,
      eventReference: null,
    });
  }
  const revision = nextRevision(workOrder.revision);
  const transition: WorkOrderTransition = Object.freeze({
    transitionId: transitionIdFor(workOrder.workOrderId, revision, 'EXPIRED'),
    workOrderId: workOrder.workOrderId,
    revision,
    previousState: workOrder.state,
    nextState: 'EXPIRED',
    actorId: 'system',
    actorSource: 'SYSTEM',
    reason: 'expiration criteria met',
    occurredAt: now,
    eventReference: null,
  });
  return Object.freeze({
    ...workOrder,
    state: 'EXPIRED',
    revision,
    updatedAt: now,
    transitions: Object.freeze([...workOrder.transitions, transition]),
  });
}
