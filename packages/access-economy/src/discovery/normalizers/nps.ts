/**
 * National Park Service observation → AccessOpportunity normalizer.
 */

import type { DiscoveryParkObservation } from '../ports.ts';
import type { AccessOpportunity } from '../types.ts';
import { assertDiscoveryOpportunity } from '../invariants.ts';

export function normalizeParkToOpportunity(
  observation: DiscoveryParkObservation,
  retrievedAt: string,
): AccessOpportunity {
  const opportunity: AccessOpportunity = Object.freeze({
    opportunityId: `opp_nps_${observation.parkCode}`,
    category: 'EXPERIENCES',
    accessProductId: null,
    providerId: observation.providerId,
    providerItemId: observation.parkCode,
    name: observation.name,
    description: observation.description,
    location: Object.freeze({
      label: observation.name,
      geography: observation.geography,
    }),
    geography: observation.geography,
    availableUnits: null,
    unit: 'EXPERIENCE_SLOT',
    availabilityWindow: null,
    referencePrice: null,
    currency: null,
    status: observation.availabilityStatus,
    sourceTimestamp: observation.freshness.sourceTimestamp,
    retrievedAt,
    freshness: observation.freshness,
    confidence: observation.alerts.length > 0 ? 0.65 : 0.85,
    provenance: Object.freeze({
      providerId: observation.providerId,
      sourceObservationId: observation.sourceObservationId,
      authorityClass: 'official_public',
      simulationOnly: true,
      referenceOnly: true,
    }),
    discoveryOnly: true,
    fundedCapacity: false,
    bookingSupported: false,
  });
  assertDiscoveryOpportunity(opportunity);
  return opportunity;
}
