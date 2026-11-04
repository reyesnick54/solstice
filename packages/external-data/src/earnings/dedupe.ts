/**
 * Deduplicate provider reports to a single canonical observation per dedupe key.
 */

import type { EarningsExternalObservation, IngestEarningsObservationInput } from './types.ts';

export function dedupeKeyFor(input: Pick<IngestEarningsObservationInput, 'provenance' | 'artifactKind' | 'earningsEventKey'>): string {
  return [input.earningsEventKey, input.artifactKind, input.provenance.dedupeKey].join('::');
}

export function mergeDuplicateObservations(
  existing: EarningsExternalObservation,
  incoming: EarningsExternalObservation,
): EarningsExternalObservation {
  const existingArrival = Date.parse(existing.times.sunreyArrivalTime);
  const incomingArrival = Date.parse(incoming.times.sunreyArrivalTime);
  if (Number.isFinite(existingArrival) && Number.isFinite(incomingArrival) && incomingArrival >= existingArrival) {
    return existing;
  }
  return incoming;
}
