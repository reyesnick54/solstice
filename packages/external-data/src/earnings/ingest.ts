/**
 * EARN02 external-data ingest — dedupe and seal observations.
 */

import type { EarningsExternalObservation, IngestEarningsObservationInput, IngestEarningsObservationResult } from './types.ts';
import { dedupeKeyFor, mergeDuplicateObservations } from './dedupe.ts';

export type EarningsObservationStore = {
  readonly put: (observation: EarningsExternalObservation) => void;
  readonly getByDedupeKey: (dedupeKey: string) => EarningsExternalObservation | undefined;
  readonly list: () => readonly EarningsExternalObservation[];
};

export function createEarningsObservationStore(): EarningsObservationStore {
  const byDedupe = new Map<string, EarningsExternalObservation>();
  const all: EarningsExternalObservation[] = [];

  return Object.freeze({
    put(observation) {
      all.push(observation);
      byDedupe.set(observation.provenance.dedupeKey, observation);
    },
    getByDedupeKey(dedupeKey) {
      return byDedupe.get(dedupeKey);
    },
    list() {
      return Object.freeze([...all]);
    },
  });
}

export function ingestEarningsObservation(
  store: EarningsObservationStore,
  input: IngestEarningsObservationInput,
): IngestEarningsObservationResult {
  const key = dedupeKeyFor(input);
  const existing = store.getByDedupeKey(key);
  const observation: EarningsExternalObservation = Object.freeze({
    ...input,
    schema: 'sunrey.external.earnings-observation.v1',
    grantsExecutionAuthority: false,
    provenance: Object.freeze({ ...input.provenance, dedupeKey: key }),
  });

  if (existing) {
    const merged = mergeDuplicateObservations(existing, observation);
    if (merged.observationId === existing.observationId) {
      return Object.freeze({ ok: true, observation: existing, deduplicated: true });
    }
    store.put(merged);
    return Object.freeze({ ok: true, observation: merged, deduplicated: true });
  }

  store.put(observation);
  return Object.freeze({ ok: true, observation, deduplicated: false });
}
