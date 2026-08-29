export {
  asCapacityPoolId,
  asCapacityReservationId,
  asCapacityResourceId,
  asWaitlistEntryId,
  type CapacityPoolId,
  type CapacityReservationId,
  type CapacityResourceId,
  type WaitlistEntryId,
} from './ids.ts';
export {
  availableUnits,
  quotableUnits,
  InMemoryCapacitySource,
  type CapacitySourcePort,
} from './capacity-source.ts';
export { PermissiveSimulationPolicy, type AccessPolicyPort } from './policy.ts';
export {
  InMemorySettlementIntentPort,
  type CapacitySettlementIntent,
  type SettlementIntentPort,
} from './settlement-port.ts';
export {
  canTransitionReservation,
  holdsCapacity,
  isTerminalReservationState,
  softHoldState,
  firmReservationState,
} from './lifecycle.ts';
export {
  EVIDENCE_CAPACITY_REQUESTED,
  EVIDENCE_CAPACITY_HELD,
  EVIDENCE_CAPACITY_CONFIRMED,
  EVIDENCE_CAPACITY_ACTIVATED,
  EVIDENCE_CAPACITY_COMPLETED,
  EVIDENCE_CAPACITY_CANCELLED,
  EVIDENCE_CAPACITY_EXPIRED,
  EVIDENCE_CAPACITY_FAILED,
  EVIDENCE_CAPACITY_DISPUTED,
  EVIDENCE_CAPACITY_WAITLISTED,
  EVIDENCE_CAPACITY_COMPENSATED,
} from './evidence.ts';
export {
  RESERVATION_STATES,
  TERMINAL_RESERVATION_STATES,
  POLICY_STAGES,
  type ReservationState,
  type PolicyStage,
  type CapacityPool,
  type CapacityReservation,
  type CapacityQuote,
  type PolicyCheckContext,
  type PolicyDecision,
} from './types.ts';
export { CapacityStore, freezePool, freezeReservation, type StoreRejection } from './store.ts';
export { WaitlistStore, type WaitlistEntry, type WaitlistHooks } from './waitlist.ts';
export { authorizeCapacityIntent, type CapacityAuthorizePorts } from './authorize.ts';
export {
  CapacityReservationEngine,
  AccessEntitlementEngine,
  buildPersonalAccessEnvelope,
  transferAllowed,
  DEFAULT_HOLD_TTL_MS,
  DEFAULT_CONFIRMATION_TTL_MS,
  type CapacityReservationEnginePorts,
  type CapacityEngineOutcome,
} from './engine.ts';
export {
  ACCESS_ENTITLEMENT_SOURCES,
  ACCESS_FABRIC_INVARIANTS,
  ACCESS_RESTRICTION_KINDS,
  FORBIDDEN_SCORE_FIELDS,
  FORBIDDEN_SENSITIVE_DEPENDENCIES,
  REPLENISHMENT_POLICIES,
  type AccessEntitlementFailureCode,
  type AccessEntitlementSource,
  type AccessRestrictionKind,
  type ReplenishmentPolicyKind,
} from './taxonomy.ts';

export {
  ACCESS_ENTITLEMENT_ID_PREFIX,
  ACCESS_RESERVATION_ID_PREFIX,
  ACCESS_USAGE_EVENT_ID_PREFIX,
  PERSONAL_ACCESS_ENVELOPE_ID_PREFIX,
  newAccessEntitlementId,
  newAccessReservationId,
  newAccessUsageEventId,
  newPersonalAccessEnvelopeId,
  type AccessEntitlementId,
  type AccessReservationId,
  type AccessUsageEventId,
  type PersonalAccessEnvelopeId,
} from './ids.ts';

export type {
  AccessEntitlement,
  AccessEntitlementEngineInput,
  AccessEntitlementEngineResult,
  AccessFabricFailure,
  AccessMandateConstraint,
  AccessPolicyEligibilityDecision,
  AccessReservation,
  AccessRestriction,
  AccessUsageRecord,
  EligibleAccessRequest,
  JurisdictionCapability,
  PersonalAccessEnvelope,
  ReplenishmentPolicy,
} from './types.ts';

export {
  accessFabricIsNotHumanWorthScoring,
  assertAccessEntitlementInvariants,
  scanForbiddenAccessPayload,
} from './invariants.ts';

export {
  mergePolicyDecisions,
  policyDecisionIndex,
  type AccessPolicyEligibilityPort,
} from './policy-port.ts';

export {
  activeReservationsTotal,
  nextReplenishmentAt,
  replenishmentWindow,
  usageInWindow,
} from './replenishment.ts';
