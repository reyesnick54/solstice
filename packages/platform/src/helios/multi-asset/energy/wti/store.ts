/**
 * M08 — in-memory WTI market state store with restart snapshot support.
 */

import type { UtcInstant } from '@solstice/domain';
import type { WtiMarketObservation, WtiMarketState } from './types.ts';

export type WtiMarketStoreSnapshot = {
  readonly observations: Readonly<Record<string, WtiMarketObservation>>;
  readonly marketStates: readonly WtiMarketState[];
  readonly lastEvaluatedAt: UtcInstant | null;
};

export type WtiMarketStore = {
  readonly putObservation: (observation: WtiMarketObservation) => void;
  readonly getObservation: (instrumentId: string) => WtiMarketObservation | undefined;
  readonly putMarketState: (state: WtiMarketState) => void;
  readonly latestMarketState: () => WtiMarketState | undefined;
  readonly listObservations: () => readonly WtiMarketObservation[];
  readonly snapshot: () => WtiMarketStoreSnapshot;
  readonly restore: (snapshot: WtiMarketStoreSnapshot) => void;
};

export function createWtiMarketStore(): WtiMarketStore {
  const observations = new Map<string, WtiMarketObservation>();
  const marketStates: WtiMarketState[] = [];
  let lastEvaluatedAt: UtcInstant | null = null;

  return Object.freeze({
    putObservation(observation: WtiMarketObservation) {
      observations.set(observation.instrumentId, observation);
    },
    getObservation(instrumentId: string) {
      return observations.get(instrumentId);
    },
    putMarketState(state: WtiMarketState) {
      marketStates.push(state);
      lastEvaluatedAt = state.evaluatedAt;
    },
    latestMarketState() {
      return marketStates[marketStates.length - 1];
    },
    listObservations() {
      return Object.freeze([...observations.values()]);
    },
    snapshot() {
      return Object.freeze({
        observations: Object.freeze(Object.fromEntries(observations)),
        marketStates: Object.freeze([...marketStates]),
        lastEvaluatedAt,
      });
    },
    restore(snapshot: WtiMarketStoreSnapshot) {
      observations.clear();
      marketStates.length = 0;
      for (const [key, value] of Object.entries(snapshot.observations)) {
        observations.set(key, value);
      }
      marketStates.push(...snapshot.marketStates);
      lastEvaluatedAt = snapshot.lastEvaluatedAt;
    },
  });
}
