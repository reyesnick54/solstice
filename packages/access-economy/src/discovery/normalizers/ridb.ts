/**
 * Recreation.gov RIDB observation → AccessOpportunity normalizer.
 */

import type { DiscoveryRecreationObservation } from '../ports.ts';
import type { AccessOpportunity } from '../types.ts';
import { assertDiscoveryOpportunity } from '../invariants.ts';

export function normalizeRecreationToOpportunity(
  observation: DiscoveryRecreationObservation,
  retrievedAt: string,
): AccessOpportunity {
  const opportunity: AccessOpportunity = Object.freeze({
    opportunityId: `opp_ridb_${observation.facilityId}`,
    category: 'EXPERIENCES',
    accessProductId: null,
    providerId: observation.providerId,
    providerItemId: observation.facilityId,
    name: observation.name,
    description: observation.activityType,
    location: Object.freeze({
      label: observation.name,
      geography: observation.geography,
    }),
    geography: observation.geography,
    availableUnits: null,
    unit: 'EXPERIENCE_SLOT',
    availabilityWindow: null,
    referencePrice: observation.referencePrice,
    currency: observation.referencePrice?.currency ?? null,
    status: observation.availabilityStatus,
    sourceTimestamp: observation.freshness.sourceTimestamp,
    retrievedAt,
    freshness: observation.freshness,
    confidence: observation.referencePrice ? 0.7 : 0.6,
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
