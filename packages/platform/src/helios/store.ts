import { addMs } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  applyReservation,
  applySpend,
  canReserveBudget,
  computeRemainingBudget,
  createReservation,
  releaseUnusedReservation,
} from './budget.ts';
import { nextBackoffMs } from './retry.ts';
import type { EconomicWorkOrderId, HeliosTaskId } from './ids.ts';
import type { TaskState } from './taxonomy.ts';
import type {
  EconomicWorkOrder,
  HeliosAuditEvent,
  HeliosFailure,
  HeliosWorkTask,
  ResearchBudgetReservation,
  ResearchSpendRecord,
  TaskLease,
} from './types.ts';

export type HeliosStoreSnapshot = {
  readonly workOrders: readonly EconomicWorkOrder[];
  readonly tasks: readonly HeliosWorkTask[];
  readonly reservations: readonly ResearchBudgetReservation[];
  readonly spendRecords: readonly ResearchSpendRecord[];
  readonly auditEvents: readonly HeliosAuditEvent[];
};

export class InMemoryHeliosWorkStore {
  private readonly workOrders = new Map<string, EconomicWorkOrder>();
  private readonly tasks = new Map<string, HeliosWorkTask>();
  private readonly reservations = new Map<string, ResearchBudgetReservation>();
  private readonly spendRecords = new Map<string, ResearchSpendRecord>();
  private readonly auditEvents: HeliosAuditEvent[] = [];
  private readonly operationCompletions = new Map<string, string>();

  putWorkOrder(order: EconomicWorkOrder): EconomicWorkOrder {
    this.workOrders.set(order.workOrderId, order);
    return order;
  }

  getWorkOrder(workOrderId: string, customerId?: string): EconomicWorkOrder | undefined {
    const row = this.workOrders.get(workOrderId);
    if (!row) return undefined;
    if (customerId && row.customerId !== customerId) return undefined;
    return row;
  }

  putTask(task: HeliosWorkTask): HeliosWorkTask {
    this.tasks.set(task.taskId, task);
    return task;
  }

  getTask(taskId: string, customerId?: string): HeliosWorkTask | undefined {
    const row = this.tasks.get(taskId);
    if (!row) return undefined;
    if (customerId && row.customerId !== customerId) return undefined;
    return row;
  }

  listTasksForWorkOrder(workOrderId: string, customerId?: string): readonly HeliosWorkTask[] {
    return Object.freeze(
      [...this.tasks.values()].filter(
        (row) => row.workOrderId === workOrderId && (!customerId || row.customerId === customerId),
      ),
    );
  }

  listClaimableTasks(workOrderId: string, now: UtcInstant, customerId?: string): readonly HeliosWorkTask[] {
    return Object.freeze(
      [...this.tasks.values()].filter((row) => {
        if (row.workOrderId !== workOrderId) return false;
        if (customerId && row.customerId !== customerId) return false;
        if (row.state !== 'CLAIMABLE' && row.state !== 'QUEUED') return false;
        if (row.retry.nextEligibleAt && row.retry.nextEligibleAt > now) return false;
        return dependenciesMet(row, this.tasks);
      }),
    );
  }

  countRunningTasks(workOrderId: string): number {
    return [...this.tasks.values()].filter(
      (row) => row.workOrderId === workOrderId && row.state === 'RUNNING',
    ).length;
  }

  claimTask(input: {
    readonly taskId: HeliosTaskId;
    readonly workerId: string;
    readonly now: UtcInstant;
    readonly leaseMs: number;
    readonly customerId: string;
    readonly workOrderId: EconomicWorkOrderId;
  }): HeliosWorkTask | HeliosFailure {
    const task = this.getTask(input.taskId, input.customerId);
    if (!task) return { code: 'TASK_NOT_FOUND', message: 'task not found for customer scope' };
    if (task.workOrderId !== input.workOrderId) {
      return { code: 'CUSTOMER_MISMATCH', message: 'task does not belong to work order' };
    }
    if (task.state === 'COMPLETED') {
      return { code: 'TASK_ALREADY_COMPLETED', message: 'task already completed' };
    }
    if (task.state === 'RUNNING' && task.lease) {
      if (task.lease.expiresAt > input.now && task.lease.workerId !== input.workerId) {
        return { code: 'LEASE_NOT_EXPIRED', message: 'task is leased by another worker' };
      }
    }
    if (!['CLAIMABLE', 'QUEUED', 'RETRYABLE_FAILURE', 'RUNNING'].includes(task.state)) {
      return { code: 'INVALID_STATE_TRANSITION', message: `cannot claim task in state ${task.state}` };
    }
    if (!dependenciesMet(task, this.tasks)) {
      return { code: 'DEPENDENCY_NOT_MET', message: 'prerequisite tasks not completed' };
    }
    const generation = (task.lease?.leaseGeneration ?? 0) + 1;
    const lease: TaskLease = Object.freeze({
      taskId: input.taskId,
      workerId: input.workerId,
      acquiredAt: input.now,
      expiresAt: addMs(input.now, input.leaseMs) as UtcInstant,
      attemptNumber: task.retry.attemptCount + 1,
      leaseGeneration: generation,
    });
    const next = Object.freeze({
      ...task,
      state: 'RUNNING' as TaskState,
      lease,
      updatedAt: input.now,
    });
    this.tasks.set(task.taskId, next);
    return next;
  }

