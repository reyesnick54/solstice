/**
 * Chunk 133 — Minerals, natural resources, and extraction economic data fabric.
 *
 * Provider-neutral evidence architecture for mineral reserves, mining
 * extraction, raw-material production, and stockpile measurement.
 *
 * Extends sunrey-production-oracles. Not a second oracle owner, mint,
 * Productive Value Function, or live provider integration.
 *
 * RESOURCE_RESERVE is an estimated/attested stock basis.
 * RESOURCE_EXTRACTION is realized extracted material.
 * REFERENCE_PRICE stays a separate reference-only fact.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';

export const RESOURCE_FABRIC_SCHEMA_VERSION = 1 as const;
export const RESOURCE_FABRIC_POLICY_VERSION = 'sunrey.resource-extraction-data-fabric.v1' as const;
export const RESOURCE_FABRIC_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const RESOURCE_PRODUCTION_ACTIVE = false as const;
export const RESOURCE_REAL_PROVIDER_CONTACTED = false as const;
export const RESOURCE_FACT_AUTO_MINTS = false as const;
export const RESOURCE_CERTIFICATION_AUTHORIZES_MOONREY = false as const;
export const RESERVE_EQUALS_EXTRACTION = false as const;
export const STOCKPILE_MOVEMENT_EQUALS_EXTRACTION = false as const;
export const REFERENCE_PRICE_CREATES_OUTPUT = false as const;
export const LEGAL_OWNERSHIP_INFERRED = false as const;

export const RESOURCE_SOURCE_CLASSES = [
  'MINE_PRODUCTION_SYSTEM',
  'WEIGHBRIDGE',
  'HAULAGE_TELEMETRY',
  'PROCESS_PLANT_METER',
  'INVENTORY_STOCKPILE_SYSTEM',
  'ASSAY_LAB_ATTESTATION',
  'RESOURCE_SURVEY',
  'RESERVE_REPORT_REFERENCE',
  'REGULATORY_PRODUCTION_REFERENCE',
  'INDEPENDENT_AUDITOR_ATTESTATION',
] as const;
export type ResourceSourceClass = (typeof RESOURCE_SOURCE_CLASSES)[number];

export const RESOURCE_FACT_TYPES = ['RESOURCE_RESERVE', 'RESOURCE_EXTRACTION'] as const;
export type ResourceFactType = (typeof RESOURCE_FACT_TYPES)[number];

export const FORBIDDEN_RESOURCE_FACT_TYPES = ['RESOURCE_VALUE', 'MINERAL_VALUE'] as const;
export type ForbiddenResourceFactType = (typeof FORBIDDEN_RESOURCE_FACT_TYPES)[number];

export const RESOURCE_MEASUREMENT_SEMANTICS = [
  'GROSS_EXTRACTED_MASS',
  'NET_SALEABLE_MASS',
  'WASTE_MASS',
  'OVERBURDEN',
  'MOISTURE_ADJUSTED_MASS',
  'PROCESSED_CONCENTRATE',
  'CONTAINED_MATERIAL_MASS',
  'RESERVE_ESTIMATE_MASS',
  'STOCKPILE_INVENTORY_MASS',
  'ASSAY_GRADE_QUALITY',
] as const;
export type ResourceMeasurementSemantics = (typeof RESOURCE_MEASUREMENT_SEMANTICS)[number];

export const EXTRACTION_SEMANTICS = [
  'GROSS_EXTRACTED_MASS',
  'NET_SALEABLE_MASS',
  'WASTE_MASS',
  'OVERBURDEN',
  'MOISTURE_ADJUSTED_MASS',
] as const;
export type ExtractionMeasurementSemantics = (typeof EXTRACTION_SEMANTICS)[number];

export const RESOURCE_PARTY_ROLES = [
  'OPERATOR',
  'CONTROLLER',
  'RIGHTS_HOLDER',
  'CONCESSION_HOLDER',
  'LICENSE_HOLDER',
  'CUSTODIAN',
  'LEGAL_OWNER',
] as const;
export type ResourcePartyRole = (typeof RESOURCE_PARTY_ROLES)[number];

/**
 * Neutral engineering classification references. An enum value is not
 * legal title, JORC/NI 43-101 certification, or geological proof.
 */
