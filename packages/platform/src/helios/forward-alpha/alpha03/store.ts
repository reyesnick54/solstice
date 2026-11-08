import type { PrequentialDecision, PrequentialState } from './types.ts';

export type PrequentialCampaignSnapshot = Readonly<{
  readonly state: PrequentialState;
  readonly snapshotDigest: string;
}>;

export class PrequentialCampaignStore {
  private state: PrequentialState;

  constructor(initial: PrequentialState) {
    this.state = initial;
  }

  getState(): PrequentialState {
    return this.state;
  }

  hasDecision(decisionId: string): boolean {
    return this.state.decisions.some((row) => row.decisionId === decisionId);
  }

  getDecision(decisionId: string): PrequentialDecision | undefined {
    return this.state.decisions.find((row) => row.decisionId === decisionId);
  }

  listDecisions(): readonly PrequentialDecision[] {
    return this.state.decisions;
  }

  putDecision(decision: PrequentialDecision): void {
    const existing = this.state.decisions.find((row) => row.decisionId === decision.decisionId);
    if (existing !== undefined) {
      if (existing.seal.contentHash !== decision.seal.contentHash) {
        throw new Error('PREQUENTIAL_REPLAY_SEALED_DECISION');
      }
      const merged = this.state.decisions.map((row) =>
        row.decisionId === decision.decisionId ? decision : row,
      );
      this.state = Object.freeze({ ...this.state, decisions: Object.freeze(merged) });
      return;
    }
    this.state = Object.freeze({
      ...this.state,
      decisions: Object.freeze([...this.state.decisions, decision]),
    });
  }

  replaceState(next: PrequentialState): void {
    this.state = next;
  }

  /**
   * Simulates process / database restart by swapping in persisted state.
   */
  rehydrate(persisted: PrequentialState): void {
    for (const row of persisted.decisions) {
      const local = this.getDecision(row.decisionId);
      if (local !== undefined && local.seal.contentHash !== row.seal.contentHash) {
        throw new Error('PREQUENTIAL_REPLAY_SEALED_DECISION');
      }
    }
    this.state = persisted;
  }
}