  completeTask(input: {
    readonly taskId: HeliosTaskId;
    readonly workerId: string;
    readonly leaseGeneration: number;
    readonly now: UtcInstant;
    readonly customerId: string;
    readonly resultRef: string;
    readonly evidenceRefs: readonly string[];
    readonly operationIdentity: string;
  }): HeliosWorkTask | HeliosFailure {
    const task = this.getTask(input.taskId, input.customerId);
    if (!task) return { code: 'TASK_NOT_FOUND', message: 'task not found' };
    if (task.state === 'COMPLETED') {
      const existing = this.operationCompletions.get(input.operationIdentity);
      if (existing === input.resultRef) return task;
      return { code: 'TASK_ALREADY_COMPLETED', message: 'duplicate completion with different result rejected' };
    }
    if (!task.lease || task.lease.workerId !== input.workerId || task.lease.leaseGeneration !== input.leaseGeneration) {
      return { code: 'LEASE_LOST', message: 'lease no longer valid; completion rejected' };
    }
    const next = Object.freeze({
      ...task,
      state: 'COMPLETED' as TaskState,
      resultRef: input.resultRef,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      completedAt: input.now,
      lease: null,
      updatedAt: input.now,
    });
    this.tasks.set(task.taskId, next);
    this.operationCompletions.set(input.operationIdentity, input.resultRef);
    this.promoteDependents(task.workOrderId, input.now);
    return next;
  }

  failTask(input: {
    readonly taskId: HeliosTaskId;
    readonly workerId: string;
    readonly leaseGeneration: number;
    readonly now: UtcInstant;
    readonly customerId: string;
    readonly failureReason: string;
    readonly failureCategory: import('./taxonomy.ts').TaskFailureCategory;
    readonly retryable: boolean;
  }): HeliosWorkTask | HeliosFailure {
    const task = this.getTask(input.taskId, input.customerId);
    if (!task) return { code: 'TASK_NOT_FOUND', message: 'task not found' };
    if (!task.lease || task.lease.workerId !== input.workerId || task.lease.leaseGeneration !== input.leaseGeneration) {
      return { code: 'LEASE_LOST', message: 'lease no longer valid' };
    }
    const attemptCount = task.retry.attemptCount + 1;
    const terminal = attemptCount >= task.retry.terminalThreshold || !input.retryable;
    const nextState: TaskState = terminal ? 'PERMANENTLY_FAILED' : 'RETRYABLE_FAILURE';
    const next = Object.freeze({
      ...task,
      state: nextState,
      failureReason: input.failureReason,
      lease: null,
      retry: Object.freeze({
        ...task.retry,
        attemptCount,
        lastFailureAt: input.now,
        nextEligibleAt: terminal ? null : (addMs(input.now, nextBackoffMs(input.retryable ? attemptCount : 0)) as UtcInstant),
        failureCategory: input.failureCategory,
        backoffMs: nextBackoffMs(attemptCount),
      }),
      updatedAt: input.now,
    });
    this.tasks.set(task.taskId, next);
    return next;
  }

