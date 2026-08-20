/**
 * Chunk 134 — Agriculture and food economic data fabric.
 *
 * Provider-neutral evidence architecture for farm management, harvest
 * output, agricultural commodities, and realized food measurement.
 *
 * Extends sunrey-production-oracles. Not a second oracle owner, mint,
 * farm-control path, or live provider integration.
 *
 * A planted crop is not production. A forecast yield is not production.
 * Inventory movement is not new harvest. Quality does not change mass.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';

export const AGRICULTURE_FABRIC_SCHEMA_VERSION = 1 as const;
export const AGRICULTURE_FABRIC_POLICY_VERSION = 'sunrey.agriculture-food-data-fabric.v1' as const;
export const AGRICULTURE_FABRIC_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const AGRICULTURE_PRODUCTION_ACTIVE = false as const;
export const AGRICULTURE_REAL_PROVIDER_CONTACTED = false as const;
export const AGRICULTURE_FACT_AUTO_MINTS = false as const;
export const AGRICULTURE_CERTIFICATION_AUTHORIZES_MOONREY = false as const;
export const PLANTED_AREA_EQUALS_OUTPUT = false as const;
export const FORECAST_YIELD_EQUALS_OUTPUT = false as const;
export const INVENTORY_MOVEMENT_EQUALS_PRODUCTION = false as const;
export const WEATHER_EQUALS_PRODUCTION = false as const;
export const QUALITY_CHANGES_PHYSICAL_QUANTITY = false as const;
export const LEGAL_OWNERSHIP_INFERRED = false as const;
export const REFERENCE_PRICE_CREATES_OUTPUT = false as const;

export const AGRICULTURE_SOURCE_CLASSES = [
  'FARM_MANAGEMENT_SYSTEM',
  'HARVEST_METER',
  'GRAIN_SCALE',
  'PACKHOUSE_SYSTEM',
  'AGRICULTURAL_EQUIPMENT_TELEMETRY',
  'SILO_INVENTORY_SYSTEM',
  'COOPERATIVE_PRODUCTION_LEDGER',
  'DAIRY_PRODUCTION_METER',
  'GREENHOUSE_PRODUCTION_SYSTEM',
  'AQUACULTURE_PRODUCTION_SYSTEM',
  'INDEPENDENT_AGRICULTURAL_ATTESTATION',
  'REGULATORY_AGRICULTURAL_REFERENCE',
] as const;
export type AgricultureSourceClass = (typeof AGRICULTURE_SOURCE_CLASSES)[number];

export const AGRICULTURE_FACT_TYPES = ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT'] as const;
export type AgricultureFactType = (typeof AGRICULTURE_FACT_TYPES)[number];

export const AGRICULTURE_MEASUREMENT_SEMANTICS = [
  'PLANTED',
  'GROWING',
  'EXPECTED_YIELD',
  'HARVESTED',
  'ACCEPTED_OUTPUT',
  'REJECTED_OUTPUT',
  'WASTE',
  'INVENTORY',
  'PROCESSED_FOOD',
  'QUALITY_GRADE',
  'WEATHER_CONTEXT',
] as const;
export type AgricultureMeasurementSemantics = (typeof AGRICULTURE_MEASUREMENT_SEMANTICS)[number];

export const REALIZED_HARVEST_SEMANTICS = ['HARVESTED', 'ACCEPTED_OUTPUT'] as const;
export type RealizedHarvestSemantics = (typeof REALIZED_HARVEST_SEMANTICS)[number];

export const AGRICULTURE_METER_SEMANTICS = ['INTERVAL_MASS', 'CUMULATIVE_REGISTER'] as const;
export type AgricultureMeterSemantics = (typeof AGRICULTURE_METER_SEMANTICS)[number];

export const AGRICULTURE_PARTY_ROLES = [
  'OPERATOR',
  'CONTROLLER',
  'LAND_RIGHT_HOLDER',
  'RIGHTS_HOLDER',
  'CONCESSION_HOLDER',
  'LICENSE_HOLDER',
  'CUSTODIAN',
  'LEGAL_OWNER',
] as const;
export type AgriculturePartyRole = (typeof AGRICULTURE_PARTY_ROLES)[number];

export const AGRICULTURE_INDEPENDENCE_CLASSES = [
  'SAME_CONTROLLER',
  'SAME_UPSTREAM_ORGANIZATION',
  'SAME_CONTROL_GROUP',
  'INDEPENDENT_ORGANIZATION',
] as const;
export type AgricultureIndependenceClass = (typeof AGRICULTURE_INDEPENDENCE_CLASSES)[number];

export const AGRICULTURE_REJECTION_CODES = [
  'PLANTED_IS_NOT_PRODUCTION',
  'FORECAST_YIELD_IS_NOT_PRODUCTION',
  'GROWING_IS_NOT_PRODUCTION',
  'INVENTORY_IS_NOT_PRODUCTION',
  'AREA_IS_NOT_OUTPUT',
  'YIELD_ESTIMATE_CANNOT_SUBSTITUTE_HARVEST',
  'WEATHER_IS_NOT_PRODUCTION',
  'PROCESSED_FOOD_CANNOT_BE_SUMMED_WITH_HARVEST',
  'GOODS_REGISTRATION_IS_NOT_NEW_HARVEST',
  'QUALITY_IS_NOT_MASS',
  'REJECTED_OUTPUT_IS_NOT_ACCEPTED_PRODUCTION',
  'WASTE_IS_NOT_PRODUCTION',
  'FLOAT_QUANTITY_FORBIDDEN',
  'NEGATIVE_HARVEST',
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
  'DUPLICATE_HARVEST_MASS',
  'PROTECTED_LOCATION_REDACTION_REQUIRED',
  'AUTO_MINT_FORBIDDEN',
  'CERTIFICATION_CANNOT_AUTHORIZE_MOONREY',
  'REAL_NETWORK_FORBIDDEN',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
  'IRRIGATION_OWNERSHIP_DUPLICATE',
] as const;
export type AgricultureRejectionCode = (typeof AGRICULTURE_REJECTION_CODES)[number];

export type AgricultureRefusal = {
  readonly code: AgricultureRejectionCode;
  readonly detail: string;
};

export type AgricultureGeography = {
  readonly schemaVersion: typeof AGRICULTURE_FABRIC_SCHEMA_VERSION;
  readonly jurisdiction: string;
  readonly farmRegion: string;
  readonly agriculturalDistrict: string;
  readonly watershed: string | null;
  readonly basin: string | null;
  readonly preciseLocationRedacted: boolean;
};

export type AgricultureParty = {
  readonly partyId: string;
  readonly role: AgriculturePartyRole;
  readonly organizationId: string;
};

export type AgricultureRightsReference = {
  readonly referenceId: string;
  readonly role: Exclude<AgriculturePartyRole, 'OPERATOR' | 'CONTROLLER' | 'CUSTODIAN'>;
  readonly concessionOrLicenseId: string | null;
  readonly landRightReference: string | null;
  readonly fixtureOnly: boolean;
  readonly provesRealAuthorization: false;
};

export type AgricultureQualityEvidence = {
  readonly moistureBps: bigint | null;
  readonly grade: string | null;
  readonly acceptedRejectedStatus: 'ACCEPTED' | 'REJECTED' | 'UNINSPECTED';
  readonly inspectionReference: string | null;
  readonly organicOrCertificationReference: string | null;
  readonly fixtureOnly: boolean;
  readonly provesLegalCertification: false;
  readonly changesPhysicalQuantity: false;
};

export type AgricultureWeatherContext = {
  readonly rainfallReference: string | null;
  readonly temperatureReference: string | null;
  readonly forecastReference: string | null;
  readonly isProduction: false;
};

export type AgricultureIdentityRefs = {
  readonly farmSiteRef: IdentityRef;
  readonly fieldPlotRef: IdentityRef | null;
  readonly cropCycleRef: IdentityRef | null;
  readonly harvestCampaignRef: IdentityRef | null;
  readonly harvestBatchRef: IdentityRef | null;
  readonly lotRef: IdentityRef | null;
  readonly siloBatchRef: IdentityRef | null;
  readonly packhouseBatchRef: IdentityRef | null;
};

export type AgricultureRegisterSnapshot = {
  readonly meterRef: string;
  readonly registerId: string;
  readonly readingMantissa: bigint;
  readonly unit: string;
  readonly sourceTimestampUnix: bigint;
};

export type AgricultureSourceRecord = {
  readonly identifier: string;
  readonly sourceClass: AgricultureSourceClass;
  readonly factType: FactType;
  readonly numericValue: string;
  readonly unit: string;
  readonly measurementSemantics: AgricultureMeasurementSemantics;
  readonly meterSemantics: AgricultureMeterSemantics;
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
  readonly geography: AgricultureGeography;
  readonly identity: {
    readonly farmSiteId: string;
    readonly fieldPlotId: string | null;
    readonly cropCycleId: string | null;
    readonly harvestCampaignId: string | null;
    readonly harvestBatchId: string | null;
    readonly lotId: string | null;
    readonly siloBatchId: string | null;
    readonly packhouseBatchId: string | null;
  };
  readonly parties: readonly AgricultureParty[];
  readonly rightsReferences: readonly AgricultureRightsReference[];
  readonly qualityEvidence: AgricultureQualityEvidence | null;
  readonly weatherContext: AgricultureWeatherContext | null;
  readonly prior: AgricultureRegisterSnapshot | null;
  readonly documentedMeterReset: boolean;
  readonly equipmentReplacement: boolean;
  readonly sourceOrganization: string | null;
  readonly extras?: Readonly<Record<string, unknown>>;
};

export type AgricultureFabricPolicy = {
  readonly policyVersion: typeof AGRICULTURE_FABRIC_POLICY_VERSION;
  readonly requireHarvestRightsReference: boolean;
  readonly maximumObservationAgeSeconds: number;
  readonly allowPreciseLocations: boolean;
  readonly productionActive: false;
  readonly realNetworkCalls: false;
  readonly automaticIssuance: false;
};

export type AgricultureQualityInputs = {
  readonly scaleCalibrationBps: number;
  readonly measurementFreshnessBps: number;
  readonly batchIdentityPresent: boolean;
  readonly sourceIndependenceBps: number;
  readonly qualityAttestationBps: number;
};

export type NormalizedAgricultureObservation = {
  readonly schemaVersion: typeof AGRICULTURE_FABRIC_SCHEMA_VERSION;
  readonly observationId: string;
  readonly sourceClass: AgricultureSourceClass;
  readonly factType: AgricultureFactType;
  readonly sourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly proposedClaimType: ClaimType | null;
  readonly measurementSemantics: AgricultureMeasurementSemantics;
  readonly meterSemantics: AgricultureMeterSemantics;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: 'kg' | 'tonne';
  readonly normalizationReceipt: NormalizationReceipt;
  readonly identityRefs: AgricultureIdentityRefs;
  readonly geography: AgricultureGeography;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly operatorPartyId: string;
  readonly parties: readonly AgricultureParty[];
  readonly rightsReferences: readonly AgricultureRightsReference[];
  readonly independenceClass: AgricultureIndependenceClass;
  readonly qualityInputs: AgricultureQualityInputs;
  readonly qualityEvidence: AgricultureQualityEvidence | null;
  readonly createsHarvestEvent: boolean;
  readonly createsInventoryEvidence: boolean;
  readonly isQualityOnly: boolean;
  readonly canCreateOutputClaim: boolean;
  readonly canMintMoonRey: false;
  readonly legalOwnershipInferred: false;
  readonly productionActive: false;
};

export type AgricultureHarvestEvidenceRecord = {
  readonly schemaVersion: typeof AGRICULTURE_FABRIC_SCHEMA_VERSION;
  readonly fabricPolicyVersion: typeof AGRICULTURE_FABRIC_POLICY_VERSION;
  readonly observation: NormalizedAgricultureObservation;
  readonly eventId: string | null;
  readonly claimType: ClaimType | null;
  readonly automaticIssuance: false;
  readonly verified: false;
  readonly issued: false;
  readonly certificationAuthorizesMoonRey: false;
  readonly realProviderContacted: false;
  readonly productionActive: false;
};

export type AgricultureLineageLink = {
  readonly fromObservationId: string;
  readonly toObservationId: string;
  readonly relation: 'SAME_UNDERLYING_EVENT' | 'INPUT_TO' | 'OUTPUT_OF' | 'STORES' | 'TRANSFORMS' | 'LINEAGE_ONLY';
  readonly impliesDuplicateValue: boolean;
};

export function defaultAgricultureFabricPolicy(): AgricultureFabricPolicy {
  return Object.freeze({
    policyVersion: AGRICULTURE_FABRIC_POLICY_VERSION,
    requireHarvestRightsReference: true,
    maximumObservationAgeSeconds: 86_400,
    allowPreciseLocations: false,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}

export function isAgricultureSourceClass(value: string): value is AgricultureSourceClass {
  return (AGRICULTURE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isAgricultureFactType(value: string): value is AgricultureFactType {
  return (AGRICULTURE_FACT_TYPES as readonly string[]).includes(value);
}

export function isAgricultureMeasurementSemantics(value: string): value is AgricultureMeasurementSemantics {
  return (AGRICULTURE_MEASUREMENT_SEMANTICS as readonly string[]).includes(value);
}

export function isRealizedHarvestSemantics(value: string): value is RealizedHarvestSemantics {
  return (REALIZED_HARVEST_SEMANTICS as readonly string[]).includes(value);
}

export function agricultureFactCannotAutoMint(): false {
  return AGRICULTURE_FACT_AUTO_MINTS;
}

export function agricultureProductionIsActive(): false {
  return AGRICULTURE_PRODUCTION_ACTIVE;
}

export function agricultureRealProviderContacted(): false {
  return AGRICULTURE_REAL_PROVIDER_CONTACTED;
}

export function plantedAreaEqualsOutput(): false {
  return PLANTED_AREA_EQUALS_OUTPUT;
}

export function forecastYieldEqualsOutput(): false {
  return FORECAST_YIELD_EQUALS_OUTPUT;
}

export function unitCodeIsMass(unit: string): unit is Extract<UnitCode, 'kg' | 'tonne' | 'g'> {
  return unit === 'kg' || unit === 'tonne' || unit === 'g';
}

export function unitCodeIsArea(unit: string): boolean {
  return unit === 'm2';
}
