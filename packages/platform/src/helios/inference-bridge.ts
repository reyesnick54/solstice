import type { ResearchBudgetPort, ResearchBudgetReconciliation, ResearchBudgetReservationRequest } from '../../../ai-runtime/src/async-inference/budget-port.ts';
import type { HeliosWorkOrchestrator } from './orchestrator.ts';
import { createSpendRecord } from './budget.ts';
import type { SpendCostStatus } from './taxonomy.ts';

/**
 * Bridges HELIOS H06 research budget reservations to the canonical async
 * inference executor without letting inference bypass Work Order ceilings.
 */
export class HeliosResearchBudgetPort implements ResearchBudgetPort {
  private readonly orchestrator: HeliosWorkOrchestrator;

  constructor(orchestrator: HeliosWorkOrchestrator) {
    this.orchestrator = orchestrator;
  }

  reserve(request: ResearchBudgetReservationRequest): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
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

  reconcile(input: ResearchBudgetReconciliation): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
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
