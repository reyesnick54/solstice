/**
 * Chunk 129 — provider-neutral energy / electrical-grid economic data types.
 *
 * Extends the Chunk 68 production-oracle owner. This family can ingest
 * verified real-world electrical energy data later. It does not contact
 * live providers, activate production ingestion, or mint MoonRey.
 *
 * Energy market price is never energy production.
 */

import type { DeviceProvenance, FactType, GeographicScope, UnitCode } from '../../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { CanonicalProductiveMeasurement } from '../../../../units/measurement.ts';

export const ENERGY_FABRIC_ID = 'sunrey.oracle.energy-data-fabric.v1' as const;
export const ENERGY_FABRIC_VERSION = 1 as const;
export const ENERGY_PRODUCTION_ACTIVE = false as const;
export const ENERGY_REFERENCE_PRICE_CREATES_CLAIM = false as const;
export const ENERGY_FACT_AUTO_MINTS_MOONREY = false as const;
export const REAL_EXTERNAL_PROVIDER_CONTACTED = false as const;
export const ENERGY_CAPACITY_UNIT_CONSTITUTION_EXTENDED = false as const;

export const ENERGY_SOURCE_CLASSES = [
  'GENERATOR_METER',
  'PLANT_TELEMETRY',
  'UTILITY_METER',
  'GRID_OPERATOR_AGGREGATE',
  'DISTRIBUTION_OPERATOR_AGGREGATE',
  'ENERGY_STORAGE_METER',
  'MICROGRID_METER',
  'COMMERCIAL_BUILDING_METER',
  'INDUSTRIAL_ENERGY_METER',
  'ENERGY_MARKET_REFERENCE',
] as const;
export type EnergySourceClass = (typeof ENERGY_SOURCE_CLASSES)[number];

export const ENERGY_METER_SEMANTICS = [
  'INTERVAL_ENERGY',
  'CUMULATIVE_REGISTER',
  'INSTANTANEOUS_CAPACITY_REFERENCE',
] as const;
export type EnergyMeterSemantics = (typeof ENERGY_METER_SEMANTICS)[number];

export const ENERGY_FLOW_CHANNELS = [
  'GRID_IMPORT',
  'GRID_EXPORT',
  'LOCAL_PRODUCTION',
  'LOCAL_CONSUMPTION',
  'STORAGE_CHARGE',
  'STORAGE_DISCHARGE',
] as const;
export type EnergyFlowChannel = (typeof ENERGY_FLOW_CHANNELS)[number];

export const ENERGY_SUBJECT_KINDS = [
  'GENERATOR',
  'PLANT',
  'METER',
  'GRID_REGION',
  'MICROGRID',
  'BUILDING_FACILITY',
] as const;
export type EnergySubjectKind = (typeof ENERGY_SUBJECT_KINDS)[number];

export const ENERGY_SCHEMA_IDS = [
  'ENERGY_INTERVAL_V1',
  'ENERGY_CUMULATIVE_REGISTER_V1',
  'ENERGY_CONSUMPTION_INTERVAL_V1',
  'ENERGY_EXPORT_INTERVAL_V1',
  'ENERGY_REFERENCE_PRICE_V1',
  'ENERGY_CAPACITY_REFERENCE_V1',
] as const;
export type EnergySchemaId = (typeof ENERGY_SCHEMA_IDS)[number];

export const ENERGY_ACCEPTED_UNITS = ['Wh', 'kWh', 'MWh'] as const satisfies readonly UnitCode[];
export type EnergyUnitCode = (typeof ENERGY_ACCEPTED_UNITS)[number];

export const ENERGY_POWER_UNIT_CANDIDATES = ['W', 'kW', 'MW', 'GW'] as const;
export type EnergyPowerUnitCandidate = (typeof ENERGY_POWER_UNIT_CANDIDATES)[number];

export const ENERGY_SUPPORTED_FACT_TYPES = [
  'ENERGY_PRODUCTION',
  'ENERGY_CAPACITY',
  'ENERGY_CONSUMPTION',
  'REFERENCE_PRICE',
] as const satisfies readonly FactType[];
export type EnergySupportedFactType = (typeof ENERGY_SUPPORTED_FACT_TYPES)[number];

