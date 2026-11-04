import type { OptionChainSnapshot, OptionsEarningsExpectationState } from './types.ts';

export type OptionsEarningsIntelligenceStoreSnapshot = {
  readonly chains: readonly OptionChainSnapshot[];
  readonly states: readonly OptionsEarningsExpectationState[];
};

export interface OptionsEarningsIntelligenceStore {
  saveChain(snapshot: OptionChainSnapshot): void;
  saveExpectationState(state: OptionsEarningsExpectationState): void;
  getChain(snapshotId: string): OptionChainSnapshot | null;
  getExpectationState(earningsEventId: string): OptionsEarningsExpectationState | null;
  snapshot(): OptionsEarningsIntelligenceStoreSnapshot;
}

export class InMemoryOptionsEarningsIntelligenceStore implements OptionsEarningsIntelligenceStore {
  readonly #chains = new Map<string, OptionChainSnapshot>();
  readonly #states = new Map<string, OptionsEarningsExpectationState>();

  saveChain(snapshot: OptionChainSnapshot): void {
    this.#chains.set(snapshot.snapshotId, snapshot);
  }

  saveExpectationState(state: OptionsEarningsExpectationState): void {
    this.#states.set(state.earningsEventId, state);
  }

  getChain(snapshotId: string): OptionChainSnapshot | null {
    return this.#chains.get(snapshotId) ?? null;
  }

  getExpectationState(earningsEventId: string): OptionsEarningsExpectationState | null {
    return this.#states.get(earningsEventId) ?? null;
  }

  snapshot(): OptionsEarningsIntelligenceStoreSnapshot {
    return Object.freeze({
      chains: Object.freeze([...this.#chains.values()]),
      states: Object.freeze([...this.#states.values()]),
    });
  }
}
