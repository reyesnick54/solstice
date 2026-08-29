import { brandAs } from '../../domain/src/brand.ts';

export type AccessEntitlementId = string & { readonly __brand: 'AccessEntitlementId' };
export type AccessReservationId = string & { readonly __brand: 'AccessReservationId' };
export type AccessUsageEventId = string & { readonly __brand: 'AccessUsageEventId' };
export type PersonalAccessEnvelopeId = string & { readonly __brand: 'PersonalAccessEnvelopeId' };

export const ACCESS_ENTITLEMENT_ID_PREFIX = 'aent_';
export const ACCESS_RESERVATION_ID_PREFIX = 'ares_';
export const ACCESS_USAGE_EVENT_ID_PREFIX = 'ausg_';
export const PERSONAL_ACCESS_ENVELOPE_ID_PREFIX = 'paev_';

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}${Date.now().toString(36)}_${sequence.toString(36)}`;
}

export function newAccessEntitlementId(): AccessEntitlementId {
  return brandAs<string, 'AccessEntitlementId'>(nextId(ACCESS_ENTITLEMENT_ID_PREFIX));
}

export function newAccessReservationId(): AccessReservationId {
  return brandAs<string, 'AccessReservationId'>(nextId(ACCESS_RESERVATION_ID_PREFIX));
}

export function newAccessUsageEventId(): AccessUsageEventId {
  return brandAs<string, 'AccessUsageEventId'>(nextId(ACCESS_USAGE_EVENT_ID_PREFIX));
}

export function newPersonalAccessEnvelopeId(): PersonalAccessEnvelopeId {
  return brandAs<string, 'PersonalAccessEnvelopeId'>(nextId(PERSONAL_ACCESS_ENVELOPE_ID_PREFIX));
}
