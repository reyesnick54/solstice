import { HeliosWorkOrchestrator } from './orchestrator.ts';
import type { HeliosFailure, HeliosWorkTask } from './execution-types.ts';

export type TaskHandler = (task: HeliosWorkTask) => Promise<{
  readonly resultRef: string;
  readonly evidenceRefs?: readonly string[];
  readonly actualSpend?: string;
}>;

export class HeliosTaskWorker {
  private readonly orchestrator: HeliosWorkOrchestrator;
  private readonly workerId: string;
  private readonly handlers = new Map<string, TaskHandler>();

  constructor(input: { readonly orchestrator: HeliosWorkOrchestrator; readonly workerId: string }) {
    this.orchestrator = input.orchestrator;
    this.workerId = input.workerId;
  }

  register(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  async dispatchOnce(input: {
    readonly workOrderId: string;
    readonly customerId: string;
    readonly limit?: number;
    readonly leaseMs?: number;
  }): Promise<{ succeeded: number; failed: number; skipped: number }> {
    const order = this.orchestrator.store.getWorkOrder(input.workOrderId, input.customerId);
    if (!order) return { succeeded: 0, failed: 0, skipped: 0 };
    const claimable = this.orchestrator.store.listClaimableTasks(input.workOrderId, this.orchestrator.now(), input.customerId);
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const limit = input.limit ?? 5;
    for (const candidate of claimable.slice(0, limit)) {
      const claimed = this.orchestrator.claimTask({
        taskId: candidate.taskId,
        workOrderId: input.workOrderId,
        customerId: input.customerId,
        workerId: this.workerId,
        ...(input.leaseMs !== undefined ? { leaseMs: input.leaseMs } : {}),
      });
      if ('code' in claimed) {
        skipped += 1;
        continue;
      }
      const handler = this.handlers.get(claimed.taskType);
      if (!handler) {
        const failedTask = this.orchestrator.failTask({
          taskId: claimed.taskId,
          customerId: input.customerId,
          workerId: this.workerId,
          leaseGeneration: claimed.lease!.leaseGeneration,
          error: new Error('no handler registered'),
        });
        failed += 'code' in failedTask ? 0 : 1;
        continue;
      }
      try {
        const outcome = await handler(claimed);
        const completed = this.orchestrator.completeTask({
          taskId: claimed.taskId,
          workOrderId: input.workOrderId,
          customerId: input.customerId,
          workerId: this.workerId,
          leaseGeneration: claimed.lease!.leaseGeneration,
          resultRef: outcome.resultRef,
          ...(outcome.evidenceRefs !== undefined ? { evidenceRefs: outcome.evidenceRefs } : {}),
          ...(outcome.actualSpend !== undefined ? { actualSpend: outcome.actualSpend } : {}),
        });
        if ('code' in completed) {
          failed += 1;
        } else {
          succeeded += 1;
        }
      } catch (error) {
        const failedTask = this.orchestrator.failTask({
          taskId: claimed.taskId,
          customerId: input.customerId,
          workerId: this.workerId,
          leaseGeneration: claimed.lease!.leaseGeneration,
          error,
        });
        failed += 'code' in failedTask ? 0 : 1;
      }
    }
    return { succeeded, failed, skipped };
  }

  recover(): readonly HeliosWorkTask[] {
    return this.orchestrator.recoverAfterRestart();
  }
}

export function restartWorker(input: {
  readonly ports: import('./orchestrator.ts').HeliosWorkOrchestratorPorts;
  readonly workerId: string;
  readonly snapshot: ReturnType<HeliosWorkOrchestrator['snapshot']>;
}): HeliosTaskWorker {
  const restarted = HeliosWorkOrchestrator.fromSnapshot(input.ports, input.snapshot);
  restarted.recoverAfterRestart();
  return new HeliosTaskWorker({ orchestrator: restarted, workerId: input.workerId });
}

export type WorkerRestartResult =
  | { readonly ok: true; readonly worker: HeliosTaskWorker }
  | HeliosFailure;
