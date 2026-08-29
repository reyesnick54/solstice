import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  AccessEntitlementId,
  AccessFingerprint,
  AccessIntentId,
  AccessQuoteId,
  AccessRightId,
  AllocationDecisionId,
  AllocationPolicyId,
  CanonicalUnitRef,
  CapacityOfferId,
  CapacityReservationId,
  CapacityWindowId,
  ConsentRef,
  DeliveryClaimId,
  EconomicAssetDescriptorRef,
  ExperienceBundleId,
  HolderRef,
  JurisdictionRef,
  LocationRef,
  PersonalAccessEnvelopeId,
  ProviderRef,
  PurposeRef,
  RightsPolicyRef,
  SubjectRef,
  TaxonomyVersion,
  UsageEventId,
  UsageProofId,
  UsageRestrictionRef,
} from './ids.ts';
import {
  ACCESS_ECONOMY_SCHEMA_VERSION,
  ACCESS_ECONOMY_TAXONOMY_VERSION,
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
  type LocationPrecision,
  type PersonalAccessEnvelopeState,
  type ServiceClass,
  type UsageEventState,
  type UsageMeterKind,
  type UsageProofState,
} from './taxonomy.ts';

export type AccessRightsConcept =
  | 'ACCESS_RIGHTS'
  | 'RESERVATION_RIGHTS'
  | 'LEASE_RIGHTS'
  | 'DELIVERY_RIGHTS'
  | 'USAGE_RIGHTS'
  | 'JURISDICTION_RESTRICTIONS';

export type AccessFailure = {
  readonly code: AccessFailureCode;
  readonly message: string;
};

export type AccessFailureCode =
  | 'RAW_PERSONAL_DATA_FORBIDDEN'
  | 'ACCESS_BASIS_REQUIRED'
  | 'INVALID_ACCESS_BASIS'
  | 'INVALID_ACCESS_TIER'
  | 'INVALID_LIFECYCLE'
  | 'ALREADY_TERMINAL'
  | 'ECONOMIC_ASSET_REFERENCE_REQUIRED'
  | 'RIGHTS_POLICY_REQUIRED'
  | 'PURPOSE_REQUIRED'
  | 'JURISDICTION_REQUIRED'
  | 'INVALID_QUANTITY'
  | 'INVALID_TIME_WINDOW'
  | 'INVALID_CAPACITY'
  | 'PRICING_FIELD_FORBIDDEN'
  | 'SETTLEMENT_FIELD_FORBIDDEN'
  | 'MINT_FIELD_FORBIDDEN'
  | 'FORBIDDEN_FIELD'
  | 'SUBJECT_MISMATCH'
  | 'HOLDER_REQUIRED'
  | 'PROVIDER_REQUIRED'
  | 'WINDOW_REFERENCE_REQUIRED'
  | 'OFFER_REFERENCE_REQUIRED'
  | 'ENTITLEMENT_REFERENCE_REQUIRED'
  | 'RESERVATION_REFERENCE_REQUIRED'
  | 'USAGE_PROOF_REQUIRED'
  | 'DELIVERY_PROOF_REQUIRED'
  | 'POLITICAL_BENEFIT_POLICY_FORBIDDEN';

export type PrivacyBoundaryFlags = {
  readonly containRawPersonalData: false;
  readonly containRawLocation: false;
  readonly containContactInformation: false;
  readonly containGovernmentIdentifier: false;
  readonly containBiometricReference: false;
};

export type AuthorityBoundaryFlags = {
  readonly authorizesFinancialExecution: false;
  readonly authorizesSettlement: false;
  readonly authorizesMinting: false;
  readonly issuesExecutionAuthority: false;
  readonly authorizesPricing: false;
  readonly authorizesReservationExecution: false;
  readonly productionEnabled: false;
};

export const PRIVACY_BOUNDARY: PrivacyBoundaryFlags = Object.freeze({
  containRawPersonalData: false,
  containRawLocation: false,
  containContactInformation: false,
  containGovernmentIdentifier: false,
  containBiometricReference: false,
});

export const AUTHORITY_BOUNDARY: AuthorityBoundaryFlags = Object.freeze({
  authorizesFinancialExecution: false,
  authorizesSettlement: false,
  authorizesMinting: false,
  issuesExecutionAuthority: false,
  authorizesPricing: false,
  authorizesReservationExecution: false,
  productionEnabled: false,
});

export type TimeBasis = {
  readonly kind: 'TIME';
  readonly durationSeconds: bigint;
  readonly unitRef: CanonicalUnitRef;
};

export type QuantityBasis = {
  readonly kind: 'QUANTITY';
  readonly amount: bigint;
  readonly unitRef: CanonicalUnitRef;
};

export type UsageBasis = {
  readonly kind: 'USAGE';
  readonly meterKind: UsageMeterKind;
  readonly limit: bigint | null;
  readonly unitRef: CanonicalUnitRef | null;
};

