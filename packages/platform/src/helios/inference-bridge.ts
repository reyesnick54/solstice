import type { HeliosWorkOrchestrator } from './orchestrator.ts';
import { createSpendRecord } from './budget.ts';
import type { SpendCostStatus } from './taxonomy.ts';

/** Structural mirror of ai-runtime ResearchBudgetPort for HELIOS composition at the API layer. */
export type HeliosResearchBudgetReservationRequest = {
  readonly workOrderId: string;
  readonly taskId: string | null;
  readonly customerId: string;
  readonly reservationRef: string;
  readonly amountMicros: string;
  readonly unitKind: 'MONETARY_MINOR' | 'INPUT_TOKENS' | 'OUTPUT_TOKENS' | 'INFERENCE_CALLS';
};

export type HeliosResearchBudgetReconciliation = {
  readonly reservationRef: string;
  readonly actualMicros: string;
  readonly estimatedMicros: string | null;
  readonly costStatus: SpendCostStatus;
  readonly succeeded: boolean;
  readonly cancelled: boolean;
};

export type HeliosResearchBudgetPortContract = {
  readonly reserve: (
    request: HeliosResearchBudgetReservationRequest,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
  readonly reconcile: (
    input: HeliosResearchBudgetReconciliation,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
};

/**
 * Bridges HELIOS H06 research budget reservations to the canonical async
 * inference executor without letting inference bypass Work Order ceilings.
 */
export class HeliosResearchBudgetPort implements HeliosResearchBudgetPortContract {
  private readonly orchestrator: HeliosWorkOrchestrator;

  constructor(orchestrator: HeliosWorkOrchestrator) {
    this.orchestrator = orchestrator;
  }

  reserve(
    request: HeliosResearchBudgetReservationRequest,
  ): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    if (!request.taskId) {
      return { ok: false, code: 'TASK_REQUIRED', message: 'HELIOS budget reservation requires a task id' };
    }
    const reserved = this.orchestrator.store.reserveBudgetAtomic({
      workOrderId: request.workOrderId,
      taskId: request.taskId,
      customerId: request.customerId,
      amount: request.amountMicros,
      now: this.orchestrator.now(),
    });
    if ('code' in reserved) {
      return { ok: false, code: reserved.code, message: reserved.message };
    }
    return { ok: true };
  }

  reconcile(
    input: HeliosResearchBudgetReconciliation,
  ): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    void input;
    return { ok: true };
  }
}

export function recordHeliosInferenceSpend(input: {
  readonly orchestrator: HeliosWorkOrchestrator;
  readonly workOrderId: string;
  readonly taskId: string;
  readonly customerId: string;
  readonly programId: string;
  readonly reservedAmount: string;
  readonly actualAmount: string;
  readonly estimatedAmount: string | null;
  readonly costStatus: SpendCostStatus;
  readonly providerId: string | null;
  readonly modelId: string | null;
  readonly succeeded: boolean;
  readonly cancelled: boolean;
  readonly attemptNumber: number;
}): ReturnType<HeliosWorkOrchestrator['completeTask']> {
  const order = input.orchestrator.store.getWorkOrder(input.workOrderId, input.customerId);
  if (!order) {
    return { code: 'WORK_ORDER_NOT_FOUND', message: 'work order not found' };
  }
  const spend = createSpendRecord({
    workOrderId: order.workOrderId,
    taskId: input.taskId as import('./ids.ts').HeliosTaskId,
    customerId: input.customerId,
    programId: order.programId,
    budgetCategory: order.researchBudget.unitKind,
    reservedAmount: input.reservedAmount,
    actualAmount: input.actualAmount,
    estimatedAmount: input.estimatedAmount,
    costStatus: input.costStatus,
    currency: order.researchBudget.currency,
    attemptNumber: input.attemptNumber,
    retryCausedAdditionalCost: input.attemptNumber > 1,
    succeeded: input.succeeded,
    providerId: input.providerId,
    modelId: input.modelId,
    now: input.orchestrator.now(),
  });
  input.orchestrator.store.putSpendRecord(spend);
  return input.orchestrator.completeTask({
    taskId: input.taskId,
    workOrderId: input.workOrderId,
    customerId: input.customerId,
    workerId: 'helios_inference_worker',
    leaseGeneration: input.orchestrator.store.getTask(input.taskId, input.customerId)?.lease?.leaseGeneration ?? 0,
    resultRef: `inference:${input.taskId}`,
    actualSpend: input.actualAmount,
  });
}
