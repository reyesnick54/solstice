/**
 * Chunk 135 — Real-estate use economic data fabric.
 *
 * Provider-neutral evidence for space capacity and realized occupancy.
 * Extends sunrey-production-oracles. Not a second oracle, mint, or
 * named property-management integration.
 *
 * REAL_ESTATE_USE_CAPACITY is available/installed area.
 * REAL_ESTATE_USAGE is realized area-time. Vacancy, listing, appraisal,
 * and legal ownership are not productive use.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';

export const REAL_ESTATE_FABRIC_SCHEMA_VERSION = 1 as const;
export const REAL_ESTATE_FABRIC_POLICY_VERSION = 'sunrey.real-estate-data-fabric.v1' as const;
export const REAL_ESTATE_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const REAL_ESTATE_PRODUCTION_ACTIVE = false as const;
export const REAL_ESTATE_REAL_PROVIDER_CONTACTED = false as const;
export const REAL_ESTATE_FACT_AUTO_MINTS = false as const;
export const REAL_ESTATE_CERTIFICATION_AUTHORIZES_MOONREY = false as const;
export const PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE = false as const;
export const VACANCY_EQUALS_PRODUCTIVE_USE = false as const;
export const CAPACITY_EQUALS_REALIZED_USE = false as const;
export const LISTING_EQUALS_PRODUCTIVE_USE = false as const;
export const CAPACITY_CANNOT_AUTOMATICALLY_PRODUCE_GPUV = false as const;

export const REAL_ESTATE_SOURCE_CLASSES = [
  'PROPERTY_MANAGEMENT_SYSTEM',
  'SPACE_BOOKING_SYSTEM',
  'BUILDING_MANAGEMENT_SYSTEM',
  'LEASE_ADMINISTRATION_REFERENCE',
  'AGGREGATE_ACCESS_CONTROL',
  'COWORKING_USAGE_SYSTEM',
  'INDUSTRIAL_FACILITY_UTILIZATION',
  'COMMERCIAL_SPACE_METER',
  'WAREHOUSE_SPACE_REFERENCE',
  'INDEPENDENT_OCCUPANCY_ATTESTATION',
] as const;
export type RealEstateSourceClass = (typeof REAL_ESTATE_SOURCE_CLASSES)[number];

export const REAL_ESTATE_FACT_TYPES = ['REAL_ESTATE_USE_CAPACITY', 'REAL_ESTATE_USAGE'] as const;
export type RealEstateFactType = (typeof REAL_ESTATE_FACT_TYPES)[number];

export const REAL_ESTATE_USAGE_STATES = [
  'OCCUPIED',
  'IN_USE',
  'SERVING',
  'VACANT',
  'MAINTENANCE',
  'LISTED',
  'APPRAISED',
  'OWNED_ONLY',
] as const;
export type RealEstateUsageState = (typeof REAL_ESTATE_USAGE_STATES)[number];

export const REALIZED_USAGE_STATES = ['OCCUPIED', 'IN_USE', 'SERVING'] as const;
export type RealizedUsageState = (typeof REALIZED_USAGE_STATES)[number];

export const REAL_ESTATE_PARTY_ROLES = [
  'LEGAL_OWNER',
  'CONTROLLER',
  'PROPERTY_MANAGER',
  'OPERATOR',
  'USE_RIGHT_HOLDER',
  'CUSTODIAN',
] as const;
export type RealEstatePartyRole = (typeof REAL_ESTATE_PARTY_ROLES)[number];

export const REAL_ESTATE_INDEPENDENCE_CLASSES = [
  'SAME_CONTROLLER',
  'SAME_UPSTREAM_ORGANIZATION',
  'INDEPENDENT_ORGANIZATION',
] as const;
export type RealEstateIndependenceClass = (typeof REAL_ESTATE_INDEPENDENCE_CLASSES)[number];

export const REAL_ESTATE_REJECTION_CODES = [
  'CAPACITY_IS_NOT_USAGE',
  'VACANCY_IS_NOT_USAGE',
  'LISTING_IS_NOT_USAGE',
  'APPRAISAL_IS_NOT_USAGE',
  'OWNERSHIP_IS_NOT_USAGE',
  'M2_WITHOUT_DURATION',
  'AREA_TIME_DERIVATION_INEXACT',
  'FLOAT_QUANTITY_FORBIDDEN',
  'FLOAT_DURATION_FORBIDDEN',
  'PERSON_LEVEL_DATA_FORBIDDEN',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'SCHEMA_DRIFT',
  'WRONG_UNIT',
  'WRONG_FACT_TYPE',
  'UNKNOWN_SOURCE_CLASS',
  'UNKNOWN_USAGE_STATE',
  'MISSING_SPACE_REF',
  'MISSING_PROPERTY_REF',
  'MISSING_MEASUREMENT_WINDOW',
  'UTILIZATION_DENOMINATOR_INVENTED',
  'UTILIZATION_DIMENSION_MISMATCH',
  'UTILIZATION_IDENTITY_MISMATCH',
  'UTILIZATION_PERIOD_MISMATCH',
  'STALE_UTILIZATION',
  'ENERGY_INPUT_CLAIMED_AS_OUTPUT',
  'WATER_INPUT_CLAIMED_AS_OUTPUT',
  'DUPLICATE_BUILDING_USAGE',
  'AUTO_MINT_FORBIDDEN',
  'CERTIFICATION_CANNOT_AUTHORIZE_MOONREY',
  'REAL_NETWORK_FORBIDDEN',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
  'CAPACITY_CANNOT_PRODUCE_GPUV',
  'INCOMPATIBLE_UNIT',
] as const;
export type RealEstateRejectionCode = (typeof REAL_ESTATE_REJECTION_CODES)[number];

export type RealEstateRefusal = {
  readonly code: RealEstateRejectionCode;
  readonly detail: string;
};

export type RealEstateParty = {
  readonly partyId: string;
  readonly role: RealEstatePartyRole;
  readonly organizationId: string;
};

export type RealEstateRightsReference = {
  readonly referenceId: string;
  readonly role: RealEstatePartyRole;
  readonly leaseOrUseCommitment: string | null;
  readonly fixtureOnly: boolean;
  readonly provesLegalTitle: false;
};

export type RealEstateIdentity = {
  readonly spaceId: string;
  readonly propertyId: string;
  readonly facilityId: string | null;
};

export type RealEstateIdentityRefs = {
  readonly spaceRef: IdentityRef;
  readonly propertyRef: IdentityRef;
  readonly facilityRef: IdentityRef | null;
  readonly rightsRef: IdentityRef | null;
};

export type RealEstateSourceRecord = {
  readonly identifier: string;
  readonly sourceClass: RealEstateSourceClass;
  readonly factType: FactType;
  readonly numericValue: string;
  readonly unit: string;
  readonly areaMantissa: string;
  readonly areaUnit: 'm2';
  readonly measurementStartUnix: string;
  readonly measurementEndUnix: string;
  readonly usageState: RealEstateUsageState;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly operatorPartyId: string;
  readonly identity: RealEstateIdentity;
  readonly parties: readonly RealEstateParty[];
  readonly rightsReferences: readonly RealEstateRightsReference[];
  readonly sourceTimestampUnix: string;
  readonly extras?: Readonly<Record<string, unknown>>;
};

export type RealEstateFabricPolicy = {
  readonly policyVersion: typeof REAL_ESTATE_FABRIC_POLICY_VERSION;
  readonly requireUseRightReference: boolean;
  readonly maximumObservationAgeSeconds: number;
  readonly productionActive: false;
  readonly realNetworkCalls: false;
  readonly automaticIssuance: false;
};

export type NormalizedRealEstateObservation = {
  readonly schemaVersion: typeof REAL_ESTATE_FABRIC_SCHEMA_VERSION;
  readonly observationId: string;
  readonly sourceClass: RealEstateSourceClass;
  readonly factType: RealEstateFactType;
  readonly sourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly proposedClaimType: ClaimType | null;
  readonly usageState: RealEstateUsageState;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: 'm2' | 'm2_hour' | 'm2_s';
  readonly areaMantissa: bigint;
  readonly durationSeconds: bigint;
  readonly identityRefs: RealEstateIdentityRefs;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly operatorPartyId: string;
  readonly parties: readonly RealEstateParty[];
  readonly rightsReferences: readonly RealEstateRightsReference[];
  readonly independenceClass: RealEstateIndependenceClass;
  readonly createsUsageEvent: boolean;
  readonly createsCapacityReference: boolean;
  readonly canCreateUsageClaim: boolean;
  readonly canMintMoonRey: false;
  readonly canAutomaticallyProduceGpuv: false;
  readonly legalOwnershipInferred: false;
  readonly productionActive: false;
};

export type RealEstateEvidenceRecord = {
  readonly schemaVersion: typeof REAL_ESTATE_FABRIC_SCHEMA_VERSION;
  readonly fabricPolicyVersion: typeof REAL_ESTATE_FABRIC_POLICY_VERSION;
  readonly observation: NormalizedRealEstateObservation;
  readonly eventId: string | null;
  readonly claimType: ClaimType | null;
  readonly automaticIssuance: false;
  readonly verified: false;
  readonly issued: false;
  readonly certificationAuthorizesMoonRey: false;
  readonly realProviderContacted: false;
  readonly productionActive: false;
};

export type UtilizationEvidence = {
  readonly actual: ExactQuantity;
  readonly capacityBasis: ExactQuantity;
  readonly ratioNumerator: bigint;
  readonly ratioDenominator: bigint;
  readonly inventedDenominator: false;
};

export function defaultRealEstateFabricPolicy(): RealEstateFabricPolicy {
  return Object.freeze({
    policyVersion: REAL_ESTATE_FABRIC_POLICY_VERSION,
    requireUseRightReference: true,
    maximumObservationAgeSeconds: 86_400,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}

export function isRealEstateSourceClass(value: string): value is RealEstateSourceClass {
  return (REAL_ESTATE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isRealEstateFactType(value: string): value is RealEstateFactType {
  return (REAL_ESTATE_FACT_TYPES as readonly string[]).includes(value);
}

export function isRealEstateUsageState(value: string): value is RealEstateUsageState {
  return (REAL_ESTATE_USAGE_STATES as readonly string[]).includes(value);
}

export function isRealizedUsageState(value: string): value is RealizedUsageState {
  return (REALIZED_USAGE_STATES as readonly string[]).includes(value);
}

export function realEstateFactCannotAutoMint(): false {
  return REAL_ESTATE_FACT_AUTO_MINTS;
}

export function realEstateProductionIsActive(): false {
  return REAL_ESTATE_PRODUCTION_ACTIVE;
}

export function realEstateRealProviderContacted(): false {
  return REAL_ESTATE_REAL_PROVIDER_CONTACTED;
}

export function certificationCannotAuthorizeMoonRey(): false {
  return REAL_ESTATE_CERTIFICATION_AUTHORIZES_MOONREY;
}

export function propertyOwnershipEqualsProductiveUse(): false {
  return PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE;
}

export function vacancyEqualsProductiveUse(): false {
  return VACANCY_EQUALS_PRODUCTIVE_USE;
}

export function capacityEqualsRealizedUse(): false {
  return CAPACITY_EQUALS_REALIZED_USE;
}

export function capacityCannotAutomaticallyProduceGpuv(): false {
  return CAPACITY_CANNOT_AUTOMATICALLY_PRODUCE_GPUV;
}

export function unitCodeIsArea(unit: string): unit is Extract<UnitCode, 'm2'> {
  return unit === 'm2';
}

export function unitCodeIsAreaTime(unit: string): unit is Extract<UnitCode, 'm2_hour'> {
  return unit === 'm2_hour';
}