export const ENERGY_REJECTION_CODES = [
  'SCHEMA_INVALID',
  'SCHEMA_DRIFT',
  'WRONG_FACT_TYPE',
  'WRONG_UNIT',
  'FLOAT_FORBIDDEN',
  'NEGATIVE_PRODUCTION_FORBIDDEN',
  'MISSING_SOURCE_TIMESTAMP',
  'UNDEFINED_INTERVAL',
  'END_NOT_AFTER_START',
  'INTERVAL_INFERRED_FROM_COLLECTION',
  'STALE_READING',
  'FUTURE_READING',
  'CUMULATIVE_NOT_PRODUCTION',
  'METER_RESET',
  'COUNTER_ROLLOVER',
  'REPLACEMENT_METER',
  'BACKWARDS_READING',
  'DUPLICATE_READING',
  'TIMESTAMP_REVERSAL',
  'PRODUCTION_CONSUMPTION_COLLISION',
  'EXPORT_IS_NOT_GROSS_PRODUCTION',
  'IMPORT_IS_NOT_CONSUMPTION_ALIAS',
  'STORAGE_CHARGE_NOT_OUTPUT',
  'STORAGE_DISCHARGE_NOT_INDEPENDENT_PRODUCTION',
  'ROUND_TRIP_EFFICIENCY_INVENTED',
  'UNIT_EXTENSION_REQUIRED',
  'CAPACITY_CANNOT_FAKE_MWH_AS_MW',
  'CAPACITY_CANNOT_CREATE_CLAIM',
  'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
  'REFERENCE_PRICE_CANNOT_MINT',
  'REFERENCE_PRICE_CANNOT_CREATE_GPUV',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'CREDENTIAL_MATERIAL_FORBIDDEN',
  'PII_FORBIDDEN',
  'NORMALIZATION_FAILED',
  'MAPPING_INCOMPATIBLE',
  'QUALITY_REVIEW_REQUIRED',
] as const;
export type EnergyRejectionCode = (typeof ENERGY_REJECTION_CODES)[number];

export type EnergyRejection = {
  readonly code: EnergyRejectionCode;
  readonly detail: string;
  readonly reviewRequired: boolean;
};

export type EnergyIntegerQuantity = {
  readonly mantissa: bigint;
  readonly scale: 0;
  readonly unit: EnergyUnitCode | 'units_produced';
  readonly originalMantissa: bigint;
  readonly originalUnit: string;
};

export type EnergySubjectRef = {
  readonly kind: EnergySubjectKind;
  readonly sourceIdentity: string;
  readonly canonicalRef: string;
  readonly displayLabel: string;
};

export type EnergyGeography = GeographicScope & {
  readonly gridZone: string;
};

export type EnergyTimeWindow = {
  readonly sourceTimestampUnix: bigint;
  readonly measurementStartUnix: bigint;
  readonly measurementEndUnix: bigint;
  readonly collectionTimestampUnix: bigint;
};

export type EnergyIndependence = {
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly transportEndpointId: string | null;
};

export type EnergyReferencePriceMeta = {
  readonly sourceReference: string;
  readonly baseDenomination: string;
  readonly quoteDenomination: string;
  readonly methodologyReference: string;
  readonly geography: EnergyGeography;
  readonly window: EnergyTimeWindow;
};

export type EnergySourceProfile = {
  readonly schemaVersion: typeof ENERGY_FABRIC_VERSION;
  readonly fabricId: typeof ENERGY_FABRIC_ID;
  readonly profileId: string;
  readonly sourceClass: EnergySourceClass;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: EnergySupportedFactType;
  readonly productiveCategory: ProductiveCategory | null;
  readonly claimType: ClaimType | null;
  readonly meterSemantics: EnergyMeterSemantics;
  readonly defaultChannel: EnergyFlowChannel | null;
  readonly schemaId: EnergySchemaId;
  readonly acceptedUnits: readonly EnergyUnitCode[] | readonly ['units_produced'];
  readonly canCreateProductiveClaim: boolean;
  readonly canMintMoonRey: false;
  readonly productionActive: false;
};

