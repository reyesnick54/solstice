import { asUtcInstant } from '../../domain/src/time.ts';
import {
  canTransitionAccessEntitlement,
  canTransitionAccessIntent,
  canTransitionAccessQuote,
  canTransitionAccessRight,
  canTransitionAllocationDecision,
  canTransitionAllocationPolicy,
  canTransitionCapacityOffer,
  canTransitionCapacityReservation,
  canTransitionDeliveryClaim,
  canTransitionExperienceBundle,
  canTransitionPersonalAccessEnvelope,
  canTransitionUsageEvent,
  canTransitionUsageProof,
  isTerminalAccessIntentState,
  isTerminalCapacityReservationState,
} from './lifecycle.ts';
import {
  ACCESS_BASIS_KINDS,
  ACCESS_TIERS,
  type AccessBasisKind,
  type AccessEntitlementState,
  type AccessIntentState,
  type AccessQuoteState,
  type AccessRightState,
  type AccessTier,
  type AllocationDecisionState,
  type AllocationPolicyState,
  type CapacityOfferState,
  type CapacityReservationState,
  type DeliveryClaimState,
  type ExperienceBundleState,
  type PersonalAccessEnvelopeState,
  type UsageEventState,
  type UsageProofState,
} from './taxonomy.ts';
import type {
  AccessBasis,
  AccessBasisTerm,
  AccessEntitlement,
  AccessFailure,
  AccessFailureCode,
  AccessIntent,
  AccessQuote,
  AccessRight,
  AllocationDecision,
  AllocationPolicy,
  CapacityOffer,
  CapacityReservation,
  CapacityWindow,
  DeliveryClaim,
  ExperienceBundle,
  PersonalAccessEnvelope,
  UsageEvent,
  UsageProof,
} from './types.ts';
import { PRIVACY_BOUNDARY, AUTHORITY_BOUNDARY } from './types.ts';

const FORBIDDEN_PII_FIELDS = [
  'legalName',
  'legal_name',
  'fullName',
  'full_name',
  'email',
  'phone',
  'telephone',
  'ssn',
  'socialSecurityNumber',
  'passport',
  'passportNumber',
  'dateOfBirth',
  'date_of_birth',
  'dob',
  'nationalId',
  'national_id',
  'homeAddress',
  'streetAddress',
  'rawAddress',
  'raw_address',
  'ipAddress',
  'biometric',
  'facialImage',
] as const;

const FORBIDDEN_PRICING_FIELDS = [
  'price',
  'amountMinor',
  'amount_minor',
  'unitPrice',
  'unit_price',
  'totalPrice',
  'total_price',
  'fxRate',
  'fx_rate',
  'settlementAmount',
  'settlement_amount',
  'mintAmount',
  'mint_amount',
  'yieldRate',
  'yield_rate',
  'annualPercentageYield',
  'annualPercentageRate',
] as const;

const FORBIDDEN_POLICY_FIELDS = [
  'politicalBenefitPolicy',
  'political_benefit_policy',
  'welfareEligibility',
  'welfare_eligibility',
  'guaranteedBenefit',
  'guaranteed_benefit',
] as const;

export function accessFailure(code: AccessFailureCode, message: string): AccessFailure {
  return Object.freeze({ code, message });
}

export function collectForbiddenFields(value: unknown, path = ''): string[] {
  if (value == null || typeof value !== 'object') {
    return [];
  }
  const violations: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    if ((FORBIDDEN_PII_FIELDS as readonly string[]).includes(key)) {
      violations.push(currentPath);
    }
    if ((FORBIDDEN_PRICING_FIELDS as readonly string[]).includes(key)) {
      violations.push(currentPath);
    }
    if ((FORBIDDEN_POLICY_FIELDS as readonly string[]).includes(key)) {
      violations.push(currentPath);
    }
    violations.push(...collectForbiddenFields(nested, currentPath));
  }
  return violations;
}

