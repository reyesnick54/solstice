/**
 * Ingest external geospatial observations (fixture / licensed ports only).
 */

import type { IngestGeoObservationInput, IngestGeoObservationResult, ExternalGeoObservation } from './types.ts';
import { EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA } from './taxonomy.ts';

const seen = new Set<string>();

export function ingestGeoObservation(input: IngestGeoObservationInput): IngestGeoObservationResult {
  if (input.metricValueMinor < 0n) {
    return Object.freeze({ ok: false, reason: 'negative_metric' });
  }
  const dedupeKey = input.provenance.dedupeKey;
  if (seen.has(dedupeKey)) {
    return Object.freeze({ ok: false, reason: 'duplicate' });
  }
  seen.add(dedupeKey);
  const observation: ExternalGeoObservation = Object.freeze({
    schema: EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA,
    ...input,
    grantsExecutionAuthority: false,
  });
  return Object.freeze({ ok: true, observation, deduplicated: false });
}

export function resetGeoIngestDedupeForTests(): void {
  seen.clear();
}
