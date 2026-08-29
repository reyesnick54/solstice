import { asUtcInstant } from '../../domain/src/time.ts';
import {
  accessEntitlementIdFor,
  accessIntentIdFor,
  accessQuoteIdFor,
  accessRightIdFor,
  allocationDecisionIdFor,
  allocationPolicyIdFor,
  asCanonicalUnitRef,
  asTaxonomyVersion,
  capacityOfferIdFor,
  capacityReservationIdFor,
  capacityWindowIdFor,
  consentRefFor,
  deliveryClaimIdFor,
  economicAssetDescriptorRefFor,
  experienceBundleIdFor,
  holderRefFor,
  jurisdictionRefFor,
  locationRefFor,
  personalAccessEnvelopeIdFor,
  providerRefFor,
  purposeRefFor,
  rightsPolicyRefFor,
  subjectRefFor,
  usageEventIdFor,
  usageProofIdFor,
  usageRestrictionRefFor,
  accessFingerprintFor,
} from './ids.ts';
import { buildAccessBasis } from './invariants.ts';
import { AUTHORITY_BOUNDARY, PRIVACY_BOUNDARY } from './types.ts';
import type {
  AccessEntitlement,
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
import { ACCESS_ECONOMY_SCHEMA_VERSION, ACCESS_ECONOMY_TAXONOMY_VERSION } from './taxonomy.ts';

export const FIXTURE_NOW = asUtcInstant('2026-08-29T10:00:00.000Z');
export const FIXTURE_UNTIL = asUtcInstant('2026-09-12T10:00:00.000Z');
export const FIXTURE_SUBJECT = subjectRefFor('fixture-subject');
export const FIXTURE_HOLDER = holderRefFor('fixture-holder');
export const FIXTURE_PROVIDER = providerRefFor('fixture-provider');
export const FIXTURE_JURISDICTION = jurisdictionRefFor('fixture-jurisdiction');
export const FIXTURE_PURPOSE = purposeRefFor('fixture-purpose');
export const FIXTURE_RIGHTS_POLICY = rightsPolicyRefFor('fixture-rights-policy');
export const FIXTURE_CONSENT = consentRefFor('fixture-consent');
export const FIXTURE_USAGE_RESTRICTION = usageRestrictionRefFor('fixture-usage-restriction');
export const TAXONOMY_VERSION = asTaxonomyVersion(ACCESS_ECONOMY_TAXONOMY_VERSION);

const DAY = asCanonicalUnitRef('DAY');
const NIGHT = asCanonicalUnitRef('NIGHT');
const KWH = asCanonicalUnitRef('kWh');
const GPU_HOUR = asCanonicalUnitRef('GPU_HOUR');
const FACILITY_HOUR = asCanonicalUnitRef('facility_hour');
const SEAT = asCanonicalUnitRef('SEAT');
const KILOGRAM = asCanonicalUnitRef('kg');

export const FIXTURE_MUSTANG_ASSET = economicAssetDescriptorRefFor('mustang-vehicle-lease');
export const FIXTURE_HOTEL_ASSET = economicAssetDescriptorRefFor('hotel-room-nights');
export const FIXTURE_AIRLINE_ASSET = economicAssetDescriptorRefFor('airline-seat-capacity');
export const FIXTURE_FOOD_ASSET = economicAssetDescriptorRefFor('weekly-food-allocation');
export const FIXTURE_ENERGY_ASSET = economicAssetDescriptorRefFor('grid-energy-kwh');
export const FIXTURE_GPU_ASSET = economicAssetDescriptorRefFor('gpu-compute-hours');
export const FIXTURE_ROBOT_ASSET = economicAssetDescriptorRefFor('robot-labor-hours');
export const FIXTURE_FACTORY_ASSET = economicAssetDescriptorRefFor('factory-capacity');
export const FIXTURE_CONCERT_ASSET = economicAssetDescriptorRefFor('concert-admission');

export function fixtureMustangAccessBasis() {
  return buildAccessBasis([
    { kind: 'TIME', durationSeconds: 14n * 86_400n, unitRef: DAY },
    { kind: 'QUALITY_CLASS', serviceClass: 'PREMIUM' },
    { kind: 'RIGHTS_RESTRICTION', restrictionRef: FIXTURE_USAGE_RESTRICTION, rightsConcepts: ['LEASE_RIGHTS'] },
    { kind: 'PURPOSE', purposeRef: FIXTURE_PURPOSE },
    { kind: 'JURISDICTION', jurisdictionRef: FIXTURE_JURISDICTION },
  ]);
}

export function fixtureHotelBasis() {
  return buildAccessBasis([
    { kind: 'TIME', durationSeconds: 7n * 86_400n, unitRef: NIGHT },
    { kind: 'LOCATION', locationRef: locationRefFor('hotel-venue'), precision: 'VENUE' },
    { kind: 'QUALITY_CLASS', serviceClass: 'BUSINESS' },
  ]);
}

export function fixtureAirlineBasis() {
  return buildAccessBasis([
    { kind: 'CAPACITY', capacityAmount: 1n, unitRef: SEAT },
    { kind: 'AVAILABILITY_WINDOW', windowRef: capacityWindowIdFor('airline-window') },
    { kind: 'QUALITY_CLASS', serviceClass: 'ECONOMY' },
  ]);
}

export function fixtureFoodBasis() {
  return buildAccessBasis([
    { kind: 'QUANTITY', amount: 1n, unitRef: asCanonicalUnitRef('WEEKLY_ALLOCATION') },
    { kind: 'TIME', durationSeconds: 7n * 86_400n, unitRef: DAY },
    { kind: 'USAGE', meterKind: 'DELIVERY', limit: 1n, unitRef: KILOGRAM },
  ]);
}

export function fixtureEnergyBasis() {
  return buildAccessBasis([
    { kind: 'QUANTITY', amount: 250n, unitRef: KWH },
    { kind: 'TIME', durationSeconds: 30n * 86_400n, unitRef: DAY },
    { kind: 'USAGE', meterKind: 'ENERGY', limit: 250n, unitRef: KWH },
  ]);
}

export function fixtureGpuBasis() {
  return buildAccessBasis([
    { kind: 'QUANTITY', amount: 100n, unitRef: GPU_HOUR },
    { kind: 'CAPACITY', capacityAmount: 100n, unitRef: GPU_HOUR },
    { kind: 'QUALITY_CLASS', serviceClass: 'INDUSTRIAL_BASELINE' },
  ]);
}

export function fixtureRobotBasis() {
  return buildAccessBasis([
    { kind: 'TIME', durationSeconds: 8n * 3_600n, unitRef: asCanonicalUnitRef('HOUR') },
    { kind: 'CAPACITY', capacityAmount: 1n, unitRef: FACILITY_HOUR },
  ]);
}

export function fixtureFactoryBasis() {
  return buildAccessBasis([
    { kind: 'CAPACITY', capacityAmount: 500n, unitRef: FACILITY_HOUR },
    { kind: 'AVAILABILITY_WINDOW', windowRef: capacityWindowIdFor('factory-window') },
    { kind: 'QUALITY_CLASS', serviceClass: 'INDUSTRIAL_BASELINE' },
  ]);
}

export function fixtureConcertBasis() {
  return buildAccessBasis([
    { kind: 'QUANTITY', amount: 1n, unitRef: SEAT },
    { kind: 'LOCATION', locationRef: locationRefFor('concert-venue'), precision: 'VENUE' },
    { kind: 'QUALITY_CLASS', serviceClass: 'GENERAL_ADMISSION' },
    { kind: 'RIGHTS_RESTRICTION', restrictionRef: FIXTURE_USAGE_RESTRICTION, rightsConcepts: ['ACCESS_RIGHTS', 'DELIVERY_RIGHTS'] },
  ]);
}

function baseRecord() {
  return {
    schemaVersion: ACCESS_ECONOMY_SCHEMA_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    privacyBoundary: PRIVACY_BOUNDARY,
    authorityBoundary: AUTHORITY_BOUNDARY,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  } as const;
}

export function fixtureAccessRight(overrides: Partial<AccessRight> = {}): AccessRight {
  return Object.freeze({
    ...baseRecord(),
    accessRightId: accessRightIdFor('fixture-access-right'),
    economicAssetDescriptorRef: FIXTURE_MUSTANG_ASSET,
    holderRef: FIXTURE_HOLDER,
    providerRef: FIXTURE_PROVIDER,
    rightsPolicyRef: FIXTURE_RIGHTS_POLICY,
    consentRefs: [FIXTURE_CONSENT],
    purposeRefs: [FIXTURE_PURPOSE],
    usageRestrictionRefs: [FIXTURE_USAGE_RESTRICTION],
    rightsConcepts: ['LEASE_RIGHTS', 'ACCESS_RIGHTS'] as const,
    accessBasis: fixtureMustangAccessBasis(),
    accessTier: 'SCARCE_PREMIUM',
    jurisdictionRef: FIXTURE_JURISDICTION,
    effectiveFrom: FIXTURE_NOW,
    effectiveUntil: FIXTURE_UNTIL,
    state: 'ACTIVE',
    supersededBy: null,
    ...overrides,
  });
}

export function fixtureAccessIntent(overrides: Partial<AccessIntent> = {}): AccessIntent {
  return Object.freeze({
    ...baseRecord(),
    accessIntentId: accessIntentIdFor('fixture-access-intent'),
    subjectRef: FIXTURE_SUBJECT,
    holderRef: FIXTURE_HOLDER,
    economicAssetDescriptorRef: FIXTURE_MUSTANG_ASSET,
    requestedBasis: fixtureMustangAccessBasis(),
    requestedTier: 'SCARCE_PREMIUM',
    purposeRefs: [FIXTURE_PURPOSE],
    jurisdictionRef: FIXTURE_JURISDICTION,
    state: 'DRAFT',
    validUntil: FIXTURE_UNTIL,
    linkedEntitlementId: null,
    linkedReservationId: null,
    fingerprint: accessFingerprintFor('fixture-access-intent'),
    ...overrides,
  });
}

export function fixtureAccessEntitlement(overrides: Partial<AccessEntitlement> = {}): AccessEntitlement {
  return Object.freeze({
    ...baseRecord(),
    accessEntitlementId: accessEntitlementIdFor('fixture-access-entitlement'),
    accessRightId: accessRightIdFor('fixture-access-right'),
    subjectRef: FIXTURE_SUBJECT,
    holderRef: FIXTURE_HOLDER,
    economicAssetDescriptorRef: FIXTURE_MUSTANG_ASSET,
    accessBasis: fixtureMustangAccessBasis(),
    accessTier: 'SCARCE_PREMIUM',
    remainingQuantity: null,
    remainingDurationSeconds: 14n * 86_400n,
    state: 'ACTIVE',
    effectiveFrom: FIXTURE_NOW,
    effectiveUntil: FIXTURE_UNTIL,
    ...overrides,
  });
}

export function fixturePersonalAccessEnvelope(overrides: Partial<PersonalAccessEnvelope> = {}): PersonalAccessEnvelope {
  return Object.freeze({
    ...baseRecord(),
    personalAccessEnvelopeId: personalAccessEnvelopeIdFor('fixture-envelope'),
    subjectRef: FIXTURE_SUBJECT,
    entitlementRefs: [accessEntitlementIdFor('fixture-access-entitlement')],
    accessTierSummary: ['ESSENTIAL', 'SCARCE_PREMIUM'] as const,
    state: 'OPEN',
    sealedAt: null,
    ...overrides,
  });
}

export function fixtureCapacityWindow(overrides: Partial<CapacityWindow> = {}): CapacityWindow {
  return Object.freeze({
    ...baseRecord(),
    capacityWindowId: capacityWindowIdFor('fixture-capacity-window'),
    providerRef: FIXTURE_PROVIDER,
    economicAssetDescriptorRef: FIXTURE_AIRLINE_ASSET,
    opensAt: FIXTURE_NOW,
    closesAt: FIXTURE_UNTIL,
    timezoneReference: 'UTC',
    capacityAmount: 180n,
    unitRef: SEAT,
    serviceClass: 'ECONOMY',
    jurisdictionRef: FIXTURE_JURISDICTION,
    ...overrides,
  });
}

export function fixtureCapacityOffer(overrides: Partial<CapacityOffer> = {}): CapacityOffer {
  return Object.freeze({
    ...baseRecord(),
    capacityOfferId: capacityOfferIdFor('fixture-capacity-offer'),
    providerRef: FIXTURE_PROVIDER,
    economicAssetDescriptorRef: FIXTURE_AIRLINE_ASSET,
    offeredBasis: fixtureAirlineBasis(),
    capacityWindowRefs: [capacityWindowIdFor('fixture-capacity-window')],
    totalCapacity: 180n,
    remainingCapacity: 180n,
    unitRef: SEAT,
    serviceClass: 'ECONOMY',
    accessTier: 'ABUNDANT_DISCRETIONARY',
    jurisdictionRef: FIXTURE_JURISDICTION,
    state: 'PUBLISHED',
    publishedAt: FIXTURE_NOW,
    expiresAt: FIXTURE_UNTIL,
    ...overrides,
  });
}

export function fixtureCapacityReservation(overrides: Partial<CapacityReservation> = {}): CapacityReservation {
  return Object.freeze({
    ...baseRecord(),
    capacityReservationId: capacityReservationIdFor('fixture-capacity-reservation'),
    capacityOfferId: capacityOfferIdFor('fixture-capacity-offer'),
    capacityWindowId: capacityWindowIdFor('fixture-capacity-window'),
    accessIntentId: accessIntentIdFor('fixture-access-intent'),
    accessEntitlementId: null,
    subjectRef: FIXTURE_SUBJECT,
    holderRef: FIXTURE_HOLDER,
    providerRef: FIXTURE_PROVIDER,
    reservedBasis: fixtureAirlineBasis(),
    reservedAmount: 1n,
    unitRef: SEAT,
    state: 'REQUESTED',
    holdExpiresAt: FIXTURE_UNTIL,
    activeFrom: null,
    activeUntil: null,
    ...overrides,
  });
}

export function fixtureAccessQuote(overrides: Partial<AccessQuote> = {}): AccessQuote {
  return Object.freeze({
    ...baseRecord(),
    accessQuoteId: accessQuoteIdFor('fixture-access-quote'),
    accessIntentId: accessIntentIdFor('fixture-access-intent'),
    capacityOfferId: capacityOfferIdFor('fixture-capacity-offer'),
    quotedBasis: fixtureAirlineBasis(),
    accessTier: 'ABUNDANT_DISCRETIONARY',
    state: 'ISSUED',
    validUntil: FIXTURE_UNTIL,
    structuralTermsDigest: 'sha256:fixture-structural-terms',
    ...overrides,
  });
}

export function fixtureAllocationPolicy(overrides: Partial<AllocationPolicy> = {}): AllocationPolicy {
  return Object.freeze({
    ...baseRecord(),
    allocationPolicyId: allocationPolicyIdFor('fixture-allocation-policy'),
    policyName: 'fixture-allocation-policy',
    jurisdictionRef: FIXTURE_JURISDICTION,
    eligibleTiers: ['ESSENTIAL', 'ABUNDANT_DISCRETIONARY', 'SCARCE_PREMIUM'],
    requiredPurposeRefs: [FIXTURE_PURPOSE],
    requiredRightsConcepts: ['ACCESS_RIGHTS', 'RESERVATION_RIGHTS'],
    priorityOrdering: ['ESSENTIAL', 'ABUNDANT_DISCRETIONARY', 'SCARCE_PREMIUM'],
    state: 'ACTIVE',
    effectiveFrom: FIXTURE_NOW,
    effectiveUntil: null,
    ...overrides,
  }) as AllocationPolicy;
}

export function fixtureAllocationDecision(overrides: Partial<AllocationDecision> = {}): AllocationDecision {
  return Object.freeze({
    ...baseRecord(),
    allocationDecisionId: allocationDecisionIdFor('fixture-allocation-decision'),
    allocationPolicyId: allocationPolicyIdFor('fixture-allocation-policy'),
    accessIntentId: accessIntentIdFor('fixture-access-intent'),
    subjectRef: FIXTURE_SUBJECT,
    grantedBasis: fixtureAirlineBasis(),
    grantedTier: 'ABUNDANT_DISCRETIONARY',
    decisionCodes: ['TIER_ELIGIBLE'],
    state: 'GRANTED',
    decidedAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureExperienceBundle(overrides: Partial<ExperienceBundle> = {}): ExperienceBundle {
  return Object.freeze({
    ...baseRecord(),
    experienceBundleId: experienceBundleIdFor('fixture-experience-bundle'),
    bundleName: 'fixture-travel-bundle',
    componentAssetRefs: [FIXTURE_HOTEL_ASSET, FIXTURE_AIRLINE_ASSET],
    componentBasis: [fixtureHotelBasis(), fixtureAirlineBasis()],
    accessTier: 'ABUNDANT_DISCRETIONARY',
    jurisdictionRef: FIXTURE_JURISDICTION,
    state: 'ACTIVE',
    ...overrides,
  });
}

export function fixtureUsageEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return Object.freeze({
    ...baseRecord(),
    usageEventId: usageEventIdFor('fixture-usage-event'),
    accessEntitlementId: accessEntitlementIdFor('fixture-access-entitlement'),
    capacityReservationId: capacityReservationIdFor('fixture-capacity-reservation'),
    subjectRef: FIXTURE_SUBJECT,
    providerRef: FIXTURE_PROVIDER,
    economicAssetDescriptorRef: FIXTURE_ENERGY_ASSET,
    measuredAmount: 42n,
    unitRef: KWH,
    meterKind: 'ENERGY',
    occurredAt: FIXTURE_NOW,
    state: 'RECORDED',
    usageProofRefs: [],
    ...overrides,
  });
}

export function fixtureUsageProof(overrides: Partial<UsageProof> = {}): UsageProof {
  return Object.freeze({
    ...baseRecord(),
    usageProofId: usageProofIdFor('fixture-usage-proof'),
    usageEventId: usageEventIdFor('fixture-usage-event'),
    attestationDigest: 'sha256:fixture-attestation',
    providerRef: FIXTURE_PROVIDER,
    state: 'PROPOSED',
    verifiedAt: null,
    ...overrides,
  });
}

export function fixtureDeliveryClaim(overrides: Partial<DeliveryClaim> = {}): DeliveryClaim {
  return Object.freeze({
    ...baseRecord(),
    deliveryClaimId: deliveryClaimIdFor('fixture-delivery-claim'),
    usageEventId: usageEventIdFor('fixture-usage-event'),
    capacityReservationId: capacityReservationIdFor('fixture-capacity-reservation'),
    accessEntitlementId: accessEntitlementIdFor('fixture-access-entitlement'),
    providerRef: FIXTURE_PROVIDER,
    deliveryDigest: 'sha256:fixture-delivery',
    claimedAt: FIXTURE_NOW,
    state: 'SUBMITTED',
    ...overrides,
  });
}
