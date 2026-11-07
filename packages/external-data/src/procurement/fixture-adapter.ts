/**
 * Simulation fixture adapter for procurement sources (no live network).
 */

import type { UtcInstant } from '@solstice/domain';

import type { FederalProcurementApiPort } from './ports.ts';
import type { ProcurementExternalObservation } from './types.ts';

export function createFixtureFederalProcurementAdapter(
  fixtures: readonly ProcurementExternalObservation[],
): FederalProcurementApiPort {
  return Object.freeze({
    async fetchAwards(input: {
      readonly attributionEntityId?: string;
      readonly asOfKnowableCutoff: UtcInstant;
    }): Promise<readonly ProcurementExternalObservation[]> {
      const cutoff = Date.parse(input.asOfKnowableCutoff);
      return Object.freeze(
        fixtures.filter((row) => {
          if (Date.parse(row.provenance.knowableAt) > cutoff) {
            return false;
          }
          if (input.attributionEntityId && row.attributionEntityId !== input.attributionEntityId) {
            return false;
          }
          return row.artifactKind === 'PROCUREMENT_AWARD';
        }),
      );
    },
  });
}
