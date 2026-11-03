import type { UtcInstant } from '../imports.ts';

export type DecisionMemoryEntry = {
  readonly entryId: string;
  readonly subjectId: string;
  readonly workOrderId: string;
  readonly informationTime: UtcInstant;
  readonly finalRating: string;
  readonly decisionText: string;
  readonly reflection: string | null;
  readonly status: 'PENDING' | 'SETTLED';
};

export class TradingAgentsDecisionMemory {
  private readonly entries: DecisionMemoryEntry[] = [];

  loadPastContext(subjectId: string, asOf: UtcInstant): { readonly pastContext: string; readonly memoryNote: string } {
    const relevant = this.entries.filter((row) => row.subjectId === subjectId && row.informationTime <= asOf);
    if (relevant.length === 0) {
      return Object.freeze({ pastContext: '', memoryNote: '' });
    }
    const lines = relevant.slice(-5).map(
      (row) =>
        `[${row.informationTime}] ${row.finalRating} (${row.status}): ${row.decisionText.slice(0, 240)}`,
    );
    return Object.freeze({
      pastContext: lines.join('\n'),
      memoryNote: relevant.some((row) => row.status === 'PENDING') ? 'Pending memory entries await settlement.' : '',
    });
  }

  storeDecision(input: {
    readonly entryId: string;
    readonly subjectId: string;
    readonly workOrderId: string;
    readonly informationTime: UtcInstant;
    readonly finalRating: string;
    readonly decisionText: string;
  }): DecisionMemoryEntry {
    const duplicate = this.entries.some(
      (row) => row.subjectId === input.subjectId && row.workOrderId === input.workOrderId,
    );
    if (duplicate) {
      return this.entries.find(
        (row) => row.subjectId === input.subjectId && row.workOrderId === input.workOrderId,
      )!;
    }
    const entry: DecisionMemoryEntry = Object.freeze({
      entryId: input.entryId,
      subjectId: input.subjectId,
      workOrderId: input.workOrderId,
      informationTime: input.informationTime,
      finalRating: input.finalRating,
      decisionText: input.decisionText,
      reflection: null,
      status: 'PENDING',
    });
    this.entries.push(entry);
    return entry;
  }

  snapshot(): readonly DecisionMemoryEntry[] {
    return Object.freeze([...this.entries]);
  }
}
