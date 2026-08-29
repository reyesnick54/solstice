export const ACCESS_ID_PREFIXES = Object.freeze({
  accessRight: 'ar_',
  accessIntent: 'ai_',
  capacityRef: 'cap_',
  reservationRef: 'res_',
  deliveryEvidenceRef: 'dev_',
} as const);

export type AccessRightId = string & { readonly __brand: 'AccessRightId' };
export type AccessIntentId = string & { readonly __brand: 'AccessIntentId' };
export type CapacityRef = string & { readonly __brand: 'CapacityRef' };
export type ReservationRef = string & { readonly __brand: 'ReservationRef' };
export type DeliveryEvidenceRef = string & { readonly __brand: 'DeliveryEvidenceRef' };

function branded<T extends string>(prefix: string, value: string): T {
  if (!value.startsWith(prefix)) {
    throw new Error(`Expected id with prefix ${prefix}, received ${value}`);
  }
  return value as T;
}

export function asAccessRightId(value: string): AccessRightId {
  return branded<AccessRightId>(ACCESS_ID_PREFIXES.accessRight, value);
}

export function asAccessIntentId(value: string): AccessIntentId {
  return branded<AccessIntentId>(ACCESS_ID_PREFIXES.accessIntent, value);
}

export function asCapacityRef(value: string): CapacityRef {
  return branded<CapacityRef>(ACCESS_ID_PREFIXES.capacityRef, value);
}

export function asReservationRef(value: string): ReservationRef {
  return branded<ReservationRef>(ACCESS_ID_PREFIXES.reservationRef, value);
}

export function asDeliveryEvidenceRef(value: string): DeliveryEvidenceRef {
  return branded<DeliveryEvidenceRef>(ACCESS_ID_PREFIXES.deliveryEvidenceRef, value);
}

export function accessRightIdFor(seed: string): AccessRightId {
  return asAccessRightId(`${ACCESS_ID_PREFIXES.accessRight}${seed}`);
}

export function accessIntentIdFor(seed: string): AccessIntentId {
  return asAccessIntentId(`${ACCESS_ID_PREFIXES.accessIntent}${seed}`);
}

export function capacityRefFor(seed: string): CapacityRef {
  return asCapacityRef(`${ACCESS_ID_PREFIXES.capacityRef}${seed}`);
}
