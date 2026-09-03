// @ts-nocheck
/**
 * ACCESS Wave 2 Prompt 31 — discovery invariants.
 */

import type { AccessCapacityCandidate, AccessOpportunity } from './types.ts';
import type { CapacityOffer } from '../types.ts';

export function assertDiscoveryOpportunity(opportunity: AccessOpportunity): void {
  if (opportunity.fundedCapacity !== false) {
    throw new Error('AccessOpportunity must not represent funded capacity');
  }
  if (opportunity.bookingSupported !== false) {
    throw new Error('AccessOpportunity must not claim booking support from discovery');
  }
  if (opportunity.discoveryOnly !== true) {
    throw new Error('AccessOpportunity must be marked discoveryOnly');
  }
  if (opportunity.provenance.referenceOnly !== true) {
    throw new Error('AccessOpportunity provenance must remain referenceOnly');
  }
}

export function assertCapacityCandidate(candidate: AccessCapacityCandidate): void {
  if (candidate.fundedCapacity !== false) {
    throw new Error('AccessCapacityCandidate must not represent funded capacity');
  }
  if (candidate.requiresExplicitApproval !== true) {
    throw new Error('AccessCapacityCandidate requires explicit approval before funding');
  }
}

export function assertOpportunityNotCapacity(
  opportunity: AccessOpportunity,
  capacityLike: Pick<CapacityOffer, 'offerId' | 'state'>,
): void {
  if (opportunity.opportunityId === capacityLike.offerId) {
    throw new Error('AccessOpportunity must not alias a CapacityOffer id');
  }
}

export function assertReferencePriceNotBookingPrice(price: { readonly kind: string } | null): void {
  if (price !== null && price.kind !== 'REFERENCE_PRICE') {
    throw new Error('discovery price must be classified as REFERENCE_PRICE');
  }
}

export const DISCOVERY_POSTURE = Object.freeze({
  paymentIntegrationAdded: false as const,
  settlementIntegrationAdded: false as const,
  fundingReservationOccurs: false as const,
  accessAllocationEngineChanged: false as const,
  dualTokenAllocationChanged: false as const,
  simulationOnly: true as const,
});
