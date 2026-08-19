/**
 * Chunk 134 — Water economic data fabric.
 *
 * Provider-neutral evidence architecture for water production,
 * treated/desalinated water, and water availability/capacity.
 *
 * Extends sunrey-production-oracles. Not a second oracle owner, mint,
 * irrigation-control path, or live utility integration.
 *
 * WATER_AVAILABILITY is capacity/reserve context. It is not production.
 * Irrigation consumption is an agricultural input, not a water-production claim.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';

export const WATER_FABRIC_SCHEMA_VERSION = 1 as const;
export const WATER_FABRIC_POLICY_VERSION = 'sunrey.water-data-fabric.v1' as const;
export const WATER_FABRIC_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const WATER_PRODUCTION_ACTIVE = false as const;
export const WATER_REAL_PROVIDER_CONTACTED = false as const;
export const WATER_FACT_AUTO_MINTS = false as const;
export const WATER_CERTIFICATION_AUTHORIZES_MOONREY = false as const;
export const WATER_AVAILABILITY_EQUALS_PRODUCTION = false as const;
export const IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION = false as const;
export const QUALITY_CHANGES_PHYSICAL_QUANTITY = false as const;
export const LEGAL_OWNERSHIP_INFERRED = false as const;
export const REFERENCE_PRICE_CREATES_OUTPUT = false as const;

export const WATER_SOURCE_CLASSES = [
  'WATER_UTILITY_PRODUCTION_METER',
  'TREATMENT_PLANT_METER',
  'DESALINATION_PLANT_METER',
  'WELL_PRODUCTION_METER',
  'RESERVOIR_REFERENCE',
  'AQUIFER_REFERENCE',
  'PUMPING_METER',
  'INDUSTRIAL_WATER_PLANT',
  'IRRIGATION_METER',
  'WATER_QUALITY_ATTESTATION',
  'INDEPENDENT_WATER_AUDITOR',
] as const;
export type WaterSourceClass = (typeof WATER_SOURCE_CLASSES)[number];

export const WATER_FACT_TYPES = ['WATER_PRODUCTION', 'WATER_AVAILABILITY'] as const;
export type WaterFactType = (typeof WATER_FACT_TYPES)[number];

export const WATER_MEASUREMENT_SEMANTICS = [
  'RAW_WATER_WITHDRAWAL',
  'TREATED_WATER_PRODUCTION',
  'DESALINATED_WATER_PRODUCTION',
  'RECYCLED_WATER_PRODUCTION',
  'DISTRIBUTED_WATER',
  'IRRIGATION_CONSUMPTION',
  'AVAILABLE_RESERVE',
  'WATER_QUALITY',
] as const;
export type WaterMeasurementSemantics = (typeof WATER_MEASUREMENT_SEMANTICS)[number];

export const WATER_PRODUCTION_SEMANTICS = [
  'RAW_WATER_WITHDRAWAL',
  'TREATED_WATER_PRODUCTION',
  'DESALINATED_WATER_PRODUCTION',
  'RECYCLED_WATER_PRODUCTION',
] as const;
export type WaterProductionSemantics = (typeof WATER_PRODUCTION_SEMANTICS)[number];

export const WATER_METER_SEMANTICS = ['INTERVAL_VOLUME', 'CUMULATIVE_REGISTER'] as const;
export type WaterMeterSemantics = (typeof WATER_METER_SEMANTICS)[number];

export const WATER_PARTY_ROLES = [
  'OPERATOR',
  'CONTROLLER',
  'WATER_RIGHT_HOLDER',
  'RIGHTS_HOLDER',
  'CONCESSION_HOLDER',
  'LICENSE_HOLDER',
  'CUSTODIAN',
  'LEGAL_OWNER',
] as const;
export type WaterPartyRole = (typeof WATER_PARTY_ROLES)[number];

export const WATER_INDEPENDENCE_CLASSES = [
  'SAME_CONTROLLER',
  'SAME_UPSTREAM_ORGANIZATION',
  'SAME_CONTROL_GROUP',
  'INDEPENDENT_ORGANIZATION',
] as const;
export type WaterIndependenceClass = (typeof WATER_INDEPENDENCE_CLASSES)[number];

export const WATER_REJECTION_CODES = [
  'WATER_AVAILABILITY_IS_NOT_PRODUCTION',
  'AVAILABILITY_CANNOT_CREATE_OUTPUT',
  'IRRIGATION_IS_NOT_WATER_PRODUCTION',
  'DISTRIBUTED_WATER_IS_NOT_PRODUCTION',
  'QUALITY_IS_NOT_VOLUME',
  'VOLUME_TIME_IS_STORAGE',
  'SEMANTICS_CANNOT_BE_EQUATED',
  'FLOAT_QUANTITY_FORBIDDEN',
  'NEGATIVE_WATER_PRODUCTION',
  'COUNTER_RESET_UNDOCUMENTED',
  'METER_RESET',
  'COUNTER_ROLLOVER',
  'EQUIPMENT_REPLACEMENT',
  'BACKWARDS_READING',
  'DUPLICATE_READING',
  'TIMESTAMP_REVERSAL',
  'STALE_METER',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
  'MISSING_RIGHTS_REFERENCE',
  'FIXTURE_IS_NOT_AUTHORIZATION',
  'OPERATOR_IS_NOT_LEGAL_OWNER',
  'SCHEMA_DRIFT',
  'CREDENTIAL_LEAK',
  'UNIT_EXTENSION_REQUIRED',
  'INCOMPATIBLE_UNIT',
  'UNKNOWN_SOURCE_CLASS',
  'UNKNOWN_SEMANTICS',
  'WRONG_FACT_TYPE',
  'MEASUREMENT_SEMANTICS_MISMATCH',
  'PROTECTED_LOCATION_REDACTION_REQUIRED',
  'AUTO_MINT_FORBIDDEN',
  'CERTIFICATION_CANNOT_AUTHORIZE_MOONREY',
  'REAL_NETWORK_FORBIDDEN',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
] as const;
export type WaterRejectionCode = (typeof WATER_REJECTION_CODES)[number];

export type WaterRefusal = {
  readonly code: WaterRejectionCode;
  readonly detail: string;
};

export type WaterGeography = {
  readonly schemaVersion: typeof WATER_FABRIC_SCHEMA_VERSION;
  readonly jurisdiction: string;
  readonly watershed: string;
  readonly basin: string;
  readonly utilityServiceArea: string;
  readonly preciseLocationRedacted: boolean;
};

export type WaterParty = {
  readonly partyId: string;
  readonly role: WaterPartyRole;
  readonly organizationId: string;
};

export type WaterRightsReference = {
  readonly referenceId: string;
  readonly role: Exclude<WaterPartyRole, 'OPERATOR' | 'CONTROLLER' | 'CUSTODIAN'>;
  readonly concessionOrLicenseId: string | null;
  readonly waterRightReference: string | null;
  readonly fixtureOnly: boolean;
  readonly provesRealAuthorization: false;
};

export type WaterQualityEvidence = {
  readonly treatmentStandardReference: string | null;
  readonly laboratoryAttestationReference: string | null;
  readonly qualitySamplingReference: string | null;
  readonly purityClassification: string | null;
  readonly fixtureOnly: boolean;
  readonly provesLegalCertification: false;
  readonly changesPhysicalQuantity: false;
  readonly createsOutput: false;
};

export type WaterIdentityRefs = {
  readonly plantSiteRef: IdentityRef;
  readonly meterRef: IdentityRef;
  readonly campaignRef: IdentityRef | null;
  readonly batchRef: IdentityRef | null;
};

export type WaterRegisterSnapshot = {
  readonly meterRef: string;
  readonly registerId: string;
  readonly readingMantissa: bigint;
  readonly unit: string;
  readonly sourceTimestampUnix: bigint;
};

export type WaterSourceRecord = {
  readonly identifier: string;
  readonly sourceClass: WaterSourceClass;
  readonly factType: FactType;
  readonly numericValue: string;
  readonly unit: string;
  readonly measurementSemantics: WaterMeasurementSemantics;
  readonly meterSemantics: WaterMeterSemantics;
  readonly sourceTimestampUnix: string;
  readonly measurementStartUnix: string | null;
  readonly measurementEndUnix: string | null;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly operatorPartyId: string;
  readonly meterRef: string;
  readonly registerId: string;
  readonly geography: WaterGeography;
  readonly identity: {
    readonly plantSiteId: string;
    readonly campaignId: string | null;
    readonly batchId: string | null;
  };
  readonly parties: readonly WaterParty[];
  readonly rightsReferences: readonly WaterRightsReference[];
  readonly qualityEvidence: WaterQualityEvidence | null;
  readonly prior: WaterRegisterSnapshot | null;
  readonly documentedMeterReset: boolean;
  readonly equipmentReplacement: boolean;
  readonly sourceOrganization: string | null;
  readonly extras?: Readonly<Record<string, unknown>>;
};

export type WaterFabricPolicy = {
  readonly policyVersion: typeof WATER_FABRIC_POLICY_VERSION;
  readonly requireExtractionRightsReference: boolean;
  readonly maximumObservationAgeSeconds: number;
  readonly allowPreciseLocations: boolean;
  readonly productionActive: false;
  readonly realNetworkCalls: false;
  readonly automaticIssuance: false;
};

export type WaterQualityInputs = {
  readonly meterCalibrationBps: number;
  readonly measurementFreshnessBps: number;
  readonly batchIdentityPresent: boolean;
  readonly sourceIndependenceBps: number;
  readonly qualityAttestationBps: number;
};

export type NormalizedWaterObservation = {
  readonly schemaVersion: typeof WATER_FABRIC_SCHEMA_VERSION;
  readonly observationId: string;
  readonly sourceClass: WaterSourceClass;
  readonly factType: WaterFactType;
  readonly sourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly proposedClaimType: ClaimType | null;
  readonly measurementSemantics: WaterMeasurementSemantics;
  readonly meterSemantics: WaterMeterSemantics;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: 'L' | 'm3';
  readonly normalizationReceipt: NormalizationReceipt;
  readonly measurementStartUnix: bigint | null;
  readonly measurementEndUnix: bigint | null;
  readonly identityRefs: WaterIdentityRefs;
  readonly geography: WaterGeography;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly operatorPartyId: string;
  readonly parties: readonly WaterParty[];
  readonly rightsReferences: readonly WaterRightsReference[];
  readonly independenceClass: WaterIndependenceClass;
  readonly qualityInputs: WaterQualityInputs;
  readonly qualityEvidence: WaterQualityEvidence | null;
  readonly createsWaterProductionEvent: boolean;
  readonly createsAvailabilityEvidence: boolean;
  readonly isIrrigationInput: boolean;
  readonly isQualityOnly: boolean;
  readonly canCreateOutputClaim: boolean;
  readonly canMintMoonRey: false;
  readonly legalOwnershipInferred: false;
  readonly productionActive: false;
};

export type WaterProductionEvidenceRecord = {
  readonly schemaVersion: typeof WATER_FABRIC_SCHEMA_VERSION;
  readonly fabricPolicyVersion: typeof WATER_FABRIC_POLICY_VERSION;
  readonly observation: NormalizedWaterObservation;
  readonly eventId: string | null;
  readonly claimType: ClaimType | null;
  readonly automaticIssuance: false;
  readonly verified: false;
  readonly issued: false;
  readonly certificationAuthorizesMoonRey: false;
  readonly realProviderContacted: false;
  readonly productionActive: false;
};

export type WaterLineageLink = {
  readonly fromObservationId: string;
  readonly toObservationId: string;
  readonly relation: 'SAME_UNDERLYING_EVENT' | 'INPUT_TO' | 'OUTPUT_OF' | 'LINEAGE_ONLY';
  readonly impliesDuplicateValue: boolean;
};

export function defaultWaterFabricPolicy(): WaterFabricPolicy {
  return Object.freeze({
    policyVersion: WATER_FABRIC_POLICY_VERSION,
    requireExtractionRightsReference: true,
    maximumObservationAgeSeconds: 86_400,
    allowPreciseLocations: false,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}

export function isWaterSourceClass(value: string): value is WaterSourceClass {
  return (WATER_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isWaterFactType(value: string): value is WaterFactType {
  return (WATER_FACT_TYPES as readonly string[]).includes(value);
}

export function isWaterMeasurementSemantics(value: string): value is WaterMeasurementSemantics {
  return (WATER_MEASUREMENT_SEMANTICS as readonly string[]).includes(value);
}

export function isWaterProductionSemantics(value: string): value is WaterProductionSemantics {
  return (WATER_PRODUCTION_SEMANTICS as readonly string[]).includes(value);
}

export function waterFactCannotAutoMint(): false {
  return WATER_FACT_AUTO_MINTS;
}

export function waterProductionIsActive(): false {
  return WATER_PRODUCTION_ACTIVE;
}

export function waterRealProviderContacted(): false {
  return WATER_REAL_PROVIDER_CONTACTED;
}

export function waterAvailabilityEqualsProduction(): false {
  return WATER_AVAILABILITY_EQUALS_PRODUCTION;
}

export function irrigationConsumptionEqualsWaterProduction(): false {
  return IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION;
}

export function unitCodeIsVolume(unit: string): unit is Extract<UnitCode, 'L' | 'm3'> {
  return unit === 'L' || unit === 'm3';
}

export function unitCodeIsVolumeTime(unit: string): boolean {
  return unit === 'L_s' || unit === 'm3_s' || unit === 'm3_hour';
}
