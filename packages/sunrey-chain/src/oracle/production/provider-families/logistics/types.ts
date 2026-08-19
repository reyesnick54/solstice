/**
 * Chunk 132 — Logistics, freight, delivery, and storage data fabric types.
 *
 * Provider-neutral. Extends the Chunk 68 / 127 / 128 production-oracle
 * owner. Does not create a second oracle, mint, or unit authority.
 * Production valuation remains inactive.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ExactQuantity } from '../../../../units/types.ts';

export const LOGISTICS_FABRIC_ID = 'sunrey.logistics-storage-data-fabric.v1' as const;
export const LOGISTICS_FABRIC_SCHEMA_VERSION = 1 as const;
export const LOGISTICS_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const MASS_DISTANCE_RULE_ID = 'logistics.mass-distance.v1' as const;

export const PRODUCTION_ACTIVE = false;
export const REAL_CARRIER_CONTACTED = false;
export const RAW_GPS_PUBLIC = false;
export const GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS = false;
export const WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE = false;
export const GPS_ANTI_SPOOFING_SECURITY_GRADE = false;
export const LOGISTICS_FACT_AUTO_MINTS = false;
export const STORAGE_FACT_AUTO_MINTS = false;
export const FLOAT_MATH_USED = false;

export const LOGISTICS_SOURCE_FAMILIES = [
  'TMS',
  'FREIGHT_CARRIER_SYSTEM',
  'VEHICLE_TELEMATICS_GATEWAY',
  'PROOF_OF_DELIVERY_SYSTEM',
  'CUSTOMS_STATUS_REFERENCE',
  'PORT_TERMINAL_SYSTEM',
  'RAIL_FREIGHT_SYSTEM',
  'AIR_CARGO_SYSTEM',
  'MARITIME_CARGO_SYSTEM',
  'WMS',
  'WAREHOUSE_METER',
  'COLD_STORAGE_METER',
] as const;
export type LogisticsSourceFamily = (typeof LOGISTICS_SOURCE_FAMILIES)[number];

export const LOGISTICS_FACT_TYPES = [
  'LOGISTICS_CAPACITY',
  'DELIVERY_COMPLETION',
  'STORAGE_CAPACITY',
  'GOODS_DELIVERY',
] as const satisfies readonly FactType[];
export type LogisticsFactType = (typeof LOGISTICS_FACT_TYPES)[number];

export const REALIZATION_STATES = ['CAPACITY', 'IN_PROGRESS', 'REALIZED', 'NOT_REALIZED'] as const;
export type RealizationState = (typeof REALIZATION_STATES)[number];

export const DELIVERY_STATUSES = [
  'BOOKED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'ACCEPTED',
  'TERMINAL_RELEASED',
  'EXCEPTION',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const COMPLETION_STATES = ['DELIVERED', 'ACCEPTED', 'TERMINAL_RELEASED'] as const;
export type DeliveryCompletionState = (typeof COMPLETION_STATES)[number];

export const TRANSPORT_MODES = ['ROAD', 'RAIL', 'PORT', 'OCEAN', 'AIR', 'FINAL_MILE'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const STORAGE_SEMANTIC_QUALIFIERS = [
  'PHYSICAL_WAREHOUSE_VOLUME',
  'DIGITAL_BYTE_STORAGE',
] as const;
export type StorageSemanticQualifier = (typeof STORAGE_SEMANTIC_QUALIFIERS)[number];

export const MASS_UNITS = ['kg', 'tonne', 't'] as const;
export type MassUnit = (typeof MASS_UNITS)[number];

export const DISTANCE_UNITS = ['m', 'km'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const VOLUME_UNITS = ['L', 'm3'] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export const POD_EVIDENCE_KINDS = [
  'SIGNED_DELIVERY_ATTESTATION',
  'CARRIER_COMPLETION_RECORD',
  'RECEIVER_ACCEPTANCE_REFERENCE',
  'TERMINAL_RELEASE',
  'APPROVED_EVIDENCE',
] as const;
export type ProofOfDeliveryKind = (typeof POD_EVIDENCE_KINDS)[number];

export const MOVEMENT_REVIEW_FLAGS = [
  'IMPOSSIBLE_SPEED',
  'TIMESTAMP_REVERSAL',
  'TELEPORTING_LOCATION',
  'DUPLICATE_VEHICLE_TELEMETRY',
  'DISTANCE_INCONSISTENCY',
] as const;
export type MovementReviewFlag = (typeof MOVEMENT_REVIEW_FLAGS)[number];

export const LOGISTICS_REFUSAL_CODES = [
  'DISTANCE_WITHOUT_MASS',
  'MASS_WITHOUT_DISTANCE',
  'INCOMPATIBLE_UNITS',
  'FLOAT_QUANTITY_FORBIDDEN',
  'DELIVERY_NOT_COMPLETED',
  'DUPLICATE_DELIVERY',
  'OVERLAPPING_LEGS',
  'WHOLE_TRIP_AND_LEGS_DOUBLE_COUNT',
  'GOODS_OUTPUT_REPLAYED_AS_LOGISTICS',
  'CAPACITY_TREATED_AS_REALIZED',
  'DURATION_REQUIRED',
  'DIGITAL_PHYSICAL_STORAGE_MERGED',
  'RAW_GPS_PUBLIC_FORBIDDEN',
  'CUSTOMER_ADDRESS_PUBLIC_FORBIDDEN',
  'SIGNATURE_IMAGE_FORBIDDEN',
  'SCHEMA_DRIFT',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'UNKNOWN_SOURCE_FAMILY',
  'UNKNOWN_FACT_TYPE',
  'TELEMATICS_IS_NOT_QUANTITY',
  'NETWORK_FORBIDDEN',
  'AUTO_MINT_FORBIDDEN',
] as const;
export type LogisticsRefusalCode = (typeof LOGISTICS_REFUSAL_CODES)[number];

export type LogisticsRefusal = {
  readonly code: LogisticsRefusalCode;
  readonly detail: string;
  readonly reviewRequired: boolean;
};

export type IntegerMeasure = {
  readonly mantissa: string;
  readonly scale: number;
  readonly unit: string;
};

export type ProofOfDelivery = {
  readonly kind: ProofOfDeliveryKind;
  readonly evidenceCommitment: string;
  readonly evidenceReference: string;
  readonly completedState: DeliveryCompletionState;
  readonly storeSignatureImage: false;
};

export type RestrictedTelematicsSample = {
  readonly vehicleRef: string;
  readonly observedAtUnix: bigint;
  readonly latitudeMilliArcsec?: bigint;
  readonly longitudeMilliArcsec?: bigint;
  readonly reportedDistanceMeters?: bigint;
};

export type RestrictedTelematics = {
  readonly samples: readonly RestrictedTelematicsSample[];
  readonly reportedDistanceMeters?: bigint;
  readonly publicExposureForbidden: true;
};

export type TemperatureReading = {
  readonly observedAtUnix: bigint;
  readonly milliCelsius: bigint;
};

export type TransportLegInput = {
  readonly legRef: string;
  readonly mode: TransportMode;
  readonly independentlyRealized: boolean;
  readonly mass?: IntegerMeasure;
  readonly distance?: IntegerMeasure;
  readonly attestedTonneKm?: IntegerMeasure;
  readonly originRegionRef: string;
  readonly destinationRegionRef: string;
  readonly startUnix: bigint;
  readonly endUnix: bigint;
  readonly carrierRef: string;
  readonly vehicleRef?: string;
};

export type LogisticsIdentityBundle = {
  readonly shipmentRef: string | null;
  readonly consignmentRef: string | null;
  readonly containerRef: string | null;
  readonly packageGroupRef: string | null;
  readonly legRef: string | null;
  readonly carrierRef: string | null;
  readonly vehicleRef: string | null;
  readonly originRegionRef: string | null;
  readonly destinationRegionRef: string | null;
  readonly goodsBatchRef: string | null;
  readonly manufacturingEventRef: string | null;
};

export type LogisticsSourceObservation = {
  readonly observationId: string;
  readonly sourceFamily: LogisticsSourceFamily;
  readonly sourceId: string;
  readonly providerId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly relatedSourceIds: readonly string[];
  readonly factType: FactType;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly sourceTimestampUnix: bigint;
  readonly collectionTimestampUnix: bigint;
  readonly numericValue?: string;
  readonly unit?: string;
  readonly mass?: IntegerMeasure;
  readonly distance?: IntegerMeasure;
  readonly volume?: IntegerMeasure;
  readonly measurementStartUnix?: bigint;
  readonly measurementEndUnix?: bigint;
  readonly durationSeconds?: bigint;
  readonly realizationState?: RealizationState;
  readonly deliveryStatus?: DeliveryStatus;
  readonly proofOfDelivery?: ProofOfDelivery;
  readonly identity: LogisticsIdentityBundle;
  readonly legs?: readonly TransportLegInput[];
  readonly countsWholeJourney?: boolean;
  readonly storageQualifier?: StorageSemanticQualifier;
  readonly temperatureReadings?: readonly TemperatureReading[];
  readonly restrictedTelematics?: RestrictedTelematics;
  readonly rawCustomerAddress?: string;
  readonly signatureImage?: string;
  readonly requireSignatureImage?: boolean;
  readonly extras?: Readonly<Record<string, unknown>>;
  readonly networkCallAttempted?: boolean;
};

export type MassDistanceDerivationReceipt = {
  readonly receiptId: string;
  readonly ruleId: typeof MASS_DISTANCE_RULE_ID;
  readonly mass: ExactQuantity;
  readonly distance: ExactQuantity;
  readonly tonneKm: ExactQuantity;
  readonly exact: true;
  readonly roundingApplied: false;
  readonly floatingPointUsed: false;
  readonly conversionVersion: typeof LOGISTICS_NORMALIZATION_VERSION;
};

export type PublicLogisticsEvidence = {
  readonly observationId: string;
  readonly sourceFamily: LogisticsSourceFamily;
  readonly factType: FactType;
  readonly claimType: ClaimType;
  readonly productiveCategory: ProductiveCategory;
  readonly realizationState: RealizationState;
  readonly unit: string | null;
  readonly mantissa: string | null;
  readonly derivationReceiptId: string | null;
  readonly identity: LogisticsIdentityBundle;
  readonly routeCommitment: string | null;
  readonly originRegionRef: string | null;
  readonly destinationRegionRef: string | null;
  readonly proofOfDeliveryRef: string | null;
  readonly storageQualifier: StorageSemanticQualifier | null;
  readonly temperatureEvidenceCommitment: string | null;
  readonly containsRawGps: false;
  readonly containsCustomerAddress: false;
  readonly containsSignatureImage: false;
};

export type LogisticsMapping = {
  readonly sourceFamily: LogisticsSourceFamily;
  readonly factType: LogisticsFactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly defaultUnit: UnitCode | 'm3' | 'm3_hour' | 'tonne_km';
  readonly realizationState: RealizationState;
};

export function isLogisticsSourceFamily(value: string): value is LogisticsSourceFamily {
  return (LOGISTICS_SOURCE_FAMILIES as readonly string[]).includes(value);
}

export function isLogisticsFactType(value: string): value is LogisticsFactType {
  return (LOGISTICS_FACT_TYPES as readonly string[]).includes(value);
}

export function isDeliveryCompleted(status: DeliveryStatus | undefined): boolean {
  return status !== undefined && (COMPLETION_STATES as readonly string[]).includes(status);
}

export function logisticsFactCannotAutoMint(): false {
  return LOGISTICS_FACT_AUTO_MINTS;
}

export function storageFactCannotAutoMint(): false {
  return STORAGE_FACT_AUTO_MINTS;
}

export function gpsAntiSpoofingIsNotSecurityGrade(): false {
  return GPS_ANTI_SPOOFING_SECURITY_GRADE;
}
