import type { PredictionMarketStoreSnapshot } from './types.ts';

export type PredictionMarketStore = {
  snapshot(): PredictionMarketStoreSnapshot;
  replace(next: PredictionMarketStoreSnapshot): void;
};

export function createPredictionMarketStore(
  initial: PredictionMarketStoreSnapshot,
): PredictionMarketStore {
  let state = initial;
  return Object.freeze({
    snapshot: () => state,
    replace: (next) => {
      state = next;
    },
  });
}

export function emptyPredictionMarketStore(): PredictionMarketStoreSnapshot {
  return Object.freeze({
    events: Object.freeze([]),
    books: Object.freeze([]),
    positions: Object.freeze([]),
    twinOrders: Object.freeze([]),
    entityBindings: Object.freeze([]),
  });
}