export function assertNoForbiddenFields(value: unknown): AccessFailure | null {
  const violations = collectForbiddenFields(value);
  if (violations.length === 0) {
    return null;
  }
  const field = violations[0] ?? 'unknown';
  if ((FORBIDDEN_PII_FIELDS as readonly string[]).includes(field.split('.').pop() ?? '')) {
    return accessFailure('RAW_PERSONAL_DATA_FORBIDDEN', `forbidden personal data field: ${field}`);
  }
  if ((FORBIDDEN_POLICY_FIELDS as readonly string[]).includes(field.split('.').pop() ?? '')) {
    return accessFailure('POLITICAL_BENEFIT_POLICY_FORBIDDEN', `forbidden political benefit field: ${field}`);
  }
  return accessFailure('PRICING_FIELD_FORBIDDEN', `forbidden pricing or settlement field: ${field}`);
}

export function deriveAccessBasisKinds(terms: readonly AccessBasisTerm[]): readonly AccessBasisKind[] {
  const kinds = terms.map((term) => term.kind);
  return Object.freeze([...new Set(kinds)]);
}

export function buildAccessBasis(terms: readonly AccessBasisTerm[]): AccessBasis {
  return Object.freeze({
    terms: Object.freeze([...terms]),
    kinds: deriveAccessBasisKinds(terms),
  });
}

export function validateAccessBasis(basis: AccessBasis): AccessFailure | null {
  if (basis.terms.length === 0) {
    return accessFailure('ACCESS_BASIS_REQUIRED', 'access basis requires at least one term');
  }
  for (const term of basis.terms) {
    if (!(ACCESS_BASIS_KINDS as readonly string[]).includes(term.kind)) {
      return accessFailure('INVALID_ACCESS_BASIS', `unsupported access basis kind: ${term.kind}`);
    }
    if (term.kind === 'TIME' && term.durationSeconds <= 0n) {
      return accessFailure('INVALID_TIME_WINDOW', 'time basis duration must be positive');
    }
    if (term.kind === 'QUANTITY' && term.amount <= 0n) {
      return accessFailure('INVALID_QUANTITY', 'quantity basis amount must be positive');
    }
    if (term.kind === 'CAPACITY' && term.capacityAmount <= 0n) {
      return accessFailure('INVALID_CAPACITY', 'capacity basis amount must be positive');
    }
  }
  const derivedKinds = deriveAccessBasisKinds(basis.terms);
  if (derivedKinds.length !== basis.kinds.length || !derivedKinds.every((kind, index) => kind === basis.kinds[index])) {
    return accessFailure('INVALID_ACCESS_BASIS', 'access basis kinds must match derived kinds from terms');
  }
  return null;
}

export function validateAccessTier(tier: AccessTier): AccessFailure | null {
  if (!(ACCESS_TIERS as readonly string[]).includes(tier)) {
    return accessFailure('INVALID_ACCESS_TIER', `unsupported access tier: ${tier}`);
  }
  return null;
}

export function validateCapacityWindow(window: CapacityWindow): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(window);
  if (forbidden) {
    return forbidden;
  }
  if (Date.parse(window.opensAt) >= Date.parse(window.closesAt)) {
    return accessFailure('INVALID_TIME_WINDOW', 'capacity window must open before it closes');
  }
  if (window.capacityAmount <= 0n) {
    return accessFailure('INVALID_CAPACITY', 'capacity window amount must be positive');
  }
  return null;
}

export function validateAccessRight(record: AccessRight): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  if (!record.economicAssetDescriptorRef) {
    return accessFailure('ECONOMIC_ASSET_REFERENCE_REQUIRED', 'access right requires economic asset descriptor reference');
  }
  if (!record.rightsPolicyRef) {
    return accessFailure('RIGHTS_POLICY_REQUIRED', 'access right requires rights policy reference');
  }
  if (record.purposeRefs.length === 0) {
    return accessFailure('PURPOSE_REQUIRED', 'access right requires at least one purpose reference');
  }
  if (!record.jurisdictionRef) {
    return accessFailure('JURISDICTION_REQUIRED', 'access right requires jurisdiction reference');
  }
  const tierFailure = validateAccessTier(record.accessTier);
  if (tierFailure) {
    return tierFailure;
  }
  return validateAccessBasis(record.accessBasis);
}

