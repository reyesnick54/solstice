import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type AccessEntitlementId = Brand<string, 'AccessEntitlementId'>;
export type AccessReservationId = Brand<string, 'AccessReservationId'>;
export type AccessUsageEventId = Brand<string, 'AccessUsageEventId'>;
export type PersonalAccessEnvelopeId = Brand<string, 'PersonalAccessEnvelopeId'>;

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
