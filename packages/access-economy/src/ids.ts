import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type AccessIntentId = Brand<string, 'AccessIntentId'>;
export type AccessRightId = Brand<string, 'AccessRightId'>;
export type AccessEntitlementId = Brand<string, 'AccessEntitlementId'>;
export type PersonalAccessEnvelopeId = Brand<string, 'PersonalAccessEnvelopeId'>;
export type CapacityOfferId = Brand<string, 'CapacityOfferId'>;
export type CapacityWindowId = Brand<string, 'CapacityWindowId'>;
export type CapacityReservationId = Brand<string, 'CapacityReservationId'>;
export type AccessQuoteId = Brand<string, 'AccessQuoteId'>;
export type AllocationPolicyId = Brand<string, 'AllocationPolicyId'>;
export type AllocationDecisionId = Brand<string, 'AllocationDecisionId'>;
export type ExperienceBundleId = Brand<string, 'ExperienceBundleId'>;
export type UsageEventId = Brand<string, 'UsageEventId'>;
export type UsageProofId = Brand<string, 'UsageProofId'>;
export type DeliveryClaimId = Brand<string, 'DeliveryClaimId'>;
export type SubjectRef = Brand<string, 'AccessEconomySubjectRef'>;
export type HolderRef = Brand<string, 'AccessEconomyHolderRef'>;
export type ProviderRef = Brand<string, 'AccessEconomyProviderRef'>;
export type EconomicAssetDescriptorRef = Brand<string, 'EconomicAssetDescriptorRef'>;
export type PurposeRef = Brand<string, 'AccessEconomyPurposeRef'>;
export type ConsentRef = Brand<string, 'AccessEconomyConsentRef'>;
export type RightsPolicyRef = Brand<string, 'AccessEconomyRightsPolicyRef'>;
export type UsageRestrictionRef = Brand<string, 'AccessEconomyUsageRestrictionRef'>;
export type LocationRef = Brand<string, 'AccessEconomyLocationRef'>;
export type JurisdictionRef = Brand<string, 'AccessEconomyJurisdictionRef'>;
export type CanonicalUnitRef = Brand<string, 'CanonicalUnitRef'>;
export type AccessFingerprint = Brand<string, 'AccessFingerprint'>;
export type TaxonomyVersion = Brand<string, 'AccessEconomyTaxonomyVersion'>;

export const ACCESS_ECONOMY_ID_PREFIXES = Object.freeze({
  accessIntent: 'aceai_',
  accessRight: 'acear_',
  accessEntitlement: 'aceae_',
  personalAccessEnvelope: 'acepae_',
  capacityOffer: 'aceco_',
  capacityWindow: 'acecw_',
  capacityReservation: 'acecr_',
  accessQuote: 'aceaq_',
  allocationPolicy: 'aceap_',
  allocationDecision: 'acead_',
  experienceBundle: 'aceeb_',
  usageEvent: 'aceue_',
  usageProof: 'aceup_',
  deliveryClaim: 'acedc_',
  subject: 'acesub_',
  holder: 'acehld_',
  provider: 'aceprv_',
  purpose: 'acepur_',
  consent: 'acecns_',
  rightsPolicy: 'acerp_',
  usageRestriction: 'aceusg_',
  location: 'aceloc_',
  jurisdiction: 'acejur_',
  unit: 'aceunt_',
  fingerprint: 'acefp_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;
const EAR_ASSET_PREFIX = 'ear_';
const PURPOSE_PREFIXES = ['acepur_', 'eapu_', 'pur_'] as const;
const CONSENT_PREFIXES = ['acecns_', 'eacn_', 'cgr_', 'cns_'] as const;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

function asPrefixedHex<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`${label} must be ${prefix} followed by 16-64 lowercase hex characters`);
  }
  return brandAs<string, T>(value);
}