export const RESERVE_ENGINEERING_CLASSES = [
  'MEASURED_RESOURCE',
  'INDICATED_RESOURCE',
  'INFERRED_RESOURCE',
  'PROBABLE_RESERVE',
  'PROVED_RESERVE',
  'UNCLASSIFIED_ESTIMATE',
] as const;
export type ReserveEngineeringClass = (typeof RESERVE_ENGINEERING_CLASSES)[number];

export const RESOURCE_INDEPENDENCE_CLASSES = [
  'SAME_CONTROLLER',
  'SAME_UPSTREAM_ORGANIZATION',
  'INDEPENDENT_ORGANIZATION',
] as const;
export type ResourceIndependenceClass = (typeof RESOURCE_INDEPENDENCE_CLASSES)[number];

export const RESOURCE_REJECTION_CODES = [
  'RESERVE_IS_NOT_EXTRACTION',
  'RESERVE_CANNOT_CREATE_OUTPUT',
  'STOCKPILE_MOVEMENT_IS_NOT_EXTRACTION',
  'VOLUME_WITHOUT_DENSITY',
  'ASSAY_GRADE_IS_NOT_MASS',
  'CONTAINED_MATERIAL_POLICY_REQUIRED',
  'MEASUREMENT_SEMANTICS_MISMATCH',
  'ORE_CONCENTRATE_CANNOT_BE_SUMMED',
  'NEGATIVE_EXTRACTION',
  'FLOAT_QUANTITY_FORBIDDEN',
  'COUNTER_RESET_UNDOCUMENTED',
  'KG_TONNE_MISMATCH',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
  'MISSING_RIGHTS_REFERENCE',
  'FIXTURE_IS_NOT_AUTHORIZATION',
  'SCHEMA_DRIFT',
  'STALE_SURVEY',
  'OPERATOR_IS_NOT_LEGAL_OWNER',
  'AUTOMATIC_RESERVE_DEPLETION_FORBIDDEN',
  'ENVIRONMENTAL_MULTIPLIER_FORBIDDEN',
  'RESOURCE_VALUE_FACT_FORBIDDEN',
  'MINERAL_VALUE_FACT_FORBIDDEN',
  'AUTO_MINT_FORBIDDEN',
  'CERTIFICATION_CANNOT_AUTHORIZE_MOONREY',
  'REAL_NETWORK_FORBIDDEN',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
  'INCOMPATIBLE_UNIT',
  'UNKNOWN_SOURCE_CLASS',
  'PROTECTED_LOCATION_REDACTION_REQUIRED',
  'WRONG_FACT_TYPE',
  'UNKNOWN_SEMANTICS',
  'DENSITY_EVIDENCE_INVALID',
  'RECONCILIATION_TOLERANCE_EXCEEDED',
  'DUPLICATE_EXTRACTION_MASS',
] as const;
export type ResourceRejectionCode = (typeof RESOURCE_REJECTION_CODES)[number];

export type ResourceRefusal = {
  readonly code: ResourceRejectionCode;
  readonly detail: string;
};

export type ResourceGeography = {
  readonly schemaVersion: typeof RESOURCE_FABRIC_SCHEMA_VERSION;
  readonly jurisdiction: string;
  readonly mineRegion: string;
  readonly resourceZone: string;
  readonly preciseLocationRedacted: boolean;
  readonly protectedSite: boolean;
};

export type ResourceParty = {
  readonly partyId: string;
  readonly role: ResourcePartyRole;
  readonly organizationId: string;
};

