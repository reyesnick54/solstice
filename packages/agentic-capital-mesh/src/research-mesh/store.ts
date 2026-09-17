import type {
  MetaAllocatorOutput,
  ResearchMeshBudgetSnapshot,
  ResearchMeshRun,
  ResearchMeshSnapshot,
  SpecialistTaskOutput,
} from './types.ts';

export class ResearchMeshStore {
  private readonly runs = new Map<string, ResearchMeshRun>();
  private readonly taskOutputs: SpecialistTaskOutput[] = [];
  private readonly metaOutputs: MetaAllocatorOutput[] = [];
  private readonly budgetSnapshots: ResearchMeshBudgetSnapshot[] = [];

  putRun(run: ResearchMeshRun): void {
    this.runs.set(run.runId, run);
  }

  getRun(runId: string): ResearchMeshRun | undefined {
    return this.runs.get(runId);
  }

  putTaskOutput(output: SpecialistTaskOutput): void {
    this.taskOutputs.push(output);
  }

  putMetaOutput(output: MetaAllocatorOutput): void {
    this.metaOutputs.push(output);
  }

  putBudgetSnapshot(snapshot: ResearchMeshBudgetSnapshot): void {
    this.budgetSnapshots.push(snapshot);
  }

  outputsForRun(runId: string): readonly SpecialistTaskOutput[] {
    const run = this.runs.get(runId);
    if (!run) {
      return Object.freeze([]);
    }
    return Object.freeze(this.taskOutputs.filter((row) => row.workOrderId === run.workOrderId));
  }

  snapshot(): ResearchMeshSnapshot {
    return Object.freeze({
      runs: Object.freeze([...this.runs.values()]),
      taskOutputs: Object.freeze([...this.taskOutputs]),
      metaOutputs: Object.freeze([...this.metaOutputs]),
      budgetSnapshots: Object.freeze([...this.budgetSnapshots]),
    });
  }

  restore(snapshot: ResearchMeshSnapshot): void {
    this.runs.clear();
    this.taskOutputs.length = 0;
    this.metaOutputs.length = 0;
    this.budgetSnapshots.length = 0;
    for (const run of snapshot.runs) {
      this.runs.set(run.runId, run);
    }
    this.taskOutputs.push(...snapshot.taskOutputs);
    this.metaOutputs.push(...snapshot.metaOutputs);
    this.budgetSnapshots.push(...snapshot.budgetSnapshots);
  }
}
