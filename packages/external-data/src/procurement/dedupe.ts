/**
 * HELIOS ALT10 — procurement observation deduplication.
 */

import type { ProcurementExternalObservation } from './types.ts';

export function procurementDedupeKey(observation: ProcurementExternalObservation): string {
  return observation.provenance.dedupeKey;
}

export function isDuplicateProcurementObservation(
  existing: readonly ProcurementExternalObservation[],
  candidate: ProcurementExternalObservation,
): boolean {
  const key = procurementDedupeKey(candidate);
  return existing.some((row) => procurementDedupeKey(row) === key);
}
