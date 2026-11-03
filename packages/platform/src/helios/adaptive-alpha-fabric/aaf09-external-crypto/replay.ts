/**
 * Deterministic replay from store snapshots.
 */

import type { Aaf09ObservationStore, Aaf09ObservationStoreSnapshot } from './store.ts';
import type { NormalizedCryptoMarketObservation } from './types.ts';

export type Aaf09ReplayResult = {
  readonly replayedCount: number;
  readonly observations: readonly NormalizedCryptoMarketObservation[];
  readonly grantsExecutionAuthority: false;
};

export function replayAaf09Snapshot(
  store: Aaf09ObservationStore,
  snapshot: Aaf09ObservationStoreSnapshot,
): Aaf09ReplayResult {
  store.clear();
  store.restore(snapshot);
  const observations = store.listAll();
  return Object.freeze({
    replayedCount: observations.length,
    observations,
    grantsExecutionAuthority: false,
  });
}