function asOneOfPrefixes<T extends string>(value: string, prefixes: readonly string[], label: string): Brand<string, T> {
  const prefix = prefixes.find((candidate) => value.startsWith(candidate));
  if (!prefix) {
    throw new TypeError(`${label} must start with one of: ${prefixes.join(', ')}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body) && !/^[a-z0-9_]+$/.test(body)) {
    throw new TypeError(`${label} must use a governed reference format after its prefix`);
  }
  return brandAs<string, T>(value);
}

export function sha256Canonical(material: string): string {
  return digest(material);
}

export function asAccessIntentId(value: string): AccessIntentId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.accessIntent, 'AccessIntentId');
}
export function asAccessRightId(value: string): AccessRightId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.accessRight, 'AccessRightId');
}
export function asAccessEntitlementId(value: string): AccessEntitlementId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.accessEntitlement, 'AccessEntitlementId');
}
export function asPersonalAccessEnvelopeId(value: string): PersonalAccessEnvelopeId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.personalAccessEnvelope, 'PersonalAccessEnvelopeId');
}
export function asCapacityOfferId(value: string): CapacityOfferId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.capacityOffer, 'CapacityOfferId');
}
export function asCapacityWindowId(value: string): CapacityWindowId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.capacityWindow, 'CapacityWindowId');
}
export function asCapacityReservationId(value: string): CapacityReservationId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.capacityReservation, 'CapacityReservationId');
}
export function asAccessQuoteId(value: string): AccessQuoteId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.accessQuote, 'AccessQuoteId');
}
export function asAllocationPolicyId(value: string): AllocationPolicyId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.allocationPolicy, 'AllocationPolicyId');
}
export function asAllocationDecisionId(value: string): AllocationDecisionId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.allocationDecision, 'AllocationDecisionId');
}
export function asExperienceBundleId(value: string): ExperienceBundleId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.experienceBundle, 'ExperienceBundleId');
}
export function asUsageEventId(value: string): UsageEventId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.usageEvent, 'UsageEventId');
}
export function asUsageProofId(value: string): UsageProofId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.usageProof, 'UsageProofId');
}
export function asDeliveryClaimId(value: string): DeliveryClaimId {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.deliveryClaim, 'DeliveryClaimId');
}
export function asSubjectRef(value: string): SubjectRef {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.subject, 'SubjectRef');
}
export function asHolderRef(value: string): HolderRef {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.holder, 'HolderRef');
}
export function asProviderRef(value: string): ProviderRef {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.provider, 'ProviderRef');
}
export function asEconomicAssetDescriptorRef(value: string): EconomicAssetDescriptorRef {
  if (!value.startsWith(EAR_ASSET_PREFIX)) {
    throw new TypeError(`EconomicAssetDescriptorRef must start with ${EAR_ASSET_PREFIX}`);
  }
  const body = value.slice(EAR_ASSET_PREFIX.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`EconomicAssetDescriptorRef must be ${EAR_ASSET_PREFIX} followed by 16-64 lowercase hex characters`);
  }
  return brandAs<string, 'EconomicAssetDescriptorRef'>(value);
}
export function asPurposeRef(value: string): PurposeRef {
  return asOneOfPrefixes(value, PURPOSE_PREFIXES, 'PurposeRef');
}
export function asConsentRef(value: string): ConsentRef {
  return asOneOfPrefixes(value, CONSENT_PREFIXES, 'ConsentRef');
}
export function asRightsPolicyRef(value: string): RightsPolicyRef {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.rightsPolicy, 'RightsPolicyRef');
}
export function asUsageRestrictionRef(value: string): UsageRestrictionRef {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.usageRestriction, 'UsageRestrictionRef');
}
export function asLocationRef(value: string): LocationRef {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.location, 'LocationRef');
}
export function asJurisdictionRef(value: string): JurisdictionRef {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.jurisdiction, 'JurisdictionRef');
}
export function asCanonicalUnitRef(value: string): CanonicalUnitRef {
  if (value.length === 0 || /\s/.test(value)) {
    throw new TypeError('CanonicalUnitRef must be a non-empty unit identifier');
  }
  return brandAs<string, 'CanonicalUnitRef'>(value);
}
export function asAccessFingerprint(value: string): AccessFingerprint {
  return asPrefixedHex(value, ACCESS_ECONOMY_ID_PREFIXES.fingerprint, 'AccessFingerprint');
}
export function asTaxonomyVersion(value: string): TaxonomyVersion {
  if (!/^[0-9]+$/.test(value)) {
    throw new TypeError('TaxonomyVersion must be a decimal integer string');
  }
  return brandAs<string, 'AccessEconomyTaxonomyVersion'>(value);
}

export function accessIntentIdFor(material: string): AccessIntentId {
  return asAccessIntentId(`${ACCESS_ECONOMY_ID_PREFIXES.accessIntent}${digest(material).slice(0, 32)}`);
}
export function accessRightIdFor(material: string): AccessRightId {
  return asAccessRightId(`${ACCESS_ECONOMY_ID_PREFIXES.accessRight}${digest(material).slice(0, 32)}`);
}
export function accessEntitlementIdFor(material: string): AccessEntitlementId {
  return asAccessEntitlementId(`${ACCESS_ECONOMY_ID_PREFIXES.accessEntitlement}${digest(material).slice(0, 32)}`);
}
export function personalAccessEnvelopeIdFor(material: string): PersonalAccessEnvelopeId {
  return asPersonalAccessEnvelopeId(`${ACCESS_ECONOMY_ID_PREFIXES.personalAccessEnvelope}${digest(material).slice(0, 32)}`);
}
export function capacityOfferIdFor(material: string): CapacityOfferId {
  return asCapacityOfferId(`${ACCESS_ECONOMY_ID_PREFIXES.capacityOffer}${digest(material).slice(0, 32)}`);
}
export function capacityWindowIdFor(material: string): CapacityWindowId {
  return asCapacityWindowId(`${ACCESS_ECONOMY_ID_PREFIXES.capacityWindow}${digest(material).slice(0, 32)}`);
}
export function capacityReservationIdFor(material: string): CapacityReservationId {
  return asCapacityReservationId(`${ACCESS_ECONOMY_ID_PREFIXES.capacityReservation}${digest(material).slice(0, 32)}`);
}
export function accessQuoteIdFor(material: string): AccessQuoteId {
  return asAccessQuoteId(`${ACCESS_ECONOMY_ID_PREFIXES.accessQuote}${digest(material).slice(0, 32)}`);
}
export function allocationPolicyIdFor(material: string): AllocationPolicyId {
  return asAllocationPolicyId(`${ACCESS_ECONOMY_ID_PREFIXES.allocationPolicy}${digest(material).slice(0, 32)}`);
}
export function allocationDecisionIdFor(material: string): AllocationDecisionId {
  return asAllocationDecisionId(`${ACCESS_ECONOMY_ID_PREFIXES.allocationDecision}${digest(material).slice(0, 32)}`);
}
export function experienceBundleIdFor(material: string): ExperienceBundleId {
  return asExperienceBundleId(`${ACCESS_ECONOMY_ID_PREFIXES.experienceBundle}${digest(material).slice(0, 32)}`);
}
export function usageEventIdFor(material: string): UsageEventId {
  return asUsageEventId(`${ACCESS_ECONOMY_ID_PREFIXES.usageEvent}${digest(material).slice(0, 32)}`);
}
export function usageProofIdFor(material: string): UsageProofId {
  return asUsageProofId(`${ACCESS_ECONOMY_ID_PREFIXES.usageProof}${digest(material).slice(0, 32)}`);
}
export function deliveryClaimIdFor(material: string): DeliveryClaimId {
  return asDeliveryClaimId(`${ACCESS_ECONOMY_ID_PREFIXES.deliveryClaim}${digest(material).slice(0, 32)}`);
}
export function subjectRefFor(material: string): SubjectRef {
  return asSubjectRef(`${ACCESS_ECONOMY_ID_PREFIXES.subject}${digest(material).slice(0, 32)}`);
}
export function holderRefFor(material: string): HolderRef {
  return asHolderRef(`${ACCESS_ECONOMY_ID_PREFIXES.holder}${digest(material).slice(0, 32)}`);
}
export function providerRefFor(material: string): ProviderRef {
  return asProviderRef(`${ACCESS_ECONOMY_ID_PREFIXES.provider}${digest(material).slice(0, 32)}`);
}
export function economicAssetDescriptorRefFor(material: string): EconomicAssetDescriptorRef {
  return asEconomicAssetDescriptorRef(`${EAR_ASSET_PREFIX}${digest(material).slice(0, 32)}`);
}
export function purposeRefFor(material: string): PurposeRef {
  return asPurposeRef(`${ACCESS_ECONOMY_ID_PREFIXES.purpose}${digest(material).slice(0, 32)}`);
}
export function consentRefFor(material: string): ConsentRef {
  return asConsentRef(`${ACCESS_ECONOMY_ID_PREFIXES.consent}${digest(material).slice(0, 32)}`);
}
export function rightsPolicyRefFor(material: string): RightsPolicyRef {
  return asRightsPolicyRef(`${ACCESS_ECONOMY_ID_PREFIXES.rightsPolicy}${digest(material).slice(0, 32)}`);
}
export function usageRestrictionRefFor(material: string): UsageRestrictionRef {
  return asUsageRestrictionRef(`${ACCESS_ECONOMY_ID_PREFIXES.usageRestriction}${digest(material).slice(0, 32)}`);
}
export function locationRefFor(material: string): LocationRef {
  return asLocationRef(`${ACCESS_ECONOMY_ID_PREFIXES.location}${digest(material).slice(0, 32)}`);
}
export function jurisdictionRefFor(material: string): JurisdictionRef {
  return asJurisdictionRef(`${ACCESS_ECONOMY_ID_PREFIXES.jurisdiction}${digest(material).slice(0, 32)}`);
}
export function accessFingerprintFor(material: string): AccessFingerprint {
  return asAccessFingerprint(`${ACCESS_ECONOMY_ID_PREFIXES.fingerprint}${digest(material).slice(0, 32)}`);
export const ACCESS_ID_PREFIXES = Object.freeze({
  accessRight: 'ar_',
  accessIntent: 'ai_',
  capacityRef: 'cap_',
  reservationRef: 'res_',
  deliveryEvidenceRef: 'dev_',
} as const);

export type AccessRightId = string & { readonly __brand: 'AccessRightId' };
export type AccessIntentId = string & { readonly __brand: 'AccessIntentId' };
export type CapacityRef = string & { readonly __brand: 'CapacityRef' };
export type ReservationRef = string & { readonly __brand: 'ReservationRef' };
export type DeliveryEvidenceRef = string & { readonly __brand: 'DeliveryEvidenceRef' };

function branded<T extends string>(prefix: string, value: string): T {
  if (!value.startsWith(prefix)) {
    throw new Error(`Expected id with prefix ${prefix}, received ${value}`);
  }
  return value as T;
}

export function asAccessRightId(value: string): AccessRightId {
  return branded<AccessRightId>(ACCESS_ID_PREFIXES.accessRight, value);
}

export function asAccessIntentId(value: string): AccessIntentId {
  return branded<AccessIntentId>(ACCESS_ID_PREFIXES.accessIntent, value);
}

export function asCapacityRef(value: string): CapacityRef {
  return branded<CapacityRef>(ACCESS_ID_PREFIXES.capacityRef, value);
}

export function asReservationRef(value: string): ReservationRef {
  return branded<ReservationRef>(ACCESS_ID_PREFIXES.reservationRef, value);
}

export function asDeliveryEvidenceRef(value: string): DeliveryEvidenceRef {
  return branded<DeliveryEvidenceRef>(ACCESS_ID_PREFIXES.deliveryEvidenceRef, value);
}

export function accessRightIdFor(seed: string): AccessRightId {
  return asAccessRightId(`${ACCESS_ID_PREFIXES.accessRight}${seed}`);
}

export function accessIntentIdFor(seed: string): AccessIntentId {
  return asAccessIntentId(`${ACCESS_ID_PREFIXES.accessIntent}${seed}`);
}

export function capacityRefFor(seed: string): CapacityRef {
  return asCapacityRef(`${ACCESS_ID_PREFIXES.capacityRef}${seed}`);
}
