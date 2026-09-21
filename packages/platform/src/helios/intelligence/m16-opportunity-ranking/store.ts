import type { OpportunityRankingStoreSnapshot, RankingRunResult } from './types.ts';

export class InMemoryOpportunityRankingStore {
  private readonly runs = new Map<string, RankingRunResult>();

  saveRun(result: RankingRunResult): void {
    this.runs.set(result.runId, Object.freeze({ ...result }));
  }

  getRun(runId: string): RankingRunResult | null {
    return this.runs.get(runId) ?? null;
  }

  snapshot(): OpportunityRankingStoreSnapshot {
    const runs = [...this.runs.values()].sort((a, b) => a.runId.localeCompare(b.runId));
    return Object.freeze({ runs: Object.freeze(runs) });
  }

  restore(snapshot: OpportunityRankingStoreSnapshot): void {
    this.runs.clear();
    for (const run of snapshot.runs) {
      this.runs.set(run.runId, run);
    }
  }
}
