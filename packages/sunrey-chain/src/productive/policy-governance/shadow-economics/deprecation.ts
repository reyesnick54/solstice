/**
 * Legacy V1 remains available. It is not production economics.
 * Deprecation is a future governance action with no automatic date.
 */

import { LEGACY_ENGINEERING_SIMULATION_V1, LEGACY_V1_REMOVED } from './identities.ts';
import type { LegacyV1DeprecationStatus } from './types.ts';

export function legacyV1DeprecationStatus(deprecationRequested = false): LegacyV1DeprecationStatus {
  if (LEGACY_V1_REMOVED) {
    throw new Error('LEGACY_ENGINEERING_SIMULATION_V1 must not be deleted in Chunk 126');
  }
  return Object.freeze({
    pathClass: LEGACY_ENGINEERING_SIMULATION_V1,
    productionEconomics: false,
    deleted: false,
    automaticRemovalDate: null,
    deprecationRequested,
    removalRequiresExplicitGovernance: true,
  });
}

export function requestLegacyV1Deprecation(): LegacyV1DeprecationStatus {
  return legacyV1DeprecationStatus(true);
}
