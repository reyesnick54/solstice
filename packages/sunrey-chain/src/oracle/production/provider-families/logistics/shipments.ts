/**
 * Pseudonymous shipment, consignment, container, package-group,
 * carrier, vehicle, origin, and destination references.
 */

import { sha256Hex } from '../../../../../../security/src/hash.ts';
import { identityRef } from '../../../../productive/policy-governance/attribution/identity.ts';
import type { LogisticsIdentityBundle, LogisticsSourceObservation } from './types.ts';

export type CanonicalLogisticsRefs = {
  readonly shipment: string | null;
  readonly consignment: string | null;
  readonly container: string | null;
  readonly packageGroup: string | null;
  readonly transportLeg: string | null;
  readonly carrier: string | null;
  readonly vehicle: string | null;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly goodsBatch: string | null;
  readonly manufacturingEvent: string | null;
  readonly deliveryGroup: string | null;
};

function optionalRef(label: string, value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return identityRef(label, value);
}

export function canonicalLogisticsRefs(identity: LogisticsIdentityBundle): CanonicalLogisticsRefs {
  const shipment = optionalRef('shipment', identity.shipmentRef);
  return Object.freeze({
    shipment,
    consignment: optionalRef('consignment', identity.consignmentRef),
    container: optionalRef('container', identity.containerRef),
    packageGroup: optionalRef('package-group', identity.packageGroupRef),
    transportLeg: optionalRef('leg', identity.legRef),
    carrier: optionalRef('carrier', identity.carrierRef),
    vehicle: optionalRef('vehicle', identity.vehicleRef),
    origin: optionalRef('origin-region', identity.originRegionRef),
    destination: optionalRef('destination-region', identity.destinationRegionRef),
    goodsBatch: optionalRef('goods-batch', identity.goodsBatchRef),
    manufacturingEvent: optionalRef('manufacturing-event', identity.manufacturingEventRef),
    deliveryGroup: shipment ? sha256Hex(`delivery-group:${shipment}`) : null,
  });
}

export function deliveryDedupKey(observation: LogisticsSourceObservation): string | null {
  const refs = canonicalLogisticsRefs(observation.identity);
  if (!refs.shipment && !refs.consignment && !refs.container) {
    return null;
  }
  return sha256Hex(
    `delivery:${refs.shipment ?? ''}:${refs.consignment ?? ''}:${refs.container ?? ''}:${refs.packageGroup ?? ''}`,
  );
}

export function shipmentLineageParent(identity: LogisticsIdentityBundle): string | null {
  return identity.manufacturingEventRef ? identityRef('manufacturing-event', identity.manufacturingEventRef) : null;
}