export function validateAccessIntent(record: AccessIntent): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  if (!record.economicAssetDescriptorRef) {
    return accessFailure('ECONOMIC_ASSET_REFERENCE_REQUIRED', 'access intent requires economic asset descriptor reference');
  }
  if (!record.jurisdictionRef) {
    return accessFailure('JURISDICTION_REQUIRED', 'access intent requires jurisdiction reference');
  }
  if (record.requestedTier != null) {
    const tierFailure = validateAccessTier(record.requestedTier);
    if (tierFailure) {
      return tierFailure;
    }
  }
  return validateAccessBasis(record.requestedBasis);
}

export function validateCapacityReservation(record: CapacityReservation): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  if (!record.capacityOfferId) {
    return accessFailure('OFFER_REFERENCE_REQUIRED', 'capacity reservation requires capacity offer reference');
  }
  if (!record.capacityWindowId) {
    return accessFailure('WINDOW_REFERENCE_REQUIRED', 'capacity reservation requires capacity window reference');
  }
  if (!record.holderRef) {
    return accessFailure('HOLDER_REQUIRED', 'capacity reservation requires holder reference');
  }
  if (!record.providerRef) {
    return accessFailure('PROVIDER_REQUIRED', 'capacity reservation requires provider reference');
  }
  if (record.reservedAmount <= 0n) {
    return accessFailure('INVALID_CAPACITY', 'reserved amount must be positive');
  }
  return validateAccessBasis(record.reservedBasis);
}

export function validateAccessEntitlement(record: AccessEntitlement): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  if (!record.accessRightId) {
    return accessFailure('ENTITLEMENT_REFERENCE_REQUIRED', 'access entitlement requires access right reference');
  }
  const tierFailure = validateAccessTier(record.accessTier);
  if (tierFailure) {
    return tierFailure;
  }
  return validateAccessBasis(record.accessBasis);
}

export function validateAccessQuote(record: AccessQuote): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  const tierFailure = validateAccessTier(record.accessTier);
  if (tierFailure) {
    return tierFailure;
  }
  return validateAccessBasis(record.quotedBasis);
}

export function validateAllocationPolicy(record: AllocationPolicy): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  if (!record.jurisdictionRef) {
    return accessFailure('JURISDICTION_REQUIRED', 'allocation policy requires jurisdiction reference');
  }
  for (const tier of record.eligibleTiers) {
    const tierFailure = validateAccessTier(tier);
    if (tierFailure) {
      return tierFailure;
    }
  }
  return null;
}

export function validateUsageEvent(record: UsageEvent): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  if (!record.accessEntitlementId) {
    return accessFailure('ENTITLEMENT_REFERENCE_REQUIRED', 'usage event requires access entitlement reference');
  }
  if (record.measuredAmount < 0n) {
    return accessFailure('INVALID_QUANTITY', 'usage amount cannot be negative');
  }
  return null;
}

export function validateDeliveryClaim(record: DeliveryClaim): AccessFailure | null {
  const forbidden = assertNoForbiddenFields(record);
  if (forbidden) {
    return forbidden;
  }
  if (!record.accessEntitlementId) {
    return accessFailure('ENTITLEMENT_REFERENCE_REQUIRED', 'delivery claim requires access entitlement reference');
  }
  if (!record.deliveryDigest) {
    return accessFailure('DELIVERY_PROOF_REQUIRED', 'delivery claim requires delivery digest');
  }
  return null;
}

