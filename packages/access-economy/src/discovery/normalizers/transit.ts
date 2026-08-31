/**
 * Transit observation → AccessOpportunity normalizer.
 */

import type { DiscoveryTransitRouteObservation } from '../ports.ts';
import type { AccessOpportunity } from '../types.ts';
import { assertDiscoveryOpportunity } from '../invariants.ts';

export function normalizeTransitRouteToOpportunity(
  observation: DiscoveryTransitRouteObservation,
  retrievedAt: string,
): AccessOpportunity {
  const opportunity: AccessOpportunity = Object.freeze({
    opportunityId: `opp_transit_${observation.providerId}_${observation.routeId}`,
    category: 'TRANSPORTATION',
    accessProductId: null,
    providerId: observation.providerId,
    providerItemId: observation.routeId,
    name: observation.routeName,
    description: observation.operator,
    location: null,
    geography: null,
    availableUnits: null,
    unit: 'TRIP',
    availabilityWindow: null,
    referencePrice: null,
    currency: null,
    status: observation.freshness.stale ? 'STALE' : 'AVAILABLE',
    sourceTimestamp: observation.freshness.sourceTimestamp,
    retrievedAt,
    freshness: observation.freshness,
    confidence: observation.freshness.stale ? 0.5 : 0.8,
    provenance: Object.freeze({
      providerId: observation.providerId,
      sourceObservationId: observation.sourceObservationId,
      authorityClass: 'open_data',
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
