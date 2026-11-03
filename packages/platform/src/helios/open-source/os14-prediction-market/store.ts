import type { PredictionMarketObservation, PredictionMarketState, PredictionMarketStoreSnapshot } from './types.ts';

export type PredictionMarketResearchStore = {
  putState(state: PredictionMarketState): void;
  getState(instrumentId: string): PredictionMarketState | null;
  appendObservation(observation: PredictionMarketObservation): void;
  listObservations(instrumentId?: string): readonly PredictionMarketObservation[];
  snapshot(): PredictionMarketStoreSnapshot;
  restore(snapshot: PredictionMarketStoreSnapshot): void;
};

export function createPredictionMarketResearchStore(): PredictionMarketResearchStore {
  const states = new Map<string, PredictionMarketState>();
  const observations: PredictionMarketObservation[] = [];

  return {
    putState(state) {
      states.set(state.instrument.instrumentId, state);
    },
    getState(instrumentId) {
      return states.get(instrumentId) ?? null;
    },
    appendObservation(observation) {
      observations.push(observation);
    },
    listObservations(instrumentId) {
      if (!instrumentId) {
        return Object.freeze([...observations]);
      }
      return Object.freeze(observations.filter((row) => row.instrumentId === instrumentId));
    },
    snapshot() {
      const stateRecord: Record<string, PredictionMarketState> = {};
      for (const [key, value] of states) {
        stateRecord[key] = value;
      }
      return Object.freeze({
        states: Object.freeze(stateRecord),
        observations: Object.freeze([...observations]),
      });
    },
    restore(snapshot) {
      states.clear();
      observations.length = 0;
      for (const [key, value] of Object.entries(snapshot.states)) {
        states.set(key, value);
      }
      observations.push(...snapshot.observations);
    },
  };
}
