import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import {
  authorityPermitsDispatch,
  bindWorkOrderAuthority,
  revalidateAuthority,
  rejectAuthorityExpansion,
} from './authority-binding.ts';
import {
  createSpendRecord,
  initialBudgetSnapshot,
  rejectBudgetSelfIncrease,
} from './budget.ts';
import { heliosAuditEvent } from './evidence.ts';
import {
  asEconomicWorkOrderId,
  asHeliosProgramId,
  asHeliosTaskId,
  taskIdFor,
  type HeliosTaskId,
} from './ids.ts';
import { collectHeliosMetrics } from './metrics.ts';
import { classifyTaskError, initialRetryMetadata, isRetryableCategory } from './retry.ts';
import { InMemoryHeliosWorkStore } from './execution-store.ts';
import type { BudgetUnitKind, HeliosCapability, HeliosTaskType, ModelClass } from './taxonomy.ts';
import type {
  HeliosExecutionWorkOrder,
  HeliosFailure,
  HeliosMetricsSnapshot,
  HeliosWorkTask,
  WorkOrderAuthorityBinding,
} from './execution-types.ts';

export type CreateWorkOrderInput = {
  readonly programId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly mandate: CompiledEconomicMandate;
  readonly capability: HeliosCapability;
  readonly approvalRef: string | null;
  readonly budgetCeiling: string;
  readonly budgetUnitKind: BudgetUnitKind;
  readonly budgetCurrency: string | null;
  readonly maxConcurrentTasks?: number;
  readonly priority?: number;
};

export type CreateTaskInput = {
  readonly workOrderId: string;
  readonly customerId: string;
  readonly operationIdentity: string;
  readonly taskType: HeliosTaskType;
  readonly requiredCapability: HeliosCapability;
  readonly permittedTools: readonly string[];
  readonly permittedModelClass: ModelClass;
  readonly requestedObjective: string;
  readonly dependencyTaskIds?: readonly HeliosTaskId[];
  readonly deadline?: UtcInstant | null;
  readonly priority?: number;
  readonly estimatedBudget?: string;
};

export type HeliosWorkOrchestratorPorts = {
  readonly clock: Clock;
  readonly evidence?: EvidenceVault;
  readonly mandateLookup?: (mandateId: string) => CompiledEconomicMandate | undefined;
};

export class HeliosWorkOrchestrator {
  readonly store = new InMemoryHeliosWorkStore();
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly mandateLookup?: (mandateId: string) => CompiledEconomicMandate | undefined;
  private pausedWorkOrders = new Set<string>();

