import type { Clock } from '../../../config/src/clock.ts';
import { ENVIRONMENT } from '../../../config/src/flags.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { DomainEvent, DomainEventLog } from '../../../events/src/events.ts';
import { authorizeOperateGrowth, authorizeViewGrowthPlan } from '../access.ts';
import {
  applyWorkOrderTransition,
  canTransitionWorkOrder,
  expireWorkOrderIfDue,
  isTerminalWorkOrderState,
} from './lifecycle.ts';
import { WorkOrderMetrics } from './metrics.ts';
import { workOrderIdFor } from './ids.ts';
import { InMemoryWorkOrderStore } from './store.ts';
import type { WorkOrderState } from './taxonomy.ts';
import type {
  CreateEconomicWorkOrderInput,
  EconomicWorkOrder,
  WorkOrderFailure,
} from './types.ts';
import { initialRevision } from './types.ts';
import { validateCreateInput } from './validation.ts';

const WORK_ORDER_EVENT_MAP: Partial<Record<WorkOrderState, string>> = {
  ACTIVE: 'WorkOrderActivated',
  PAUSED: 'WorkOrderPaused',
  BLOCKED: 'WorkOrderBlocked',
  COMPLETED: 'WorkOrderCompleted',
  CANCELLED: 'WorkOrderCancelled',
  EXPIRED: 'WorkOrderExpired',
};

/**
 * HELIOS H04 Economic Work Order service.
 * Durable coordination envelope for bounded economic work.
 * Does not post journals, issue Execution Authority, or move money.
 */
export class EconomicWorkOrderService {
  private readonly clock: Clock;
  private readonly events: DomainEventLog;
  readonly store: InMemoryWorkOrderStore;
  readonly metrics: WorkOrderMetrics;

  constructor(input: {
    readonly clock: Clock;
    readonly events: DomainEventLog;
    readonly store?: InMemoryWorkOrderStore;
    readonly metrics?: WorkOrderMetrics;
  }) {
    this.clock = input.clock;
    this.events = input.events;
    this.store = input.store ?? new InMemoryWorkOrderStore();
    this.metrics = input.metrics ?? new WorkOrderMetrics();
  }

