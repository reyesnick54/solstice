/**
 * Access Fabric identifiers.
 *
 * Domain identifiers (right, reservation, usage, delivery) are supplied by the
 * caller so a committed log replays to the same state on any node. Chain-side
 * record identifiers are derived from the commitment key for the same reason:
 * nothing here may depend on a random source or a wall clock.
 */

export type AccessRightId = string & { readonly __brand: 'AccessRightId' };
export type AccessReservationId = string & { readonly __brand: 'AccessReservationId' };
export type AccessUsageId = string & { readonly __brand: 'AccessUsageId' };
export type AccessDeliveryId = string & { readonly __brand: 'AccessDeliveryId' };
export type AccessSettlementEvidenceId = string & { readonly __brand: 'AccessSettlementEvidenceId' };
export type AccessCommitmentRecordId = string & { readonly __brand: 'AccessCommitmentRecordId' };
export type AccessCommitmentKey = string & { readonly __brand: 'AccessCommitmentKey' };

export function asAccessRightId(value: string): AccessRightId {
  return value as AccessRightId;
}

export function asAccessReservationId(value: string): AccessReservationId {
  return value as AccessReservationId;
}

export function asAccessUsageId(value: string): AccessUsageId {
  return value as AccessUsageId;
}

export function asAccessDeliveryId(value: string): AccessDeliveryId {
  return value as AccessDeliveryId;
}

export function asAccessSettlementEvidenceId(value: string): AccessSettlementEvidenceId {
  return value as AccessSettlementEvidenceId;
}

export function accessCommitmentRecordIdFrom(key: AccessCommitmentKey): AccessCommitmentRecordId {
  return `acr_${key.slice(0, 32)}` as AccessCommitmentRecordId;
}
