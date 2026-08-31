/**
 * EV charging observation → AccessOpportunity normalizer.
 */

import type { DiscoveryChargingLocationObservation } from '../ports.ts';
import type { AccessOpportunity, DiscoveryReferencePrice } from '../types.ts';
import { assertDiscoveryOpportunity, assertReferencePriceNotBookingPrice } from '../invariants.ts';

function parseReferencePrice(
  observation: DiscoveryChargingLocationObservation,
): DiscoveryReferencePrice | null {
  if (!observation.pricingReference) return null;
  const match = /([A-Z]{3})\s*(\d+(?:\.\d+)?)/.exec(observation.pricingReference);
  if (!match) {
    return Object.freeze({
      kind: 'REFERENCE_PRICE',
      amountMinorUnits: 0n,
      currency: 'USD',
      sourceTimestamp: observation.freshness.sourceTimestamp,
      providerId: observation.providerId,
      freshness: observation.freshness,
      notes: observation.pricingReference,
    });
  }
  const currency = match[1]!;
  const major = Number(match[2]!);
  const price: DiscoveryReferencePrice = Object.freeze({
    kind: 'REFERENCE_PRICE',
    amountMinorUnits: BigInt(Math.round(major * 100)),
    currency,
    sourceTimestamp: observation.freshness.sourceTimestamp,
    providerId: observation.providerId,
    freshness: observation.freshness,
    notes: 'parsed from provider pricing reference string',
  });
  assertReferencePriceNotBookingPrice(price);
  return price;
}

export function normalizeChargingLocationToOpportunity(
  observation: DiscoveryChargingLocationObservation,
  retrievedAt: string,
): AccessOpportunity {
  const referencePrice = parseReferencePrice(observation);
  const status =
    observation.availabilityStatus === 'UNKNOWN'
      ? 'UNKNOWN'
      : observation.availabilityStatus;
  const opportunity: AccessOpportunity = Object.freeze({
    opportunityId: `opp_charge_${observation.providerId}_${observation.locationId}`,
    category: 'ENERGY',
    accessProductId: null,
    providerId: observation.providerId,
    providerItemId: observation.locationId,
    name: observation.name ?? `Charger ${observation.locationId}`,
    description: observation.operator,
    location: Object.freeze({
      label: observation.name,
      geography: observation.geography,
    }),
    geography: observation.geography,
    availableUnits: null,
    unit: 'KWH',
    availabilityWindow: null,
    referencePrice,
    currency: referencePrice?.currency ?? null,
    status,
    sourceTimestamp: observation.freshness.sourceTimestamp,
    retrievedAt,
    freshness: observation.freshness,
    confidence: status === 'UNKNOWN' ? 0.45 : 0.7,
    provenance: Object.freeze({
      providerId: observation.providerId,
      sourceObservationId: observation.sourceObservationId,
      authorityClass: 'community_data',
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
