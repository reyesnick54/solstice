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

export {
  AccessEntitlementEngine,
  buildPersonalAccessEnvelope,
  transferAllowed,
} from './engine.ts';
