/**
 * Licensed/public feed simulation — fixture observations only (no retail scraping).
 */

import type { ProductDemandIngestPort } from './ports.ts';
import { assertPermittedProductDemandSource } from './source-policy.ts';
import type { Alt06ProductDemandObservation } from './types.ts';

export function createFixtureProductDemandIngestPort(input: {
  readonly providerId: string;
  readonly observations: readonly Alt06ProductDemandObservation[];
}): ProductDemandIngestPort {
  return Object.freeze({
    providerId: input.providerId,
    async fetchObservations() {
      for (const row of input.observations) {
        const verdict = assertPermittedProductDemandSource(row.provenance.provider);
        if (!verdict.permitted) {
          throw new Error(`source_policy_refused:${verdict.reason}`);
        }
      }
      return Object.freeze([...input.observations]);
    },
  });
}