export type ResourceRightsReference = {
  readonly referenceId: string;
  readonly role: Exclude<ResourcePartyRole, 'OPERATOR' | 'CONTROLLER' | 'CUSTODIAN'>;
  readonly concessionOrLicenseId: string | null;
  readonly fixtureOnly: boolean;
  readonly provesRealAuthorization: false;
};

export type GovernedDensityEvidence = {
  readonly densityKgPerM3: bigint;
  readonly methodologyReference: string;
  readonly attestationReference: string | null;
};

export type AssayGradeEvidence = {
  readonly gradePpm: bigint;
  readonly analyte: string;
  readonly samplingMethodologyReference: string;
  readonly laboratoryAttestationReference: string;
  readonly isPhysicalMass: false;
};

export type EnvironmentalTelemetryEvidence = {
  readonly telemetryKind: string;
  readonly reference: string;
  readonly valueMultiplier: false;
  readonly productiveValueBonusOrPenalty: false;
};

export type ResourceIdentityRefs = {
  readonly mineSiteRef: IdentityRef;
  readonly pitShaftZoneRef: IdentityRef | null;
  readonly extractionCampaignRef: IdentityRef | null;
  readonly shiftRef: IdentityRef | null;
  readonly haulBatchRef: IdentityRef | null;
  readonly weighbridgeTicketRef: IdentityRef | null;
  readonly rawMaterialLotRef: IdentityRef | null;
  readonly stockpileRef: IdentityRef | null;
};

export type ResourceSourceRecord = {
  readonly identifier: string;
  readonly sourceClass: ResourceSourceClass;
  readonly factType: FactType | ForbiddenResourceFactType;
  readonly numericValue: string;
  readonly unit: string;
  readonly measurementSemantics: ResourceMeasurementSemantics;
  readonly sourceTimestampUnix: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly operatorPartyId: string;
  readonly geography: ResourceGeography;
  readonly identity: {
    readonly mineSiteId: string;
    readonly pitShaftZoneId: string | null;
    readonly extractionCampaignId: string | null;
    readonly shiftId: string | null;
    readonly haulBatchId: string | null;
    readonly weighbridgeTicketId: string | null;
    readonly rawMaterialLotId: string | null;
    readonly stockpileId: string | null;
  };
  readonly parties: readonly ResourceParty[];
  readonly rightsReferences: readonly ResourceRightsReference[];
  readonly densityEvidence: GovernedDensityEvidence | null;
  readonly assayEvidence: AssayGradeEvidence | null;
  readonly environmentalEvidence: readonly EnvironmentalTelemetryEvidence[];
  readonly reserveEngineeringClass: ReserveEngineeringClass | null;
  readonly methodologyReference: string | null;
  readonly attestationReference: string | null;
  readonly sourceOrganization: string | null;
  readonly effectiveDateUnix: bigint | null;
  readonly documentedMeterReset: boolean;
  readonly priorCumulativeMantissa: bigint | null;
  readonly extras?: Readonly<Record<string, unknown>>;
};

export type ResourceFabricPolicy = {
  readonly policyVersion: typeof RESOURCE_FABRIC_POLICY_VERSION;
  readonly requireExtractionRightsReference: boolean;
  readonly allowContainedMaterialMeasurement: boolean;
  readonly maximumObservationAgeSeconds: number;
  readonly maximumReserveAgeSeconds: number;
  readonly stockpileToleranceGrams: bigint;
  readonly reserveMethodologySupportsExtractionReconciliation: boolean;
  readonly allowPreciseProtectedLocations: boolean;
  readonly productionActive: false;
  readonly realNetworkCalls: false;
  readonly automaticIssuance: false;
};

