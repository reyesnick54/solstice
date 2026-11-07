/**
 * In-memory procurement observation store for ALT10 intelligence.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ProcurementExternalObservation } from '@solstice/external-data';

export type ProcurementIntelligenceStore = {
  ingest: (observation: ProcurementExternalObservation, sealedAt: UtcInstant) => void;
  list: () => readonly ProcurementExternalObservation[];
};

export function createProcurementIntelligenceStore(): ProcurementIntelligenceStore {
  const rows: ProcurementExternalObservation[] = [];
  const keys = new Set<string>();

  return Object.freeze({
    ingest(observation, _sealedAt) {
      const key = observation.provenance.dedupeKey;
      if (keys.has(key)) {
        return;
      }
      keys.add(key);
      rows.push(observation);
    },
    list() {
      return Object.freeze([...rows]);
    },
  });
}
