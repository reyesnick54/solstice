/**
 * In-memory observation store with restart snapshot support.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { HeliosMarketObservationEnvelope } from './types.ts';
import type { HeliosDeduplicationState } from './deduplication.ts';
import { createHeliosDeduplicationState, restoreDeduplicationState, snapshotDeduplicationState } from './deduplication.ts';

export type HeliosObservationStoreSnapshot = {
  readonly observations: readonly HeliosMarketObservationEnvelope[];
  readonly deduplication: ReturnType<typeof snapshotDeduplicationState>;
  readonly upstreamRefs: readonly string[];
  readonly duplicateEventKeys: readonly string[];
  readonly lastSequenceByInstrument: Readonly<Record<string, number>>;
  readonly lastSourceEventTimeByInstrument: Readonly<Record<string, UtcInstant>>;
};

export type HeliosObservationStore = {
  readonly get: (observationId: string) => HeliosMarketObservationEnvelope | undefined;
  readonly list: () => readonly HeliosMarketObservationEnvelope[];
  readonly listByInstrument: (canonicalInstrumentId: string) => readonly HeliosMarketObservationEnvelope[];
  readonly put: (envelope: HeliosMarketObservationEnvelope) => void;
  readonly deduplicationState: () => HeliosDeduplicationState;
  readonly upstreamRefs: () => ReadonlySet<string>;
  readonly duplicateEventKeys: () => ReadonlySet<string>;
  readonly lastSequenceFor: (canonicalInstrumentId: string) => number | null;
  readonly lastSourceEventTimeFor: (canonicalInstrumentId: string) => UtcInstant | null;
  readonly recordSequence: (canonicalInstrumentId: string, sequence: number) => void;
  readonly recordSourceEventTime: (canonicalInstrumentId: string, sourceEventTime: UtcInstant) => void;
  readonly snapshot: () => HeliosObservationStoreSnapshot;
  readonly restore: (snapshot: HeliosObservationStoreSnapshot) => void;
};

export function createHeliosObservationStore(): HeliosObservationStore {
  const observations = new Map<string, HeliosMarketObservationEnvelope>();
  const byInstrument = new Map<string, HeliosMarketObservationEnvelope[]>();
  let dedup = createHeliosDeduplicationState();
  const upstreamRefs = new Set<string>();
  const duplicateEventKeys = new Set<string>();
  const lastSequenceByInstrument = new Map<string, number>();
  const lastSourceEventTimeByInstrument = new Map<string, UtcInstant>();

  function put(envelope: HeliosMarketObservationEnvelope): void {
    observations.set(envelope.observationId, envelope);
    const list = byInstrument.get(envelope.canonicalInstrumentId) ?? [];
    list.push(envelope);
    byInstrument.set(envelope.canonicalInstrumentId, list);
    if (envelope.lineage.upstreamSourceRef) {
      upstreamRefs.add(envelope.lineage.upstreamSourceRef);
    }
    if (envelope.lineage.duplicateEventKey) {
      duplicateEventKeys.add(envelope.lineage.duplicateEventKey);
    }
  }

  return Object.freeze({
    get(observationId: string) {
      return observations.get(observationId);
    },
    list() {
      return Object.freeze([...observations.values()]);
    },
    listByInstrument(canonicalInstrumentId: string) {
      return Object.freeze([...(byInstrument.get(canonicalInstrumentId) ?? [])]);
    },
    put,
    deduplicationState() {
      return dedup;
    },
    upstreamRefs() {
      return upstreamRefs;
    },
    duplicateEventKeys() {
      return duplicateEventKeys;
    },
    lastSequenceFor(canonicalInstrumentId: string) {
      return lastSequenceByInstrument.get(canonicalInstrumentId) ?? null;
    },
    lastSourceEventTimeFor(canonicalInstrumentId: string) {
      return lastSourceEventTimeByInstrument.get(canonicalInstrumentId) ?? null;
    },
    recordSequence(canonicalInstrumentId: string, sequence: number) {
      lastSequenceByInstrument.set(canonicalInstrumentId, sequence);
    },
    recordSourceEventTime(canonicalInstrumentId: string, sourceEventTime: UtcInstant) {
      lastSourceEventTimeByInstrument.set(canonicalInstrumentId, sourceEventTime);
    },
    snapshot() {
      return Object.freeze({
        observations: Object.freeze([...observations.values()]),
        deduplication: snapshotDeduplicationState(dedup),
        upstreamRefs: Object.freeze([...upstreamRefs]),
        duplicateEventKeys: Object.freeze([...duplicateEventKeys]),
        lastSequenceByInstrument: Object.freeze(Object.fromEntries(lastSequenceByInstrument)),
        lastSourceEventTimeByInstrument: Object.freeze(Object.fromEntries(lastSourceEventTimeByInstrument)),
      });
    },
    restore(snapshot: HeliosObservationStoreSnapshot) {
      observations.clear();
      byInstrument.clear();
      upstreamRefs.clear();
      duplicateEventKeys.clear();
      lastSequenceByInstrument.clear();
      lastSourceEventTimeByInstrument.clear();
      dedup = restoreDeduplicationState(snapshot.deduplication);
      for (const ref of snapshot.upstreamRefs) upstreamRefs.add(ref);
      for (const key of snapshot.duplicateEventKeys) duplicateEventKeys.add(key);
      for (const [instrument, seq] of Object.entries(snapshot.lastSequenceByInstrument)) {
        lastSequenceByInstrument.set(instrument, seq);
      }
      for (const [instrument, time] of Object.entries(snapshot.lastSourceEventTimeByInstrument)) {
        lastSourceEventTimeByInstrument.set(instrument, time);
      }
      for (const envelope of snapshot.observations) {
        put(envelope);
      }
    },
  });
}
