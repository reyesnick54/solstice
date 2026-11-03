import type { ResearchTriggerEvidenceRecord, ResearchTriggerRunResult, TriggeredResearchWorkOrder } from './types.ts';
import type { ResearchTriggerRunId } from './ids.ts';

export class ResearchTriggerRouterStore {
  private readonly runs = new Map<ResearchTriggerRunId, ResearchTriggerRunResult>();
  private readonly workOrders = new Map<string, TriggeredResearchWorkOrder>();

  putRun(result: ResearchTriggerRunResult): void {
    this.runs.set(result.runId, result);
    if (result.triggeredWorkOrder) {
      this.workOrders.set(result.triggeredWorkOrder.triggeredWorkOrderId, result.triggeredWorkOrder);
    }
  }

  getRun(runId: ResearchTriggerRunId): ResearchTriggerRunResult | null {
    return this.runs.get(runId) ?? null;
  }

  getTriggeredWorkOrder(triggeredWorkOrderId: string): TriggeredResearchWorkOrder | null {
    return this.workOrders.get(triggeredWorkOrderId) ?? null;
  }

  listEvidence(): readonly ResearchTriggerEvidenceRecord[] {
    return Object.freeze(
      [...this.runs.values()]
        .map((run) => run.evidence)
        .filter((row): row is ResearchTriggerEvidenceRecord => row !== null),
    );
  }
}
