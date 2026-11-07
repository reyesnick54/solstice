/**
 * HELIOS ALT10 external-data ingest — dedupe and seal observations.
 */

import { PROCUREMENT_OBSERVATION_SCHEMA } from './taxonomy.ts';
import { isDuplicateProcurementObservation } from './dedupe.ts';
import type {
  IngestProcurementObservationInput,
  IngestProcurementObservationResult,
  ProcurementExternalObservation,
} from './types.ts';

export function sealProcurementObservation(
  input: IngestProcurementObservationInput,
): ProcurementExternalObservation {
  return Object.freeze({
    ...input,
    schema: PROCUREMENT_OBSERVATION_SCHEMA,
    grantsExecutionAuthority: false as const,
  });
}

export function ingestProcurementObservation(
  store: readonly ProcurementExternalObservation[],
  input: IngestProcurementObservationInput,
): { readonly next: readonly ProcurementExternalObservation[]; readonly result: IngestProcurementObservationResult } {
  const observation = sealProcurementObservation(input);
  if (isDuplicateProcurementObservation(store, observation)) {
    const prior = store.find((row) => row.provenance.dedupeKey === observation.provenance.dedupeKey);
    if (prior) {
      return Object.freeze({
        next: store,
        result: Object.freeze({ ok: true, observation: prior, deduplicated: true }),
      });
    }
  }
  return Object.freeze({
    next: Object.freeze([...store, observation]),
    result: Object.freeze({ ok: true, observation, deduplicated: false }),
  });
}