export type LocationBasis = {
  readonly kind: 'LOCATION';
  readonly locationRef: LocationRef;
  readonly precision: LocationPrecision;
};

export type CapacityBasis = {
  readonly kind: 'CAPACITY';
  readonly capacityAmount: bigint;
  readonly unitRef: CanonicalUnitRef;
};

export type QualityClassBasis = {
  readonly kind: 'QUALITY_CLASS';
  readonly serviceClass: ServiceClass;
};

export type AvailabilityWindowBasis = {
  readonly kind: 'AVAILABILITY_WINDOW';
  readonly windowRef: CapacityWindowId;
};

export type PurposeBasis = {
  readonly kind: 'PURPOSE';
  readonly purposeRef: PurposeRef;
};

export type JurisdictionBasis = {
  readonly kind: 'JURISDICTION';
  readonly jurisdictionRef: JurisdictionRef;
};

export type RightsRestrictionBasis = {
  readonly kind: 'RIGHTS_RESTRICTION';
  readonly restrictionRef: UsageRestrictionRef;
  readonly rightsConcepts: readonly AccessRightsConcept[];
};

export type AccessBasisTerm =
  | TimeBasis
  | QuantityBasis
  | UsageBasis
  | LocationBasis
  | CapacityBasis
  | QualityClassBasis
  | AvailabilityWindowBasis
  | PurposeBasis
  | JurisdictionBasis
  | RightsRestrictionBasis;

export type AccessBasis = {
  readonly terms: readonly AccessBasisTerm[];
  readonly kinds: readonly AccessBasisKind[];
};

export type CapacityWindow = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly capacityWindowId: CapacityWindowId;
  readonly providerRef: ProviderRef;
  readonly economicAssetDescriptorRef: EconomicAssetDescriptorRef;
  readonly opensAt: UtcInstant;
  readonly closesAt: UtcInstant;
  readonly timezoneReference: string;
  readonly capacityAmount: bigint;
  readonly unitRef: CanonicalUnitRef;
  readonly serviceClass: ServiceClass;
  readonly jurisdictionRef: JurisdictionRef;
  readonly createdAt: UtcInstant;
};

