import type { RightType } from '../protocol/rights.ts';
import type { ChainRecordType } from '../taxonomy.ts';

/**
 * ACCESS-08 vocabulary for Access Fabric commitments on the existing SunRey Chain.
 *
 * Every kind here is an authoritative reference or economic state transition.
 * None of them is a token, a mint, or a second ledger.
 */
export const ACCESS_COMMITMENT_KINDS = [
  'ACCESS_RIGHT_CREATED',
  'ACCESS_RIGHT_REVOKED',
  'RESERVATION_COMMITTED',
  'RESERVATION_CONFIRMED',
  'RESERVATION_EXPIRED',
  'RESERVATION_CANCELLED',
  'USAGE_COMMITTED',
  'DELIVERY_COMMITTED',
  'SETTLEMENT_EVIDENCE_REFERENCE',
] as const;
export type AccessCommitmentKind = (typeof ACCESS_COMMITMENT_KINDS)[number];

/**
 * Non-ownership economic rights. An access right lets a holder use, occupy,
 * lease, or reserve productive capacity. It never conveys title.
 */
export const ACCESS_RIGHT_CLASSES = ['ACCESS', 'USE', 'LEASE', 'RESERVATION'] as const;
export type AccessRightClass = (typeof ACCESS_RIGHT_CLASSES)[number];

/** Title-bearing right classes. This module refuses to represent them. */
export const OWNERSHIP_RIGHT_CLASSES = ['OWN', 'CONTROL', 'TRANSFER'] as const;
export type OwnershipRightClass = (typeof OWNERSHIP_RIGHT_CLASSES)[number];

/**
 * Access classes projected onto the canonical protocol right taxonomy so the
 * Access Fabric does not invent a competing rights model. RESERVATION is a
 * scheduled ACCESS claim, not a distinct protocol right.
 */
export const ACCESS_RIGHT_CLASS_TO_PROTOCOL_RIGHT_TYPE = Object.freeze({
  ACCESS: 'ACCESS',
  USE: 'USE',
  LEASE: 'LEASE',
  RESERVATION: 'ACCESS',
} as const satisfies Record<AccessRightClass, RightType>);

/** Operations that would move title. Never permitted on an access right. */
export const OWNERSHIP_CONVEYING_OPERATIONS = [
  'OWN',
  'TRANSFER_TITLE',
  'CONVEY_OWNERSHIP',
  'SELL_ASSET',
  'ENCUMBER_TITLE',
  'MORTGAGE',
  'PLEDGE_TITLE',
  'MINT',
  'ISSUE',
  'BURN',
] as const;

