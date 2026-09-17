import type { CustomerId } from '@solstice/domain';
import type {
  CalibrationRecord,
  CostAttributionRecord,
  MetaAllocationDecision,
  MetaAllocationRunResult,
  MetaAllocatorStoreSnapshot,
} from './types.ts';
import type { MetaAllocationDecisionId, MetaAllocationRunId } from './ids.ts';

export class InMemoryHeliosMetaAllocatorStore {
  private readonly runs = new Map<MetaAllocationRunId, MetaAllocationRunResult>();
  private readonly decisions = new Map<MetaAllocationDecisionId, MetaAllocationDecision>();
  private readonly calibrationRecords: CalibrationRecord[] = [];
  private readonly costRecords: CostAttributionRecord[] = [];

  putRun(run: MetaAllocationRunResult): void {
    this.runs.set(run.runId, run);
    for (const decision of run.decisions) {
      this.decisions.set(decision.decisionId, decision);
    }
  }

  getRun(id: MetaAllocationRunId): MetaAllocationRunResult | undefined {
    return this.runs.get(id);
  }

  getDecision(id: MetaAllocationDecisionId): MetaAllocationDecision | undefined {
    return this.decisions.get(id);
  }

  listDecisionsForCustomer(customerId: CustomerId): readonly MetaAllocationDecision[] {
    return [...this.decisions.values()].filter((row) => row.customerId === customerId);
  }

  listRunsForCustomer(customerId: CustomerId): readonly MetaAllocationRunResult[] {
    return [...this.runs.values()].filter((row) => row.customerId === customerId);
  }

  addCalibrationRecord(record: CalibrationRecord): void {
    this.calibrationRecords.push(record);
  }

  addCostRecord(record: CostAttributionRecord): void {
    this.costRecords.push(record);
  }

  snapshot(): MetaAllocatorStoreSnapshot {
    return Object.freeze({
      runs: Object.freeze([...this.runs.values()]),
      decisions: Object.freeze([...this.decisions.values()]),
      calibrationRecords: Object.freeze([...this.calibrationRecords]),
      costRecords: Object.freeze([...this.costRecords]),
    });
  }

  restore(snapshot: MetaAllocatorStoreSnapshot): void {
    this.runs.clear();
    this.decisions.clear();
    this.calibrationRecords.length = 0;
    this.costRecords.length = 0;
    for (const run of snapshot.runs) {
      this.runs.set(run.runId, run);
    }
    for (const decision of snapshot.decisions) {
      this.decisions.set(decision.decisionId, decision);
    }
    this.calibrationRecords.push(...snapshot.calibrationRecords);
    this.costRecords.push(...snapshot.costRecords);
  }
}
