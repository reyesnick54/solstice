/**
 * In-memory observation store with replay snapshot support.
 */

import type { NormalizedCryptoMarketObservation } from './types.ts';

export type Aaf09ObservationStoreSnapshot = {
  readonly observations: readonly NormalizedCryptoMarketObservation[];
  readonly lastSequenceByInstrument: Readonly<Record<string, string>>;
};

export type Aaf09ObservationStore = {
  append(observation: NormalizedCryptoMarketObservation): void;
  listByInstrument(instrumentId: string): readonly NormalizedCryptoMarketObservation[];
  listAll(): readonly NormalizedCryptoMarketObservation[];
  lastSequenceFor(instrumentId: string): string | null;
  snapshot(): Aaf09ObservationStoreSnapshot;
  restore(snapshot: Aaf09ObservationStoreSnapshot): void;
  clear(): void;
};

export function createAaf09ObservationStore(): Aaf09ObservationStore {
  const observations: NormalizedCryptoMarketObservation[] = [];
  const byInstrument = new Map<string, NormalizedCryptoMarketObservation[]>();
  const lastSequence = new Map<string, string>();

  function append(observation: NormalizedCryptoMarketObservation): void {
    observations.push(observation);
    const bucket = byInstrument.get(observation.instrumentId) ?? [];
    bucket.push(observation);
    byInstrument.set(observation.instrumentId, bucket);
    if (observation.sequenceId) {
      lastSequence.set(observation.instrumentId, observation.sequenceId);
    }
  }

  return {
    append,
    listByInstrument(instrumentId: string) {
      return Object.freeze([...(byInstrument.get(instrumentId) ?? [])]);
    },
    listAll() {
      return Object.freeze([...observations]);
    },
    lastSequenceFor(instrumentId: string) {
      return lastSequence.get(instrumentId) ?? null;
    },
    snapshot() {
      const seq: Record<string, string> = {};
      for (const [key, value] of lastSequence.entries()) {
        seq[key] = value;
      }
      return Object.freeze({
        observations: Object.freeze([...observations]),
        lastSequenceByInstrument: Object.freeze(seq),
      });
    },
    restore(snapshot: Aaf09ObservationStoreSnapshot) {
      observations.length = 0;
      byInstrument.clear();
      lastSequence.clear();
      for (const observation of snapshot.observations) {
        append(observation);
      }
      for (const [instrumentId, sequenceId] of Object.entries(snapshot.lastSequenceByInstrument)) {
        lastSequence.set(instrumentId, sequenceId);
      }
    },
    clear() {
      observations.length = 0;
      byInstrument.clear();
      lastSequence.clear();
    },
  };
}
