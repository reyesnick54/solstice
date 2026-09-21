import type { CustomerId } from '@solstice/domain';
import type { ExecutionPlanId, ExecutionPlanTransitionId } from './ids.ts';
import type {
  ExecutionPlan,
  ExecutionPlanStoreSnapshot,
  ExecutionPlanTransitionRecord,
} from './types.ts';

export class InMemoryHeliosExecutionPlanStore {
  private readonly plans = new Map<ExecutionPlanId, ExecutionPlan>();
  private readonly idempotencyIndex = new Map<string, ExecutionPlanId>();
  private readonly transitions = new Map<ExecutionPlanTransitionId, ExecutionPlanTransitionRecord>();
  private readonly processedTransitionIds = new Set<ExecutionPlanTransitionId>();

  private idempotencyKeyFor(plan: ExecutionPlan): string {
    return `${plan.workOrderId}:${plan.envelopeId}:${plan.idempotencyKey}`;
  }

  putPlan(plan: ExecutionPlan): void {
    const key = this.idempotencyKeyFor(plan);
    const existingId = this.idempotencyIndex.get(key);
    if (existingId && existingId !== plan.executionPlanId) {
      throw new Error(`execution plan idempotency collision: ${key}`);
    }
    this.idempotencyIndex.set(key, plan.executionPlanId);
    this.plans.set(plan.executionPlanId, plan);
  }

  updatePlan(plan: ExecutionPlan): void {
    if (!this.plans.has(plan.executionPlanId)) {
      throw new Error(`execution plan not found: ${plan.executionPlanId}`);
    }
    this.plans.set(plan.executionPlanId, plan);
  }

  getPlan(executionPlanId: ExecutionPlanId): ExecutionPlan | null {
    return this.plans.get(executionPlanId) ?? null;
  }

  getPlanByIdempotency(
    workOrderId: string,
    envelopeId: string,
    idempotencyKey: string,
  ): ExecutionPlan | null {
    const planId = this.idempotencyIndex.get(`${workOrderId}:${envelopeId}:${idempotencyKey}`);
    if (!planId) return null;
    return this.plans.get(planId) ?? null;
  }

  forCustomer(customerId: CustomerId): readonly ExecutionPlan[] {
    return Object.freeze([...this.plans.values()].filter((plan) => plan.customerId === customerId));
  }

  recordTransition(transition: ExecutionPlanTransitionRecord): boolean {
    if (this.processedTransitionIds.has(transition.transitionId)) {
      return false;
    }
    this.transitions.set(transition.transitionId, transition);
    this.processedTransitionIds.add(transition.transitionId);
    return true;
  }

  getTransition(transitionId: ExecutionPlanTransitionId): ExecutionPlanTransitionRecord | null {
    return this.transitions.get(transitionId) ?? null;
  }

  getTransitionsForPlan(executionPlanId: ExecutionPlanId): readonly ExecutionPlanTransitionRecord[] {
    return Object.freeze(
      [...this.transitions.values()].filter((row) => row.executionPlanId === executionPlanId),
    );
  }

  isTransitionProcessed(transitionId: ExecutionPlanTransitionId): boolean {
    return this.processedTransitionIds.has(transitionId);
  }

  snapshot(): ExecutionPlanStoreSnapshot {
    return Object.freeze({
      plans: Object.freeze([...this.plans.values()]),
      transitions: Object.freeze([...this.transitions.values()]),
      processedTransitionIds: Object.freeze([...this.processedTransitionIds]),
    });
  }

  restore(snapshot: ExecutionPlanStoreSnapshot): void {
    this.plans.clear();
    this.idempotencyIndex.clear();
    this.transitions.clear();
    this.processedTransitionIds.clear();
    for (const plan of snapshot.plans) {
      this.putPlan(plan);
    }
    for (const transition of snapshot.transitions) {
      this.transitions.set(transition.transitionId, transition);
    }
    for (const transitionId of snapshot.processedTransitionIds) {
      this.processedTransitionIds.add(transitionId);
    }
  }
}