export const ACCESS_RIGHT_STATES = ['ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type AccessRightState = (typeof ACCESS_RIGHT_STATES)[number];

export const ACCESS_RESERVATION_STATES = [
  'COMMITTED',
  'CONFIRMED',
  'USED',
  'DELIVERED',
  'SETTLED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type AccessReservationState = (typeof ACCESS_RESERVATION_STATES)[number];

export const ACCESS_FINALITY_STATES = ['PENDING', 'FINAL', 'REVIEW_REQUIRED', 'REJECTED', 'UNKNOWN'] as const;
export type AccessFinalityState = (typeof ACCESS_FINALITY_STATES)[number];

export const ACCESS_CHAIN_FAILURE_CODES = [
  'ACCESS_ACTOR_UNKNOWN',
  'ACCESS_ACTOR_REVOKED',
  'ACCESS_ISSUER_UNAUTHORIZED',
  'ACCESS_CAPABILITY_MISSING',
  'ACCESS_HOLDER_SCOPE_REQUIRED',
  'ACCESS_OWNERSHIP_RIGHT_REFUSED',
  'ACCESS_OWNERSHIP_OPERATION_REFUSED',
  'ACCESS_RIGHT_CLASS_INVALID',
  'ACCESS_RIGHT_UNKNOWN',
  'ACCESS_RIGHT_ALREADY_EXISTS',
  'ACCESS_RIGHT_EXPIRED',
  'ACCESS_RIGHT_REVOKED',
  'ACCESS_RIGHT_WINDOW_INVALID',
  'ACCESS_RIGHT_NOT_STARTED',
  'ACCESS_TARGET_UNKNOWN',
  'ACCESS_TARGET_INACTIVE',
  'ACCESS_TARGET_UNIT_MISMATCH',
  'ACCESS_TARGET_QUANTITY_INVALID',
  'ACCESS_RESERVATION_UNKNOWN',
  'ACCESS_RESERVATION_ALREADY_EXISTS',
  'ACCESS_RESERVATION_STATE_INVALID',
  'ACCESS_RESERVATION_NOT_EXPIRED',
  'ACCESS_RESERVATION_CAPACITY_EXCEEDED',
  'ACCESS_USAGE_UNKNOWN',
  'ACCESS_USAGE_ALREADY_EXISTS',
  'ACCESS_DELIVERY_UNKNOWN',
  'ACCESS_DELIVERY_ALREADY_EXISTS',
  'ACCESS_SETTLEMENT_NOT_CANONICAL',
  'ACCESS_SETTLEMENT_ALREADY_REFERENCED',
  'ACCESS_DUPLICATE_COMMITMENT',
  'ACCESS_COMMITMENT_CONFLICT',
  'ACCESS_PRIVACY_VIOLATION',
  'ACCESS_JURISDICTION_REQUIRED',
  'ACCESS_POLICY_REFERENCE_REQUIRED',
  'ACCESS_CONSENT_REFERENCE_REQUIRED',
  'ACCESS_CHAIN_WRITE_DENIED',
  'ACCESS_CHAIN_UNAVAILABLE',
  'ACCESS_SEQUENCE_INVALID',
  'ACCESS_REPLAY_DIVERGED',
] as const;
export type AccessChainFailureCode = (typeof ACCESS_CHAIN_FAILURE_CODES)[number];

/** Domain separation labels. Never reuse a label across kinds. */
export const ACCESS_COMMITMENT_DOMAINS = Object.freeze({
  ACCESS_RIGHT_CREATED: 'access.commit.right.created.v1',
  ACCESS_RIGHT_REVOKED: 'access.commit.right.revoked.v1',
  RESERVATION_COMMITTED: 'access.commit.reservation.committed.v1',
  RESERVATION_CONFIRMED: 'access.commit.reservation.confirmed.v1',
  RESERVATION_EXPIRED: 'access.commit.reservation.expired.v1',
  RESERVATION_CANCELLED: 'access.commit.reservation.cancelled.v1',
  USAGE_COMMITTED: 'access.commit.usage.v1',
  DELIVERY_COMMITTED: 'access.commit.delivery.v1',
  SETTLEMENT_EVIDENCE_REFERENCE: 'access.commit.settlement.v1',
  SCOPE: 'access.commit.scope.v1',
  RESTRICTIONS: 'access.commit.restrictions.v1',
  IDEMPOTENCY: 'access.commit.key.v1',
  STATE: 'access.state.v1',
} as const);

export const ACCESS_COMMITMENT_KIND_TO_CHAIN_RECORD = Object.freeze({
  ACCESS_RIGHT_CREATED: 'EVIDENCE_ANCHOR',
  ACCESS_RIGHT_REVOKED: 'EVIDENCE_ANCHOR',
  RESERVATION_COMMITTED: 'EVIDENCE_ANCHOR',
  RESERVATION_CONFIRMED: 'EVIDENCE_ANCHOR',
  RESERVATION_EXPIRED: 'EVIDENCE_ANCHOR',
  RESERVATION_CANCELLED: 'EVIDENCE_ANCHOR',
  USAGE_COMMITTED: 'EVIDENCE_ANCHOR',
  DELIVERY_COMMITTED: 'ATTESTATION',
  SETTLEMENT_EVIDENCE_REFERENCE: 'DIGITAL_ASSET_SETTLEMENT',
} as const satisfies Record<AccessCommitmentKind, ChainRecordType>);

export function chainRecordTypeForAccessKind(kind: AccessCommitmentKind): ChainRecordType {
  return ACCESS_COMMITMENT_KIND_TO_CHAIN_RECORD[kind];
}

/**
 * Actor capability references. These are identity-registry capabilities on an
 * ActorDescriptor, not Execution Authority. The chain never issues authority.
 */
export const ACCESS_CAPABILITY_REFS = Object.freeze({
  ISSUE_RIGHT: 'sunrey.access.right.issue',
  REVOKE_RIGHT: 'sunrey.access.right.revoke',
  COMMIT_RESERVATION: 'sunrey.access.reservation.commit',
  CONFIRM_RESERVATION: 'sunrey.access.reservation.confirm',
  COMMIT_USAGE: 'sunrey.access.usage.commit',
  ATTEST_DELIVERY: 'sunrey.access.delivery.attest',
  REFERENCE_SETTLEMENT: 'sunrey.access.settlement.reference',
} as const);

export const ACCESS_CAPABILITY_FOR_KIND = Object.freeze({
  ACCESS_RIGHT_CREATED: ACCESS_CAPABILITY_REFS.ISSUE_RIGHT,
  ACCESS_RIGHT_REVOKED: ACCESS_CAPABILITY_REFS.REVOKE_RIGHT,
  RESERVATION_COMMITTED: ACCESS_CAPABILITY_REFS.COMMIT_RESERVATION,
  RESERVATION_CONFIRMED: ACCESS_CAPABILITY_REFS.CONFIRM_RESERVATION,
  RESERVATION_EXPIRED: ACCESS_CAPABILITY_REFS.CONFIRM_RESERVATION,
  RESERVATION_CANCELLED: ACCESS_CAPABILITY_REFS.COMMIT_RESERVATION,
  USAGE_COMMITTED: ACCESS_CAPABILITY_REFS.COMMIT_USAGE,
  DELIVERY_COMMITTED: ACCESS_CAPABILITY_REFS.ATTEST_DELIVERY,
  SETTLEMENT_EVIDENCE_REFERENCE: ACCESS_CAPABILITY_REFS.REFERENCE_SETTLEMENT,
} as const satisfies Record<AccessCommitmentKind, string>);

/**
 * Access-domain privacy boundary. These never reach a chain payload, on top of
 * the chain-wide FORBIDDEN_PAYLOAD_KEYS enforced by classifyWrite.
 */
export const ACCESS_FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'itinerary',
  'itineraryDetails',
  'itineraryContents',
  'tripDetails',
  'travelHistory',
  'tripHistory',
  'journeyHistory',
  'boardingPass',
  'ticketNumber',
  'bookingReference',
  'passengerName',
  'passengerManifest',
  'seatNumber',
  'roomNumber',
  'unitNumber',
  'originAddress',
  'destinationAddress',
  'pickupAddress',
  'dropoffAddress',
  'streetAddress',
  'homeAddress',
  'latitude',
  'longitude',
  'gpsCoordinates',
  'preciseLocation',
  'locationTrace',
  'healthRecord',
  'healthData',
  'medicalCondition',
  'medicalNotes',
  'disabilityDetails',
  'accessibilityNeeds',
  'dietaryRequirements',
  'preferences',
  'personalPreferences',
  'preferenceProfile',
  'travelPreferences',
  'companionNames',
  'paymentCredential',
  'paymentCredentials',
  'cardNumber',
  'cardToken',
  'walletCredential',
  'contactEmail',
  'contactPhone',
  'email',
  'phone',
  'humanWorthScore',
  'accessWorthScore',
  'socialCreditScore',
] as const);

/**
 * Caller-supplied labels, codes, and references must be short controlled
 * tokens: no whitespace, no prose, bounded length. This is the structural half
 * of the privacy boundary. A free-text itinerary, address, name, or preference
 * sentence cannot be shaped like this, so it cannot be committed even as a
 * hash — and a commitment over personal prose is still personal data.
 */
export const ACCESS_LABEL_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:\-/]{0,95}$/;

/** Value-shaped leaks that a key-name check would miss. */
export const ACCESS_FORBIDDEN_VALUE_PATTERNS: readonly RegExp[] = Object.freeze([
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\+\d[\d\s().-]{7,}\d/,
  /\b\d{13,19}\b/,
  /\b-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/,
]);