  constructor(ports: HeliosWorkOrchestratorPorts) {
    this.clock = ports.clock;
    if (ports.evidence !== undefined) {
      this.evidence = ports.evidence;
    }
    if (ports.mandateLookup !== undefined) {
      this.mandateLookup = ports.mandateLookup;
    }
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  createWorkOrder(input: CreateWorkOrderInput): HeliosExecutionWorkOrder | HeliosFailure {
    const binding = bindWorkOrderAuthority({
      mandate: input.mandate,
      customerId: input.customerId,
      capability: input.capability,
      approvalRef: input.approvalRef,
      now: this.now(),
    });
    if ('code' in binding) return binding;
    const workOrderId = asEconomicWorkOrderId(`ewo_${randomUUID()}`);
    const order: HeliosExecutionWorkOrder = Object.freeze({
      workOrderId,
      programId: asHeliosProgramId(input.programId.startsWith('hpg_') ? input.programId : `hpg_${input.programId}`),
      customerId: input.customerId,
      subjectId: input.subjectId,
      state: 'ACTIVE',
      objective: input.objective,
      authority: binding,
      researchBudget: initialBudgetSnapshot({
        ceilingAmount: input.budgetCeiling,
        unitKind: input.budgetUnitKind,
        currency: input.budgetCurrency,
      }),
      maxConcurrentTasks: input.maxConcurrentTasks ?? 2,
      priority: input.priority ?? 0,
      createdAt: this.now(),
      updatedAt: this.now(),
      version: 1,
    });
    this.store.putWorkOrder(order);
    this.audit('work_order_created', order.customerId, `work order ${order.workOrderId} created`, {
      workOrderId: order.workOrderId,
    });
    return order;
  }

  createTask(input: CreateTaskInput): HeliosWorkTask | HeliosFailure {
    const order = this.store.getWorkOrder(input.workOrderId, input.customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    if (!this.canDispatch(order)) {
      return { code: 'WORK_ORDER_NOT_ACTIVE', message: `work order state is ${order.state}` };
    }
    const revalidated = this.revalidateOrderAuthority(order);
    if (!authorityPermitsDispatch(revalidated.authority)) {
      return { code: 'AUTHORITY_REVOKED', message: 'authority no longer permits task creation' };
    }
    const taskId = taskIdFor(input.workOrderId, input.operationIdentity);
    if (this.store.getTask(taskId, input.customerId)) {
      return this.store.getTask(taskId, input.customerId)!;
    }
    const hasDeps = (input.dependencyTaskIds?.length ?? 0) > 0;
    const task: HeliosWorkTask = Object.freeze({
      taskId,
      workOrderId: order.workOrderId,
      customerId: input.customerId,
      operationIdentity: input.operationIdentity,
      taskType: input.taskType,
      version: 1,
      state: hasDeps ? 'QUEUED' : 'CLAIMABLE',
      requiredCapability: input.requiredCapability,
      permittedTools: Object.freeze([...input.permittedTools]),
      permittedModelClass: input.permittedModelClass,
      requestedObjective: input.requestedObjective,
      dependencyTaskIds: Object.freeze([...(input.dependencyTaskIds ?? [])]),
      deadline: input.deadline ?? null,
      priority: input.priority ?? order.priority,
      authority: revalidated.authority,
      budgetReservationId: null,
      reservedBudgetAmount: null,
      accumulatedSpend: '0',
      budgetUnitKind: order.researchBudget.unitKind,
      resultRef: null,
      evidenceRefs: Object.freeze([]),
      failureReason: null,
      completedAt: null,
      lease: null,
      retry: initialRetryMetadata(),
      createdAt: this.now(),
      updatedAt: this.now(),
    });
    this.store.putTask(task);
    this.audit('task_created', task.customerId, `task ${task.taskId} created`, {
      workOrderId: order.workOrderId,
      taskId: task.taskId,
    });
    if (input.estimatedBudget) {
      const reserved = this.store.reserveBudgetAtomic({
        workOrderId: order.workOrderId,
        taskId: task.taskId,
        customerId: input.customerId,
        amount: input.estimatedBudget,
        now: this.now(),
      });
      if ('code' in reserved) return reserved;
      this.audit('budget_reserved', input.customerId, `reserved ${input.estimatedBudget} for ${task.taskId}`, {
        workOrderId: order.workOrderId,
        taskId: task.taskId,
      });
    }
    return this.store.getTask(task.taskId, input.customerId)!;
  }

  claimTask(input: {
    readonly taskId: string;
    readonly workOrderId: string;
    readonly customerId: string;
    readonly workerId: string;
    readonly leaseMs?: number;
  }): HeliosWorkTask | HeliosFailure {
    const existing = this.store.getWorkOrder(input.workOrderId, input.customerId);
    if (!existing) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    const order = this.revalidateOrderAuthority(existing);
    if (!this.canDispatch(order)) return { code: 'WORK_ORDER_NOT_ACTIVE', message: 'work order not dispatchable' };
    if (!authorityPermitsDispatch(order.authority)) {
      return { code: 'AUTHORITY_REVOKED', message: 'authority revoked' };
    }
    if (this.store.countRunningTasks(input.workOrderId) >= order.maxConcurrentTasks) {
      return { code: 'CONCURRENCY_LIMIT', message: 'work order concurrency limit reached' };
    }
    return this.store.claimTask({
      taskId: asHeliosTaskId(input.taskId),
      workerId: input.workerId,
      now: this.now(),
      leaseMs: input.leaseMs ?? 30_000,
      customerId: input.customerId,
      workOrderId: order.workOrderId,
    });
  }

  completeTask(input: {
    readonly taskId: string;
    readonly workOrderId: string;
    readonly customerId: string;
    readonly workerId: string;
    readonly leaseGeneration: number;
    readonly resultRef: string;
    readonly evidenceRefs?: readonly string[];
    readonly actualSpend?: string;
  }): HeliosWorkTask | HeliosFailure {
    const task = this.store.getTask(input.taskId, input.customerId);
    if (!task) return { code: 'TASK_NOT_FOUND', message: 'task not found' };
    const completed = this.store.completeTask({
      taskId: asHeliosTaskId(input.taskId),
      workerId: input.workerId,
      leaseGeneration: input.leaseGeneration,
      now: this.now(),
      customerId: input.customerId,
      resultRef: input.resultRef,
      evidenceRefs: input.evidenceRefs ?? [],
      operationIdentity: task.operationIdentity,
    });
    if ('code' in completed) return completed;
    const order = this.store.getWorkOrder(input.workOrderId, input.customerId)!;
    if (task.budgetReservationId && input.actualSpend !== undefined) {
      this.store.reconcileReservation({
        reservationId: task.budgetReservationId,
        actualAmount: input.actualSpend,
        now: this.now(),
        customerId: input.customerId,
      });
      const spend = createSpendRecord({
        workOrderId: order.workOrderId,
        taskId: completed.taskId,
        customerId: input.customerId,
        programId: order.programId,
        budgetCategory: task.budgetUnitKind,
        reservedAmount: task.reservedBudgetAmount ?? '0',
        actualAmount: input.actualSpend,
        estimatedAmount: null,
        costStatus: 'ACTUAL',
        currency: order.researchBudget.currency,
        attemptNumber: completed.retry.attemptCount,
        retryCausedAdditionalCost: completed.retry.attemptCount > 1,
        succeeded: true,
        now: this.now(),
      });
      this.store.putSpendRecord(spend);
      this.audit('spend_recorded', input.customerId, `spent ${input.actualSpend}`, {
        workOrderId: order.workOrderId,
        taskId: completed.taskId,
      });
    }
    this.audit('task_completed', input.customerId, `task ${input.taskId} completed`, {
      workOrderId: order.workOrderId,
      taskId: completed.taskId,
    });
    return completed;
  }

  failTask(input: {
    readonly taskId: string;
    readonly customerId: string;
    readonly workerId: string;
    readonly leaseGeneration: number;
    readonly error: unknown;
    readonly partialSpend?: string;
  }): HeliosWorkTask | HeliosFailure {
    const task = this.store.getTask(input.taskId, input.customerId);
    if (!task) return { code: 'TASK_NOT_FOUND', message: 'task not found' };
    const category = classifyTaskError(input.error);
    const failed = this.store.failTask({
      taskId: asHeliosTaskId(input.taskId),
      workerId: input.workerId,
      leaseGeneration: input.leaseGeneration,
      now: this.now(),
      customerId: input.customerId,
      failureReason: input.error instanceof Error ? input.error.message : String(input.error),
      failureCategory: category,
      retryable: isRetryableCategory(category),
    });
    if ('code' in failed) return failed;
    if (input.partialSpend && task.budgetReservationId) {
      this.store.reconcileReservation({
        reservationId: task.budgetReservationId,
        actualAmount: input.partialSpend,
        now: this.now(),
        customerId: input.customerId,
      });
      const order = this.store.getWorkOrder(task.workOrderId, input.customerId)!;
      const spend = createSpendRecord({
        workOrderId: order.workOrderId,
        taskId: task.taskId,
        customerId: input.customerId,
        programId: order.programId,
        budgetCategory: task.budgetUnitKind,
        reservedAmount: task.reservedBudgetAmount ?? '0',
        actualAmount: input.partialSpend,
        estimatedAmount: null,
        costStatus: 'ACTUAL',
        currency: order.researchBudget.currency,
        attemptNumber: failed.retry.attemptCount,
        retryCausedAdditionalCost: failed.retry.attemptCount > 1,
        succeeded: false,
        now: this.now(),
      });
      this.store.putSpendRecord(spend);
    }
    this.audit('task_failed', input.customerId, failed.failureReason ?? 'task failed', {
      workOrderId: task.workOrderId,
      taskId: task.taskId,
    });
    return failed;
  }

  cancelWorkOrder(workOrderId: string, customerId: string): HeliosExecutionWorkOrder | HeliosFailure {
    const order = this.store.getWorkOrder(workOrderId, customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    const updated = Object.freeze({
      ...order,
      state: 'CANCELLED' as const,
      updatedAt: this.now(),
      version: order.version + 1,
    });
    this.store.putWorkOrder(updated);
    for (const task of this.store.listTasksForWorkOrder(workOrderId, customerId)) {
      if (task.state === 'COMPLETED' || task.state === 'PERMANENTLY_FAILED') continue;
      this.store.putTask(
        Object.freeze({
          ...task,
          state: 'CANCELLED' as const,
          lease: null,
          updatedAt: this.now(),
        }),
      );
      this.audit('task_cancelled', customerId, `task ${task.taskId} cancelled`, {
        workOrderId: order.workOrderId,
        taskId: task.taskId,
      });
    }
    return updated;
  }

  pauseWorkOrder(workOrderId: string, customerId: string): HeliosExecutionWorkOrder | HeliosFailure {
    const order = this.store.getWorkOrder(workOrderId, customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    this.pausedWorkOrders.add(workOrderId);
    const updated = Object.freeze({
      ...order,
      state: 'PAUSED' as const,
      authority: revalidateAuthority(order.authority, this.lookupMandate(order.authority.mandateId), true),
      updatedAt: this.now(),
      version: order.version + 1,
    });
    this.store.putWorkOrder(updated);
    return updated;
  }

  revokeAuthority(workOrderId: string, customerId: string): HeliosExecutionWorkOrder | HeliosFailure {
    const order = this.store.getWorkOrder(workOrderId, customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    const updated = Object.freeze({
      ...order,
      state: 'BLOCKED_AUTHORITY' as const,
      authority: Object.freeze({ ...order.authority, revalidationState: 'REVOKED' as const }),
      updatedAt: this.now(),
      version: order.version + 1,
    });
    this.store.putWorkOrder(updated);
    this.audit('authority_revoked', customerId, `authority revoked for ${workOrderId}`, { workOrderId: order.workOrderId });
    return updated;
  }

  recoverAfterRestart(): readonly HeliosWorkTask[] {
    const recovered = this.store.recoverExpiredLeases(this.now());
    for (const task of recovered) {
      this.audit('lease_expired', task.customerId, `lease expired for ${task.taskId}`, {
        workOrderId: task.workOrderId,
        taskId: task.taskId,
      });
    }
    return recovered;
  }

  attemptBudgetEscalation(workOrderId: string, customerId: string, newCeiling: string): HeliosFailure {
    const order = this.store.getWorkOrder(workOrderId, customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    const rejection = rejectBudgetSelfIncrease(order.researchBudget.authorizedCeiling, newCeiling);
    return rejection ?? { code: 'BUDGET_SELF_INCREASE_FORBIDDEN', message: 'budget escalation rejected' };
  }

  attemptAuthorityEscalation(
    workOrderId: string,
    customerId: string,
    proposed: Partial<WorkOrderAuthorityBinding>,
  ): HeliosFailure {
    const order = this.store.getWorkOrder(workOrderId, customerId);
    if (!order) return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
    const rejection = rejectAuthorityExpansion(order.authority, proposed);
    return rejection ?? { code: 'AUTHORITY_EXPANSION_FORBIDDEN', message: 'authority escalation rejected' };
  }

  metrics(): HeliosMetricsSnapshot {
    return collectHeliosMetrics(this.store, this.now());
  }

  loadSnapshot(snapshot: ReturnType<InMemoryHeliosWorkStore['snapshot']>): void {
    this.store.loadState(snapshot);
  }

  snapshot(): ReturnType<InMemoryHeliosWorkStore['snapshot']> {
    return this.store.snapshot();
  }

  static fromSnapshot(ports: HeliosWorkOrchestratorPorts, snapshot: ReturnType<InMemoryHeliosWorkStore['snapshot']>): HeliosWorkOrchestrator {
    const instance = new HeliosWorkOrchestrator(ports);
    instance.loadSnapshot(snapshot);
    return instance;
  }

  private canDispatch(order: HeliosExecutionWorkOrder): boolean {
    if (order.state !== 'ACTIVE') return false;
    if (this.pausedWorkOrders.has(order.workOrderId)) return false;
    if (BigInt(order.researchBudget.remainingBudget) <= 0n) return false;
    return true;
  }

  private revalidateOrderAuthority(order: HeliosExecutionWorkOrder): HeliosExecutionWorkOrder {
    const mandate = this.lookupMandate(order.authority.mandateId);
    const authority = revalidateAuthority(
      order.authority,
      mandate,
      this.pausedWorkOrders.has(order.workOrderId),
    );
    if (!authorityPermitsDispatch(authority) && order.state === 'ACTIVE') {
      const blocked = Object.freeze({
        ...order,
        state: authority.revalidationState === 'REVOKED' ? ('BLOCKED_AUTHORITY' as const) : order.state,
        authority,
        updatedAt: this.now(),
        version: order.version + 1,
      });
      this.store.putWorkOrder(blocked);
      return blocked;
    }
    if (BigInt(order.researchBudget.remainingBudget) <= 0n && order.state === 'ACTIVE') {
      const blocked = Object.freeze({
        ...order,
        state: 'BLOCKED_BUDGET' as const,
        updatedAt: this.now(),
        version: order.version + 1,
      });
      this.store.putWorkOrder(blocked);
      this.audit('work_order_blocked_budget', order.customerId, 'research budget exhausted', {
        workOrderId: order.workOrderId,
      });
      return blocked;
    }
    const refreshed = Object.freeze({ ...order, authority, updatedAt: this.now() });
    this.store.putWorkOrder(refreshed);
    return refreshed;
  }

  private lookupMandate(mandateId: string): CompiledEconomicMandate | undefined {
    return this.mandateLookup?.(mandateId);
  }

  private audit(
    kind: import('./taxonomy.ts').HeliosAuditEventKind,
    customerId: string,
    detail: string,
    ids: { workOrderId?: import('./ids.ts').EconomicWorkOrderId; taskId?: import('./ids.ts').HeliosTaskId },
  ): void {
    const event = heliosAuditEvent(kind, this.now(), customerId, detail, ids);
    this.store.appendAudit(event);
    this.evidence?.seal(`HELIOS_${kind}`, { detail, actorId: 'helios_orchestrator', ...ids });
  }
}