  createEconomicWorkOrder(
    actor: unknown,
    input: CreateEconomicWorkOrderInput,
  ): Result<EconomicWorkOrder, WorkOrderFailure> {
    const access = authorizeOperateGrowth(actor, input.subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    const validationError = validateCreateInput(input);
    if (validationError) {
      return err(validationError);
    }
    const existing = this.store.getByIdempotency(input.customerId, input.idempotencyKey);
    if (existing) {
      if (existing.subjectId !== input.subjectId) {
        return err({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'idempotency key is bound to a different subject',
        });
      }
      return ok(existing);
    }
    const now = this.clock.now();
    const workOrderId = workOrderIdFor(input.subjectId, input.idempotencyKey);
    const workOrder: EconomicWorkOrder = Object.freeze({
      workOrderId,
      subjectId: input.subjectId,
      customerId: input.customerId,
      planId: input.planId ?? null,
      planVersion: input.planVersion ?? null,
      objectiveReference: input.objectiveReference ?? null,
      revision: initialRevision(),
      environment: ENVIRONMENT === 'simulation' ? 'simulation' : 'simulation',
      state: 'CREATED',
      createdAt: now,
      updatedAt: now,
      idempotencyKey: input.idempotencyKey,
      objective: Object.freeze({ ...input.objective }),
      authorityReferences: Object.freeze({ ...input.authorityReferences }),
      capitalBoundary: Object.freeze({ ...input.capitalBoundary }),
      researchBoundary: Object.freeze({ ...input.researchBoundary }),
      actionBoundary: Object.freeze({
        permittedActionCategories: Object.freeze([...input.actionBoundary.permittedActionCategories]),
        unrestrictedFinancialMutation: false,
        agentAuthorityEscalation: false,
      }),
      completion: Object.freeze({
        completionCriteria: Object.freeze([...input.completion.completionCriteria]),
        expirationAt: input.completion.expirationAt ?? null,
        disposition: null,
        blockReason: null,
      }),
      transitions: Object.freeze([]),
      createsFinancialAuthority: false,
      postsLedger: false,
    });
    const persisted = this.store.put(workOrder);
    if (typeof persisted === 'object' && 'code' in persisted) {
      return err({ code: persisted.code, message: persisted.message });
    }
    this.metrics.recordCreated();
    this.emitEvent('WorkOrderCreated', workOrder, access.value.actorId);
    return ok(workOrder);
  }

  getEconomicWorkOrder(
    actor: unknown,
    workOrderId: string,
    customerId: string,
  ): Result<EconomicWorkOrder, WorkOrderFailure> {
    const workOrder = this.store.get(workOrderId);
    if (!workOrder) {
      return err({ code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' });
    }
    if (workOrder.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'work order does not belong to this customer' });
    }
    const access = authorizeViewGrowthPlan(actor, workOrder.subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    const current = expireWorkOrderIfDue(workOrder, this.clock.now());
    if (current !== workOrder) {
      const expired = this.store.put(current, workOrder.revision);
      if (typeof expired === 'object' && 'code' in expired) {
        return err({ code: expired.code, message: expired.message });
      }
      this.metrics.recordState('EXPIRED');
      this.emitEvent('WorkOrderExpired', current, 'system');
    }
    return ok(current);
  }

  listEconomicWorkOrders(
    actor: unknown,
    customerId: string,
    subjectId?: string,
  ): Result<readonly EconomicWorkOrder[], WorkOrderFailure> {
    if (subjectId) {
      const access = authorizeViewGrowthPlan(actor, subjectId);
      if (!access.ok) {
        return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
      }
    }
    const now = this.clock.now();
    const rows = subjectId
      ? this.store.listBySubject(subjectId).filter((row) => row.customerId === customerId)
      : this.store.listByCustomer(customerId);
    const refreshed: EconomicWorkOrder[] = [];
    for (const row of rows) {
      const current = expireWorkOrderIfDue(row, now);
      if (current !== row) {
        const expired = this.store.put(current, row.revision);
        if (typeof expired === 'object' && 'code' in expired) {
          return err({ code: expired.code, message: expired.message });
        }
        this.metrics.recordState('EXPIRED');
        this.emitEvent('WorkOrderExpired', current, 'system');
      }
      refreshed.push(current);
    }
    return ok(Object.freeze(refreshed));
  }

  transitionEconomicWorkOrder(
    actor: unknown,
    workOrderId: string,
    customerId: string,
    toState: WorkOrderState,
    reason: string,
  ): Result<EconomicWorkOrder, WorkOrderFailure> {
    const loaded = this.getEconomicWorkOrder(actor, workOrderId, customerId);
    if (!loaded.ok) {
      return loaded;
    }
    const workOrder = loaded.value;
    if (isTerminalWorkOrderState(workOrder.state)) {
      this.metrics.recordFailedTransition();
      return err({ code: 'TERMINAL_STATE', message: `work order is terminal (${workOrder.state})` });
    }
    if (!canTransitionWorkOrder(workOrder.state, toState)) {
      this.metrics.recordFailedTransition();
      return err({
        code: 'INVALID_TRANSITION',
        message: `cannot transition from ${workOrder.state} to ${toState}`,
      });
    }
    const access = authorizeOperateGrowth(actor, workOrder.subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    try {
      const next = applyWorkOrderTransition({
        workOrder,
        toState,
        actorId: access.value.actorId,
        actorSource: 'CUSTOMER',
        reason,
        now: this.clock.now(),
        eventReference: null,
      });
      const persisted = this.store.put(next, workOrder.revision);
      if (typeof persisted === 'object' && 'code' in persisted) {
        this.metrics.recordFailedTransition();
        return err({ code: persisted.code, message: persisted.message });
      }
      this.metrics.recordState(toState);
      const eventType = WORK_ORDER_EVENT_MAP[toState];
      if (eventType) {
        this.emitEvent(eventType, next, access.value.actorId);
      } else if (toState === 'READY') {
        this.emitEvent('WorkOrderCreated', next, access.value.actorId);
      }
      if (toState === 'ACTIVE' && workOrder.state === 'PAUSED') {
        this.emitEvent('WorkOrderResumed', next, access.value.actorId);
      }
      return ok(next);
    } catch (error) {
      this.metrics.recordFailedTransition();
      const message = error instanceof Error ? error.message : 'transition failed';
      if (message.includes('expired')) {
        return err({ code: 'EXPIRED', message });
      }
      return err({ code: 'INVALID_TRANSITION', message });
    }
  }

  pauseEconomicWorkOrder(
    actor: unknown,
    workOrderId: string,
    customerId: string,
    reason: string,
  ): Result<EconomicWorkOrder, WorkOrderFailure> {
    return this.transitionEconomicWorkOrder(actor, workOrderId, customerId, 'PAUSED', reason);
  }

  cancelEconomicWorkOrder(
    actor: unknown,
    workOrderId: string,
    customerId: string,
    reason: string,
  ): Result<EconomicWorkOrder, WorkOrderFailure> {
    return this.transitionEconomicWorkOrder(actor, workOrderId, customerId, 'CANCELLED', reason);
  }

  activateEconomicWorkOrder(
    actor: unknown,
    workOrderId: string,
    customerId: string,
  ): Result<EconomicWorkOrder, WorkOrderFailure> {
    const loaded = this.getEconomicWorkOrder(actor, workOrderId, customerId);
    if (!loaded.ok) {
      return loaded;
    }
    if (loaded.value.state === 'CREATED') {
      const ready = this.transitionEconomicWorkOrder(
        actor,
        workOrderId,
        customerId,
        'READY',
        'validated and ready',
      );
      if (!ready.ok) {
        return ready;
      }
    }
    return this.transitionEconomicWorkOrder(actor, workOrderId, customerId, 'ACTIVE', 'activated');
  }

  private emitEvent(eventType: string, workOrder: EconomicWorkOrder, actorId: string): void {
    this.events.append({
      eventType,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload: {
        workOrderId: workOrder.workOrderId,
        subjectId: workOrder.subjectId,
        customerId: workOrder.customerId,
        state: workOrder.state,
        revision: workOrder.revision,
        mandateId: workOrder.authorityReferences.mandateId,
        planId: workOrder.planId,
        actorId,
      },
    } as DomainEvent);
  }
}