export type AccessRight = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly accessRightId: AccessRightId;
  readonly economicAssetDescriptorRef: EconomicAssetDescriptorRef;
  readonly holderRef: HolderRef;
  readonly providerRef: ProviderRef | null;
  readonly rightsPolicyRef: RightsPolicyRef;
  readonly consentRefs: readonly ConsentRef[];
  readonly purposeRefs: readonly PurposeRef[];
  readonly usageRestrictionRefs: readonly UsageRestrictionRef[];
  readonly rightsConcepts: readonly AccessRightsConcept[];
  readonly accessBasis: AccessBasis;
  readonly accessTier: AccessTier;
  readonly jurisdictionRef: JurisdictionRef;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly state: AccessRightState;
  readonly supersededBy: AccessRightId | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AccessEntitlement = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly accessEntitlementId: AccessEntitlementId;
  readonly accessRightId: AccessRightId;
  readonly subjectRef: SubjectRef;
  readonly holderRef: HolderRef;
  readonly economicAssetDescriptorRef: EconomicAssetDescriptorRef;
  readonly accessBasis: AccessBasis;
  readonly accessTier: AccessTier;
  readonly remainingQuantity: bigint | null;
  readonly remainingDurationSeconds: bigint | null;
  readonly state: AccessEntitlementState;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type PersonalAccessEnvelope = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly personalAccessEnvelopeId: PersonalAccessEnvelopeId;
  readonly subjectRef: SubjectRef;
  readonly entitlementRefs: readonly AccessEntitlementId[];
  readonly accessTierSummary: readonly AccessTier[];
  readonly state: PersonalAccessEnvelopeState;
  readonly sealedAt: UtcInstant | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AccessIntent = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly accessIntentId: AccessIntentId;
  readonly subjectRef: SubjectRef;
  readonly holderRef: HolderRef | null;
  readonly economicAssetDescriptorRef: EconomicAssetDescriptorRef;
  readonly requestedBasis: AccessBasis;
  readonly requestedTier: AccessTier | null;
  readonly purposeRefs: readonly PurposeRef[];
  readonly jurisdictionRef: JurisdictionRef;
  readonly state: AccessIntentState;
  readonly validUntil: UtcInstant | null;
  readonly linkedEntitlementId: AccessEntitlementId | null;
  readonly linkedReservationId: CapacityReservationId | null;
  readonly fingerprint: AccessFingerprint;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type CapacityOffer = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly capacityOfferId: CapacityOfferId;
  readonly providerRef: ProviderRef;
  readonly economicAssetDescriptorRef: EconomicAssetDescriptorRef;
  readonly offeredBasis: AccessBasis;
  readonly capacityWindowRefs: readonly CapacityWindowId[];
  readonly totalCapacity: bigint;
  readonly remainingCapacity: bigint;
  readonly unitRef: CanonicalUnitRef;
  readonly serviceClass: ServiceClass;
  readonly accessTier: AccessTier;
  readonly jurisdictionRef: JurisdictionRef;
  readonly state: CapacityOfferState;
  readonly publishedAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type CapacityReservation = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly capacityReservationId: CapacityReservationId;
  readonly capacityOfferId: CapacityOfferId;
  readonly capacityWindowId: CapacityWindowId;
  readonly accessIntentId: AccessIntentId | null;
  readonly accessEntitlementId: AccessEntitlementId | null;
  readonly subjectRef: SubjectRef;
  readonly holderRef: HolderRef;
  readonly providerRef: ProviderRef;
  readonly reservedBasis: AccessBasis;
  readonly reservedAmount: bigint;
  readonly unitRef: CanonicalUnitRef;
  readonly state: CapacityReservationState;
  readonly holdExpiresAt: UtcInstant | null;
  readonly activeFrom: UtcInstant | null;
  readonly activeUntil: UtcInstant | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AccessQuote = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly accessQuoteId: AccessQuoteId;
  readonly accessIntentId: AccessIntentId;
  readonly capacityOfferId: CapacityOfferId | null;
  readonly quotedBasis: AccessBasis;
  readonly accessTier: AccessTier;
  readonly state: AccessQuoteState;
  readonly validUntil: UtcInstant;
  readonly structuralTermsDigest: string;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AllocationPolicy = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly allocationPolicyId: AllocationPolicyId;
  readonly policyName: string;
  readonly jurisdictionRef: JurisdictionRef;
  readonly eligibleTiers: readonly AccessTier[];
  readonly requiredPurposeRefs: readonly PurposeRef[];
  readonly requiredRightsConcepts: readonly AccessRightsConcept[];
  readonly priorityOrdering: readonly string[];
  readonly state: AllocationPolicyState;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AllocationDecision = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly allocationDecisionId: AllocationDecisionId;
  readonly allocationPolicyId: AllocationPolicyId;
  readonly accessIntentId: AccessIntentId;
  readonly subjectRef: SubjectRef;
  readonly grantedBasis: AccessBasis | null;
  readonly grantedTier: AccessTier | null;
  readonly decisionCodes: readonly string[];
  readonly state: AllocationDecisionState;
  readonly decidedAt: UtcInstant | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ExperienceBundle = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly experienceBundleId: ExperienceBundleId;
  readonly bundleName: string;
  readonly componentAssetRefs: readonly EconomicAssetDescriptorRef[];
  readonly componentBasis: readonly AccessBasis[];
  readonly accessTier: AccessTier;
  readonly jurisdictionRef: JurisdictionRef;
  readonly state: ExperienceBundleState;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type UsageEvent = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly usageEventId: UsageEventId;
  readonly accessEntitlementId: AccessEntitlementId;
  readonly capacityReservationId: CapacityReservationId | null;
  readonly subjectRef: SubjectRef;
  readonly providerRef: ProviderRef;
  readonly economicAssetDescriptorRef: EconomicAssetDescriptorRef;
  readonly measuredAmount: bigint;
  readonly unitRef: CanonicalUnitRef;
  readonly meterKind: UsageMeterKind;
  readonly occurredAt: UtcInstant;
  readonly state: UsageEventState;
  readonly usageProofRefs: readonly UsageProofId[];
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
};

export type UsageProof = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly usageProofId: UsageProofId;
  readonly usageEventId: UsageEventId;
  readonly attestationDigest: string;
  readonly providerRef: ProviderRef;
  readonly state: UsageProofState;
  readonly verifiedAt: UtcInstant | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
};

export type DeliveryClaim = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly taxonomyVersion: TaxonomyVersion;
  readonly deliveryClaimId: DeliveryClaimId;
  readonly usageEventId: UsageEventId | null;
  readonly capacityReservationId: CapacityReservationId | null;
  readonly accessEntitlementId: AccessEntitlementId;
  readonly providerRef: ProviderRef;
  readonly deliveryDigest: string;
  readonly claimedAt: UtcInstant;
  readonly state: DeliveryClaimState;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type AccessEconomyRecord =
  | AccessIntent
  | AccessRight
  | AccessEntitlement
  | PersonalAccessEnvelope
  | CapacityOffer
  | CapacityWindow
  | CapacityReservation
  | AccessQuote
  | AllocationPolicy
  | AllocationDecision
  | ExperienceBundle
  | UsageEvent
  | UsageProof
  | DeliveryClaim;

export const CURRENT_TAXONOMY_VERSION = ACCESS_ECONOMY_TAXONOMY_VERSION;
