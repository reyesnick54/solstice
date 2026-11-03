import type { UtcInstant } from '@solstice/domain';
import type { SerisNative12PipelineStage } from './taxonomy.ts';
import { SERIS_STRATEGY_RUN_HISTORY_CAP } from './taxonomy.ts';

export type SerisStrategyRunRecord = {
  readonly runId: string;
  readonly proposalId: string;
  readonly strategyId: string | null;
  readonly strategyVersion: string | null;
  readonly stageReached: SerisNative12PipelineStage;
  readonly stagesCompleted: readonly SerisNative12PipelineStage[];
  readonly ok: boolean;
  readonly summary: string;
  readonly metricsHash: string | null;
  readonly marketSymbol: string;
  readonly startedAt: UtcInstant;
  readonly endedAt: UtcInstant;
  readonly shadowRunId: string | null;
  readonly paperRunId: string | null;
  readonly liveExecutionAttempted: false;
};

export class SerisStrategyRunStore {
  readonly #runs = new Map<string, SerisStrategyRunRecord>();
  readonly #historyByProposal = new Map<string, string[]>();

  putRun(record: SerisStrategyRunRecord): void {
    this.#runs.set(record.runId, Object.freeze({ ...record }));
    const list = this.#historyByProposal.get(record.proposalId) ?? [];
    const next = [record.runId, ...list.filter((id) => id !== record.runId)];
    if (next.length > SERIS_STRATEGY_RUN_HISTORY_CAP) {
      next.length = SERIS_STRATEGY_RUN_HISTORY_CAP;
    }
    this.#historyByProposal.set(record.proposalId, next);
  }

  getRun(runId: string): SerisStrategyRunRecord | undefined {
    return this.#runs.get(runId);
  }

  listRunsForProposal(proposalId: string): readonly SerisStrategyRunRecord[] {
    const ids = this.#historyByProposal.get(proposalId) ?? [];
    return Object.freeze(
      ids
        .map((id) => this.#runs.get(id))
        .filter((row): row is SerisStrategyRunRecord => row !== undefined),
    );
  }

  snapshot(): readonly SerisStrategyRunRecord[] {
    return Object.freeze([...this.#runs.values()]);
  }
}