  reserveBudgetAtomic(input: {
    readonly workOrderId: EconomicWorkOrderId;
    readonly taskId: HeliosTaskId;
    readonly customerId: string;
    readonly amount: string;
    readonly now: UtcInstant;
  }): { readonly reservation: ResearchBudgetReservation; readonly workOrder: EconomicWorkOrder } | HeliosFailure {
    const order = this.getWorkOrder(input.workOrderId, input.customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    const check = canReserveBudget(order.researchBudget, input.amount);
    if ('code' in check) return check;
    const reservation = createReservation({
      workOrderId: input.workOrderId,
      taskId: input.taskId,
      customerId: input.customerId,
      unitKind: order.researchBudget.unitKind,
      amount: input.amount,
      now: input.now,
    });
    const updatedBudget = applyReservation(order.researchBudget, input.amount);
    const updatedOrder = Object.freeze({
      ...order,
      researchBudget: updatedBudget,
      updatedAt: input.now,
      version: order.version + 1,
    });
    this.workOrders.set(order.workOrderId, updatedOrder);
    this.reservations.set(reservation.reservationId, reservation);
    const task = this.getTask(input.taskId, input.customerId);
    if (task) {
      this.tasks.set(
        task.taskId,
        Object.freeze({
          ...task,
          budgetReservationId: reservation.reservationId,
          reservedBudgetAmount: input.amount,
          updatedAt: input.now,
        }),
      );
    }
    return { reservation, workOrder: updatedOrder };
  }

  reconcileReservation(input: {
    readonly reservationId: string;
    readonly actualAmount: string;
    readonly now: UtcInstant;
    readonly customerId: string;
  }): EconomicWorkOrder | HeliosFailure {
    const reservation = this.reservations.get(input.reservationId);
    if (!reservation || reservation.customerId !== input.customerId) {
      return { code: 'WORK_ORDER_NOT_FOUND', message: 'reservation not found' };
    }
    const order = this.getWorkOrder(reservation.workOrderId, input.customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    const updatedBudget = applySpend(order.researchBudget, input.actualAmount, reservation.reservedAmount);
    const unused = (BigInt(reservation.reservedAmount) - BigInt(input.actualAmount)).toString();
    const finalBudget = releaseUnusedReservation(updatedBudget, reservation.reservedAmount, input.actualAmount);
    const updatedReservation = Object.freeze({
      ...reservation,
      reconciledAmount: input.actualAmount,
      releasedAmount: unused,
      state: 'RECONCILED' as const,
      updatedAt: input.now,
    });
    this.reservations.set(reservation.reservationId, updatedReservation);
    const updatedOrder = Object.freeze({
      ...order,
      researchBudget: Object.freeze({ ...finalBudget, remainingBudget: computeRemainingBudget(finalBudget) }),
      updatedAt: input.now,
      version: order.version + 1,
    });
    this.workOrders.set(order.workOrderId, updatedOrder);
    return updatedOrder;
  }

  putSpendRecord(record: ResearchSpendRecord): ResearchSpendRecord {
    this.spendRecords.set(record.spendId, record);
    return record;
  }

  listSpendForWorkOrder(workOrderId: string, customerId: string): readonly ResearchSpendRecord[] {
    return Object.freeze(
      [...this.spendRecords.values()].filter(
        (row) => row.workOrderId === workOrderId && row.customerId === customerId,
      ),
    );
  }

  recoverExpiredLeases(now: UtcInstant): readonly HeliosWorkTask[] {
    const recovered: HeliosWorkTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.state !== 'RUNNING' || !task.lease) continue;
      if (task.lease.expiresAt > now) continue;
      const next = Object.freeze({
        ...task,
        state: 'CLAIMABLE' as TaskState,
        lease: null,
        updatedAt: now,
      });
      this.tasks.set(task.taskId, next);
      recovered.push(next);
    }
    return Object.freeze(recovered);
  }

  appendAudit(event: HeliosAuditEvent): void {
    this.auditEvents.push(event);
  }

  listAudit(customerId?: string): readonly HeliosAuditEvent[] {
    return Object.freeze(
      customerId ? this.auditEvents.filter((row) => row.customerId === customerId) : [...this.auditEvents],
    );
  }

  snapshot(): HeliosStoreSnapshot {
    return Object.freeze({
      workOrders: Object.freeze([...this.workOrders.values()]),
      tasks: Object.freeze([...this.tasks.values()]),
      reservations: Object.freeze([...this.reservations.values()]),
      spendRecords: Object.freeze([...this.spendRecords.values()]),
      auditEvents: Object.freeze([...this.auditEvents]),
    });
  }

  loadState(state: HeliosStoreSnapshot): void {
    this.workOrders.clear();
    this.tasks.clear();
    this.reservations.clear();
    this.spendRecords.clear();
    this.auditEvents.length = 0;
    this.operationCompletions.clear();
    for (const order of state.workOrders) this.putWorkOrder(order);
    for (const task of state.tasks) {
      this.putTask(task);
      if (task.state === 'COMPLETED' && task.resultRef) {
        this.operationCompletions.set(task.operationIdentity, task.resultRef);
      }
    }
    for (const reservation of state.reservations) this.reservations.set(reservation.reservationId, reservation);
    for (const spend of state.spendRecords) this.putSpendRecord(spend);
    for (const event of state.auditEvents) this.auditEvents.push(event);
  }

  private promoteDependents(workOrderId: string, now: UtcInstant): void {
    for (const task of this.tasks.values()) {
      if (task.workOrderId !== workOrderId) continue;
      if (task.state !== 'QUEUED' && task.state !== 'WAITING') continue;
      if (!dependenciesMet(task, this.tasks)) continue;
      this.tasks.set(
        task.taskId,
        Object.freeze({ ...task, state: 'CLAIMABLE' as TaskState, updatedAt: now }),
      );
    }
  }
}

function dependenciesMet(task: HeliosWorkTask, tasks: Map<string, HeliosWorkTask>): boolean {
  for (const depId of task.dependencyTaskIds) {
    const dep = tasks.get(depId);
    if (!dep || dep.state !== 'COMPLETED') return false;
  }
  return true;
}