export function transitionAccessIntent(record: AccessIntent, to: AccessIntentState): AccessFailure | AccessIntent {
  if (isTerminalAccessIntentState(record.state)) {
    return accessFailure('ALREADY_TERMINAL', `access intent ${record.accessIntentId} is terminal in ${record.state}`);
  }
  if (!canTransitionAccessIntent(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal access intent transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function transitionCapacityReservation(
  record: CapacityReservation,
  to: CapacityReservationState,
): AccessFailure | CapacityReservation {
  if (isTerminalCapacityReservationState(record.state)) {
    return accessFailure('ALREADY_TERMINAL', `capacity reservation ${record.capacityReservationId} is terminal in ${record.state}`);
  }
  if (!canTransitionCapacityReservation(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal capacity reservation transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function transitionAccessRight(record: AccessRight, to: AccessRightState): AccessFailure | AccessRight {
  if (!canTransitionAccessRight(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal access right transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function transitionAccessEntitlement(
  record: AccessEntitlement,
  to: AccessEntitlementState,
): AccessFailure | AccessEntitlement {
  if (!canTransitionAccessEntitlement(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal access entitlement transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function transitionPersonalAccessEnvelope(
  record: PersonalAccessEnvelope,
  to: PersonalAccessEnvelopeState,
): AccessFailure | PersonalAccessEnvelope {
  if (!canTransitionPersonalAccessEnvelope(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal personal access envelope transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
    sealedAt: to === 'SEALED' || to === 'ARCHIVED' ? asUtcInstant(new Date().toISOString()) : record.sealedAt,
  });
}

export function transitionCapacityOffer(record: CapacityOffer, to: CapacityOfferState): AccessFailure | CapacityOffer {
  if (!canTransitionCapacityOffer(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal capacity offer transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
    publishedAt: to === 'PUBLISHED' ? asUtcInstant(new Date().toISOString()) : record.publishedAt,
  });
}

export function transitionAccessQuote(record: AccessQuote, to: AccessQuoteState): AccessFailure | AccessQuote {
  if (!canTransitionAccessQuote(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal access quote transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function transitionAllocationPolicy(
  record: AllocationPolicy,
  to: AllocationPolicyState,
): AccessFailure | AllocationPolicy {
  if (!canTransitionAllocationPolicy(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal allocation policy transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function transitionAllocationDecision(
  record: AllocationDecision,
  to: AllocationDecisionState,
): AccessFailure | AllocationDecision {
  if (!canTransitionAllocationDecision(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal allocation decision transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
    decidedAt: to === 'GRANTED' || to === 'DENIED' ? asUtcInstant(new Date().toISOString()) : record.decidedAt,
  });
}

export function transitionExperienceBundle(
  record: ExperienceBundle,
  to: ExperienceBundleState,
): AccessFailure | ExperienceBundle {
  if (!canTransitionExperienceBundle(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal experience bundle transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function transitionUsageEvent(record: UsageEvent, to: UsageEventState): AccessFailure | UsageEvent {
  if (!canTransitionUsageEvent(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal usage event transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
  });
}

export function transitionUsageProof(record: UsageProof, to: UsageProofState): AccessFailure | UsageProof {
  if (!canTransitionUsageProof(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal usage proof transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    verifiedAt: to === 'VERIFIED' ? asUtcInstant(new Date().toISOString()) : record.verifiedAt,
  });
}

export function transitionDeliveryClaim(record: DeliveryClaim, to: DeliveryClaimState): AccessFailure | DeliveryClaim {
  if (!canTransitionDeliveryClaim(record.state, to)) {
    return accessFailure('INVALID_LIFECYCLE', `illegal delivery claim transition ${record.state} -> ${to}`);
  }
  return Object.freeze({
    ...record,
    state: to,
    updatedAt: asUtcInstant(new Date().toISOString()),
  });
}

export function withStandardBoundaries<T extends { privacyBoundary: unknown; authorityBoundary: unknown }>(record: T): T {
  return Object.freeze({
    ...record,
    privacyBoundary: PRIVACY_BOUNDARY,
    authorityBoundary: AUTHORITY_BOUNDARY,
  });
}

export {
  accessFabricDoesNotMint,
  accessFabricDoesNotSettle,
  accessFabricRefusesAuthorityIssuance,
  scanForbiddenAccessPayload,
  validateAccessIntentInput,
  validateAccessRightInput,
} from './registry-invariants.ts';
