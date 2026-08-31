/**
 * GBFS observation → AccessOpportunity normalizer.
 */

import type { DiscoveryGbfsStationObservation } from '../ports.ts';
import type { AccessCapacityCandidate, AccessOpportunity, DiscoveryAvailabilityState } from '../types.ts';
import { assertCapacityCandidate, assertDiscoveryOpportunity } from '../invariants.ts';

function mapAvailability(status: DiscoveryAvailabilityState): DiscoveryAvailabilityState {
  if (status === 'UNKNOWN') return 'UNKNOWN';
  return status;
}

export function normalizeGbfsStationToOpportunity(
  observation: DiscoveryGbfsStationObservation,
  retrievedAt: string,
): AccessOpportunity {
  const opportunity: AccessOpportunity = Object.freeze({
    opportunityId: `opp_gbfs_${observation.systemId}_${observation.stationId}`,
    category: 'TRANSPORTATION',
    accessProductId: null,
    providerId: observation.providerId,
    providerItemId: `${observation.systemId}:${observation.stationId}`,
    name: observation.name,
    description: observation.pricingPlan,
    location: Object.freeze({
      label: observation.name,
      geography: observation.geography,
    }),
    geography: observation.geography,
    availableUnits: observation.vehiclesAvailable !== null ? BigInt(observation.vehiclesAvailable) : null,
    unit: 'RIDE',
    availabilityWindow: null,
    referencePrice: null,
    currency: null,
    status: mapAvailability(observation.availabilityStatus),
    sourceTimestamp: observation.freshness.sourceTimestamp,
    retrievedAt,
    freshness: observation.freshness,
    confidence: observation.availabilityStatus === 'UNKNOWN' ? 0.4 : 0.75,
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

export function normalizeGbfsStationToCapacityCandidate(
  observation: DiscoveryGbfsStationObservation,
  createdAt: string,
  periodStart: string,
  periodEnd: string,
): AccessCapacityCandidate {
  const candidate: AccessCapacityCandidate = Object.freeze({
    candidateId: `cand_gbfs_${observation.systemId}_${observation.stationId}`,
    providerId: observation.providerId,
    providerItemId: `${observation.systemId}:${observation.stationId}`,
    category: 'VEHICLE_HOURS',
    unit: 'VEHICLE_HOUR',
    estimatedAvailableUnits:
      observation.vehiclesAvailable !== null ? BigInt(observation.vehiclesAvailable) : null,
    geography: observation.geography,
    periodStart,
    periodEnd,
    referencePrice: null,
    currency: null,
    availabilityStatus: mapAvailability(observation.availabilityStatus),
    sourceObservationId: observation.sourceObservationId,
    confidence: 0.6,
    createdAt,
    fundedCapacity: false,
    requiresExplicitApproval: true,
  });
  assertCapacityCandidate(candidate);
  return candidate;
}