export type NormalizedResourceObservation = {
  readonly schemaVersion: typeof RESOURCE_FABRIC_SCHEMA_VERSION;
  readonly observationId: string;
  readonly sourceClass: ResourceSourceClass;
  readonly factType: ResourceFactType;
  readonly sourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly proposedClaimType: ClaimType | null;
  readonly measurementSemantics: ResourceMeasurementSemantics;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: 'kg' | 'tonne';
  readonly identityRefs: ResourceIdentityRefs;
  readonly geography: ResourceGeography;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly operatorPartyId: string;
  readonly parties: readonly ResourceParty[];
  readonly rightsReferences: readonly ResourceRightsReference[];
  readonly independenceClass: ResourceIndependenceClass;
  readonly qualityInputs: ResourceQualityInputs;
  readonly createsExtractionEvent: boolean;
  readonly createsReserveEstimate: boolean;
  readonly createsInventoryEvidence: boolean;
  readonly isAssayQualityOnly: boolean;
  readonly canCreateOutputClaim: boolean;
  readonly canMintMoonRey: false;
  readonly legalOwnershipInferred: false;
  readonly productionActive: false;
};

export type ResourceQualityInputs = {
  readonly scaleCalibrationBps: number;
  readonly assayProvenanceBps: number;
  readonly samplingMethodologyBps: number;
  readonly measurementFreshnessBps: number;
  readonly batchIdentityPresent: boolean;
  readonly sourceIndependenceBps: number;
  readonly stockpileReconciliationBps: number;
};

export type ResourceExtractionEvidenceRecord = {
  readonly schemaVersion: typeof RESOURCE_FABRIC_SCHEMA_VERSION;
  readonly fabricPolicyVersion: typeof RESOURCE_FABRIC_POLICY_VERSION;
  readonly observation: NormalizedResourceObservation;
  readonly eventId: string | null;
  readonly claimType: ClaimType | null;
  readonly automaticIssuance: false;
  readonly verified: false;
  readonly issued: false;
  readonly certificationAuthorizesMoonRey: false;
  readonly realProviderContacted: false;
  readonly productionActive: false;
};

export type ResourceLineageLink = {
  readonly fromObservationId: string;
  readonly toObservationId: string;
  readonly relation: 'SAME_UNDERLYING_EVENT' | 'INPUT_TO' | 'OUTPUT_OF' | 'STORES' | 'TRANSFORMS' | 'LINEAGE_ONLY';
  readonly impliesDuplicateValue: boolean;
};

export function defaultResourceFabricPolicy(): ResourceFabricPolicy {
  return Object.freeze({
    policyVersion: RESOURCE_FABRIC_POLICY_VERSION,
    requireExtractionRightsReference: true,
    allowContainedMaterialMeasurement: false,
    maximumObservationAgeSeconds: 86_400,
    maximumReserveAgeSeconds: 31_536_000,
    stockpileToleranceGrams: 1_000_000n,
    reserveMethodologySupportsExtractionReconciliation: false,
    allowPreciseProtectedLocations: false,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}

export function isResourceSourceClass(value: string): value is ResourceSourceClass {
  return (RESOURCE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isResourceFactType(value: string): value is ResourceFactType {
  return (RESOURCE_FACT_TYPES as readonly string[]).includes(value);
}

export function isResourceMeasurementSemantics(value: string): value is ResourceMeasurementSemantics {
  return (RESOURCE_MEASUREMENT_SEMANTICS as readonly string[]).includes(value);
}

export function resourceFactCannotAutoMint(): false {
  return RESOURCE_FACT_AUTO_MINTS;
}

export function certificationCannotAuthorizeMoonRey(): false {
  return RESOURCE_CERTIFICATION_AUTHORIZES_MOONREY;
}

export function resourceProductionIsActive(): false {
  return RESOURCE_PRODUCTION_ACTIVE;
}

export function resourceRealProviderContacted(): false {
  return RESOURCE_REAL_PROVIDER_CONTACTED;
}

export function unitCodeIsMass(unit: string): unit is Extract<UnitCode, 'kg' | 'tonne'> {
  return unit === 'kg' || unit === 'tonne';
}

export function unitCodeIsVolume(unit: string): boolean {
  return unit === 'm3' || unit === 'L';
}
