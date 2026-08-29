import type {
  AccessEntitlementState,
  AccessIntentState,
  AccessQuoteState,
  AccessRightState,
  AllocationDecisionState,
  AllocationPolicyState,
  CapacityOfferState,
  CapacityReservationState,
  DeliveryClaimState,
  ExperienceBundleState,
  PersonalAccessEnvelopeState,
  UsageEventState,
  UsageProofState,
} from './taxonomy.ts';

export const ACCESS_INTENT_TRANSITIONS: Readonly<Record<AccessIntentState, readonly AccessIntentState[]>> = Object.freeze({
  DRAFT: Object.freeze(['PROPOSED', 'CANCELLED'] as const),
  PROPOSED: Object.freeze(['AUTHORIZED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const),
  AUTHORIZED: Object.freeze(['FULFILLED', 'CANCELLED', 'EXPIRED'] as const),
  FULFILLED: Object.freeze([] as const),
  REJECTED: Object.freeze([] as const),
  CANCELLED: Object.freeze([] as const),
  EXPIRED: Object.freeze([] as const),
});

export const ACCESS_RIGHT_TRANSITIONS: Readonly<Record<AccessRightState, readonly AccessRightState[]>> = Object.freeze({
  PROPOSED: Object.freeze(['ACTIVE', 'REVOKED'] as const),
  ACTIVE: Object.freeze(['SUSPENDED', 'REVOKED', 'EXPIRED', 'SUPERSEDED'] as const),
  SUSPENDED: Object.freeze(['ACTIVE', 'REVOKED', 'EXPIRED'] as const),
  REVOKED: Object.freeze([] as const),
  EXPIRED: Object.freeze([] as const),
  SUPERSEDED: Object.freeze([] as const),
});

export const ACCESS_ENTITLEMENT_TRANSITIONS: Readonly<Record<AccessEntitlementState, readonly AccessEntitlementState[]>> =
  Object.freeze({
    PENDING: Object.freeze(['ACTIVE', 'REVOKED', 'EXPIRED'] as const),
    ACTIVE: Object.freeze(['SUSPENDED', 'EXHAUSTED', 'REVOKED', 'EXPIRED'] as const),
    SUSPENDED: Object.freeze(['ACTIVE', 'REVOKED', 'EXPIRED'] as const),
    EXHAUSTED: Object.freeze([] as const),
    REVOKED: Object.freeze([] as const),
    EXPIRED: Object.freeze([] as const),
  });

export const PERSONAL_ACCESS_ENVELOPE_TRANSITIONS: Readonly<
  Record<PersonalAccessEnvelopeState, readonly PersonalAccessEnvelopeState[]>
> = Object.freeze({
  OPEN: Object.freeze(['SEALED', 'ARCHIVED'] as const),
  SEALED: Object.freeze(['ARCHIVED'] as const),
  ARCHIVED: Object.freeze([] as const),
});

export const CAPACITY_OFFER_TRANSITIONS: Readonly<Record<CapacityOfferState, readonly CapacityOfferState[]>> = Object.freeze({
  DRAFT: Object.freeze(['PUBLISHED', 'WITHDRAWN'] as const),
  PUBLISHED: Object.freeze(['WITHDRAWN', 'EXPIRED'] as const),
  WITHDRAWN: Object.freeze([] as const),
  EXPIRED: Object.freeze([] as const),
});

export const CAPACITY_RESERVATION_TRANSITIONS: Readonly<
  Record<CapacityReservationState, readonly CapacityReservationState[]>
> = Object.freeze({
  REQUESTED: Object.freeze(['HELD', 'FAILED', 'CANCELLED', 'EXPIRED'] as const),
  HELD: Object.freeze(['CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED'] as const),
  CONFIRMED: Object.freeze(['ACTIVE', 'CANCELLED', 'EXPIRED', 'FAILED'] as const),
  ACTIVE: Object.freeze(['COMPLETED', 'DISPUTED', 'FAILED', 'CANCELLED'] as const),
  COMPLETED: Object.freeze([] as const),
  CANCELLED: Object.freeze([] as const),
  EXPIRED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
  DISPUTED: Object.freeze(['COMPLETED', 'FAILED', 'CANCELLED'] as const),
});

export const ACCESS_QUOTE_TRANSITIONS: Readonly<Record<AccessQuoteState, readonly AccessQuoteState[]>> = Object.freeze({
  DRAFT: Object.freeze(['ISSUED'] as const),
  ISSUED: Object.freeze(['ACCEPTED', 'REJECTED', 'EXPIRED'] as const),
  ACCEPTED: Object.freeze([] as const),
  REJECTED: Object.freeze([] as const),
  EXPIRED: Object.freeze([] as const),
});

export const ALLOCATION_POLICY_TRANSITIONS: Readonly<Record<AllocationPolicyState, readonly AllocationPolicyState[]>> =
  Object.freeze({
    DRAFT: Object.freeze(['ACTIVE', 'RETIRED'] as const),
    ACTIVE: Object.freeze(['RETIRED'] as const),
    RETIRED: Object.freeze([] as const),
  });

export const ALLOCATION_DECISION_TRANSITIONS: Readonly<Record<AllocationDecisionState, readonly AllocationDecisionState[]>> =
  Object.freeze({
    PENDING: Object.freeze(['GRANTED', 'DENIED', 'DEFERRED', 'EXPIRED'] as const),
    GRANTED: Object.freeze([] as const),
    DENIED: Object.freeze([] as const),
    DEFERRED: Object.freeze(['GRANTED', 'DENIED', 'EXPIRED'] as const),
    EXPIRED: Object.freeze([] as const),
  });

export const EXPERIENCE_BUNDLE_TRANSITIONS: Readonly<Record<ExperienceBundleState, readonly ExperienceBundleState[]>> =
  Object.freeze({
    DRAFT: Object.freeze(['ACTIVE', 'RETIRED'] as const),
    ACTIVE: Object.freeze(['RETIRED'] as const),
    RETIRED: Object.freeze([] as const),
  });

export const USAGE_EVENT_TRANSITIONS: Readonly<Record<UsageEventState, readonly UsageEventState[]>> = Object.freeze({
  RECORDED: Object.freeze(['ATTESTED', 'VOIDED', 'DISPUTED'] as const),
  ATTESTED: Object.freeze(['DISPUTED', 'VOIDED'] as const),
  DISPUTED: Object.freeze(['ATTESTED', 'VOIDED'] as const),
  VOIDED: Object.freeze([] as const),
});

export const USAGE_PROOF_TRANSITIONS: Readonly<Record<UsageProofState, readonly UsageProofState[]>> = Object.freeze({
  PROPOSED: Object.freeze(['VERIFIED', 'REJECTED', 'EXPIRED'] as const),
  VERIFIED: Object.freeze([] as const),
  REJECTED: Object.freeze([] as const),
  EXPIRED: Object.freeze([] as const),
});

export const DELIVERY_CLAIM_TRANSITIONS: Readonly<Record<DeliveryClaimState, readonly DeliveryClaimState[]>> = Object.freeze({
  SUBMITTED: Object.freeze(['ACKNOWLEDGED', 'REJECTED', 'DISPUTED'] as const),
  ACKNOWLEDGED: Object.freeze(['FULFILLED', 'DISPUTED', 'REJECTED'] as const),
  FULFILLED: Object.freeze([] as const),
  DISPUTED: Object.freeze(['FULFILLED', 'REJECTED'] as const),
  REJECTED: Object.freeze([] as const),
});

export const TERMINAL_ACCESS_INTENT_STATES = ['FULFILLED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const;
export const TERMINAL_CAPACITY_RESERVATION_STATES = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'] as const;

export function canTransitionAccessIntent(from: AccessIntentState, to: AccessIntentState): boolean {
  return ACCESS_INTENT_TRANSITIONS[from].includes(to);
}

export function canTransitionAccessRight(from: AccessRightState, to: AccessRightState): boolean {
  return ACCESS_RIGHT_TRANSITIONS[from].includes(to);
}

export function canTransitionAccessEntitlement(from: AccessEntitlementState, to: AccessEntitlementState): boolean {
  return ACCESS_ENTITLEMENT_TRANSITIONS[from].includes(to);
}

export function canTransitionPersonalAccessEnvelope(
  from: PersonalAccessEnvelopeState,
  to: PersonalAccessEnvelopeState,
): boolean {
  return PERSONAL_ACCESS_ENVELOPE_TRANSITIONS[from].includes(to);
}

export function canTransitionCapacityOffer(from: CapacityOfferState, to: CapacityOfferState): boolean {
  return CAPACITY_OFFER_TRANSITIONS[from].includes(to);
}

export function canTransitionCapacityReservation(from: CapacityReservationState, to: CapacityReservationState): boolean {
  return CAPACITY_RESERVATION_TRANSITIONS[from].includes(to);
}

export function canTransitionAccessQuote(from: AccessQuoteState, to: AccessQuoteState): boolean {
  return ACCESS_QUOTE_TRANSITIONS[from].includes(to);
}

export function canTransitionAllocationPolicy(from: AllocationPolicyState, to: AllocationPolicyState): boolean {
  return ALLOCATION_POLICY_TRANSITIONS[from].includes(to);
}

export function canTransitionAllocationDecision(from: AllocationDecisionState, to: AllocationDecisionState): boolean {
  return ALLOCATION_DECISION_TRANSITIONS[from].includes(to);
}

export function canTransitionExperienceBundle(from: ExperienceBundleState, to: ExperienceBundleState): boolean {
  return EXPERIENCE_BUNDLE_TRANSITIONS[from].includes(to);
}

export function canTransitionUsageEvent(from: UsageEventState, to: UsageEventState): boolean {
  return USAGE_EVENT_TRANSITIONS[from].includes(to);
}

export function canTransitionUsageProof(from: UsageProofState, to: UsageProofState): boolean {
  return USAGE_PROOF_TRANSITIONS[from].includes(to);
}

export function canTransitionDeliveryClaim(from: DeliveryClaimState, to: DeliveryClaimState): boolean {
  return DELIVERY_CLAIM_TRANSITIONS[from].includes(to);
}

export function assertAccessIntentTransition(from: AccessIntentState, to: AccessIntentState): void {
  if (!canTransitionAccessIntent(from, to)) {
    throw new Error(`illegal access intent transition ${from} -> ${to}`);
  }
}

export function assertCapacityReservationTransition(from: CapacityReservationState, to: CapacityReservationState): void {
  if (!canTransitionCapacityReservation(from, to)) {
    throw new Error(`illegal capacity reservation transition ${from} -> ${to}`);
  }
}

export function isTerminalAccessIntentState(state: AccessIntentState): boolean {
  return (TERMINAL_ACCESS_INTENT_STATES as readonly string[]).includes(state);
}

export function isTerminalCapacityReservationState(state: CapacityReservationState): boolean {
  return (TERMINAL_CAPACITY_RESERVATION_STATES as readonly string[]).includes(state);
}