export type EnergyObservationInput = {
  readonly schemaId: EnergySchemaId;
  readonly sourceObservationId: string;
  readonly profileId: string;
  readonly sourceClass: EnergySourceClass;
  readonly factType: EnergySupportedFactType;
  readonly meterSemantics: EnergyMeterSemantics;
  readonly channel: EnergyFlowChannel | null;
  readonly subject: EnergySubjectRef;
  readonly meterRef: string;
  readonly registerId: string;
  readonly quantity: string;
  readonly unit: string;
  readonly sourceTimestampUnix: string;
  readonly measurementStartUnix: string | null;
  readonly measurementEndUnix: string | null;
  readonly collectionTimestampUnix: string;
  readonly geography: EnergyGeography;
  readonly independence: EnergyIndependence;
  readonly deviceProvenance: DeviceProvenance | null;
  readonly calibrationRecordRef: string | null;
  readonly prior: EnergyRegisterSnapshot | null;
  readonly relatedObservations?: readonly EnergyObservationInput[];
  readonly referencePrice?: EnergyReferencePriceMeta | null;
  readonly storageInputLineageRef?: string | null;
  readonly extras?: Readonly<Record<string, unknown>>;
};

export type EnergyRegisterSnapshot = {
  readonly meterRef: string;
  readonly registerId: string;
  readonly readingMantissa: bigint;
  readonly unit: string;
  readonly sourceTimestampUnix: bigint;
  readonly subjectCanonicalRef: string;
};

export type EnergyQualityReport = {
  readonly formulaVersion: 'energy.quality.profile.v1';
  readonly engineeringGoverned: true;
  readonly providerSelectedQuality: false;
  readonly schemaValid: boolean;
  readonly continuityOk: boolean;
  readonly missingIntervals: boolean;
  readonly timestampRegular: boolean;
  readonly calibrationReferenced: boolean;
  readonly sourceFresh: boolean;
  readonly sourceIndependent: boolean;
  readonly observationConflict: boolean;
  readonly scoreBps: number;
  readonly details: readonly string[];
};

export type EnergyAcceptedObservation = {
  readonly schemaVersion: typeof ENERGY_FABRIC_VERSION;
  readonly fabricId: typeof ENERGY_FABRIC_ID;
  readonly observationKey: string;
  readonly sourceObservationId: string;
  readonly profile: EnergySourceProfile;
  readonly factType: EnergySupportedFactType;
  readonly channel: EnergyFlowChannel | null;
  readonly meterSemantics: EnergyMeterSemantics;
  readonly subject: EnergySubjectRef;
  readonly geography: EnergyGeography;
  readonly time: EnergyTimeWindow;
  readonly independence: EnergyIndependence;
  readonly sourceQuantity: EnergyIntegerQuantity;
  readonly intervalQuantity: EnergyIntegerQuantity | null;
  readonly canonicalMeasurement: CanonicalProductiveMeasurement | null;
  readonly deviceProvenance: DeviceProvenance | null;
  readonly provenanceCommitment: string;
  readonly economicEventRef: string | null;
  readonly quality: EnergyQualityReport;
  readonly mappingId: string | null;
  readonly canCreateProductiveClaim: boolean;
  readonly autoFinalizesFact: false;
  readonly autoMintsMoonRey: false;
  readonly credentialsPresent: false;
  readonly productionActive: false;
};

export type EnergyIngestResult =
  | { readonly ok: true; readonly value: EnergyAcceptedObservation; readonly idempotentReplay: boolean }
  | { readonly ok: false; readonly error: EnergyRejection };

export function isEnergySourceClass(value: string): value is EnergySourceClass {
  return (ENERGY_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isEnergyMeterSemantics(value: string): value is EnergyMeterSemantics {
  return (ENERGY_METER_SEMANTICS as readonly string[]).includes(value);
}

export function isEnergyFlowChannel(value: string): value is EnergyFlowChannel {
  return (ENERGY_FLOW_CHANNELS as readonly string[]).includes(value);
}

export function isEnergySchemaId(value: string): value is EnergySchemaId {
  return (ENERGY_SCHEMA_IDS as readonly string[]).includes(value);
}

export function isEnergyUnitCode(value: string): value is EnergyUnitCode {
  return (ENERGY_ACCEPTED_UNITS as readonly string[]).includes(value);
}

export function isEnergyPowerUnitCandidate(value: string): value is EnergyPowerUnitCandidate {
  return (ENERGY_POWER_UNIT_CANDIDATES as readonly string[]).includes(value);
}

export function energyRejection(code: EnergyRejectionCode, detail: string, reviewRequired = true): EnergyRejection {
  return Object.freeze({ code, detail, reviewRequired });
}
