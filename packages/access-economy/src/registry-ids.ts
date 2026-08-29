/**
 * ACCESS-01 registry identifiers for the lightweight AccessFabric port.
 *
 * These short-prefix ids are distinct from the rich domain id vocabulary in ids.ts.
 */

export const ACCESS_REGISTRY_ID_PREFIXES = Object.freeze({
  accessRight: 'ar_',
  accessIntent: 'ai_',
  capacityRef: 'cap_',
  reservationRef: 'res_',
  deliveryEvidenceRef: 'dev_',
} as const);

export type AccessRegistryRightId = string & { readonly __brand: 'AccessRegistryRightId' };
export type AccessRegistryIntentId = string & { readonly __brand: 'AccessRegistryIntentId' };
export type CapacityRef = string & { readonly __brand: 'CapacityRef' };
export type ReservationRef = string & { readonly __brand: 'ReservationRef' };
export type DeliveryEvidenceRef = string & { readonly __brand: 'DeliveryEvidenceRef' };

function branded<T extends string>(prefix: string, value: string): T {
  if (!value.startsWith(prefix)) {
    throw new Error(`Expected id with prefix ${prefix}, received ${value}`);
  }
  return value as T;
}

export function asAccessRegistryRightId(value: string): AccessRegistryRightId {
  return branded<AccessRegistryRightId>(ACCESS_REGISTRY_ID_PREFIXES.accessRight, value);
}

export function asAccessRegistryIntentId(value: string): AccessRegistryIntentId {
  return branded<AccessRegistryIntentId>(ACCESS_REGISTRY_ID_PREFIXES.accessIntent, value);
}

export function asCapacityRef(value: string): CapacityRef {
  return branded<CapacityRef>(ACCESS_REGISTRY_ID_PREFIXES.capacityRef, value);
}

export function asReservationRef(value: string): ReservationRef {
  return branded<ReservationRef>(ACCESS_REGISTRY_ID_PREFIXES.reservationRef, value);
}

export function asDeliveryEvidenceRef(value: string): DeliveryEvidenceRef {
  return branded<DeliveryEvidenceRef>(ACCESS_REGISTRY_ID_PREFIXES.deliveryEvidenceRef, value);
}

export function accessRegistryRightIdFor(seed: string): AccessRegistryRightId {
  return asAccessRegistryRightId(`${ACCESS_REGISTRY_ID_PREFIXES.accessRight}${seed}`);
}

export function accessRegistryIntentIdFor(seed: string): AccessRegistryIntentId {
  return asAccessRegistryIntentId(`${ACCESS_REGISTRY_ID_PREFIXES.accessIntent}${seed}`);
}

export function capacityRefFor(seed: string): CapacityRef {
  return asCapacityRef(`${ACCESS_REGISTRY_ID_PREFIXES.capacityRef}${seed}`);
}

/** @deprecated Use accessRegistryRightIdFor for new code. */
export const accessRightIdFor = accessRegistryRightIdFor;
/** @deprecated Use accessRegistryIntentIdFor for new code. */
export const accessIntentIdFor = accessRegistryIntentIdFor;
