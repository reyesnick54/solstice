/**
 * Chunk 136 — Bandwidth, telecom, and digital-network economic data fabric.
 *
 * Provider-neutral metering for network capacity (rate) and transferred
 * usage (volume). Extends sunrey-production-oracles. Not a second oracle
 * owner, mint, Productive Value Function, or live provider integration.
 *
 * DATA_RATE != DATA_VOLUME.
 * BANDWIDTH_CAPACITY is not realized BANDWIDTH_USAGE.
 * Gross wire bytes are not delivered application bytes.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import type { CanonicalProductiveMeasurement } from '../../../../units/measurement.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';

export const BANDWIDTH_FABRIC_VERSION = 'sunrey.bandwidth-network-data-fabric.v1' as const;
export const BANDWIDTH_FABRIC_SCHEMA_VERSION = 1 as const;
export const BANDWIDTH_USAGE_SCHEMA_V1 = 'BANDWIDTH_USAGE_V1' as const;
export const BANDWIDTH_USAGE_SCHEMA_V2 = 'BANDWIDTH_USAGE_V2' as const;
export const BANDWIDTH_CAPACITY_SCHEMA_V1 = 'BANDWIDTH_CAPACITY_V1' as const;

export const REAL_PROVIDER_CONTACTED = false as const;
export const BANDWIDTH_FACT_AUTO_MINTS_MOONREY = false as const;
export const CERTIFICATION_AUTO_MINTS_MOONREY = false as const;
export const DATA_RATE_EQUALS_DATA_VOLUME = false as const;
export const CAPACITY_EQUALS_REALIZED_USAGE = false as const;
export const PACKET_PAYLOAD_STORED = false as const;
export const USER_BROWSING_HISTORY_STORED = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const GROSS_EQUALS_DELIVERED = false as const;
export const CACHE_HIT_CREATES_CONTENT_COPY = false as const;
export const STORAGE_EQUALS_TRANSFER = false as const;

export const BANDWIDTH_SOURCE_CLASSES = [
  'ISP_USAGE_METER',
  'TELECOM_NETWORK_METER',
  'CDN_METERING',
  'NETWORK_EDGE_METER',
  'CLOUD_EGRESS_METER',
  'PEERING_METER',
  'TRANSIT_PROVIDER_METER',
  'DATA_CENTER_NETWORK_METER',
  'ENTERPRISE_NETWORK_METER',
  'SATELLITE_NETWORK_METER',
  'SUBSEA_CAPACITY_REFERENCE',
  'INDEPENDENT_NETWORK_ATTESTATION',
] as const;
export type BandwidthSourceClass = (typeof BANDWIDTH_SOURCE_CLASSES)[number];

export const BANDWIDTH_FACT_TYPES = ['BANDWIDTH_CAPACITY', 'BANDWIDTH_USAGE'] as const;
export type BandwidthFactType = (typeof BANDWIDTH_FACT_TYPES)[number];

export const FORBIDDEN_BANDWIDTH_FACT_TYPES = ['NETWORK_VALUE', 'INTERNET_VALUE', 'TRAFFIC_VALUE'] as const;
export type ForbiddenBandwidthFactType = (typeof FORBIDDEN_BANDWIDTH_FACT_TYPES)[number];

export const BANDWIDTH_TRANSFER_SEMANTICS = [
  'GROSS_NETWORK_BYTES',
  'VERIFIED_TRANSFERRED_BYTES',
  'BILLABLE_EGRESS_BYTES',
  'DELIVERED_BYTES',
  'PEERING_BYTES',
  'TRANSIT_BYTES',
  'CACHE_EGRESS_BYTES',
] as const;
export type BandwidthTransferSemantics = (typeof BANDWIDTH_TRANSFER_SEMANTICS)[number];

export const NETWORK_SERVICE_STAGES = [
  'ORIGIN_HOSTING_NETWORK',
  'TRANSIT_NETWORK',
  'CDN',
  'LAST_MILE_ACCESS',
] as const;
export type NetworkServiceStage = (typeof NETWORK_SERVICE_STAGES)[number];

export const BANDWIDTH_SCHEMA_IDS = [
  BANDWIDTH_CAPACITY_SCHEMA_V1,
  BANDWIDTH_USAGE_SCHEMA_V1,
  BANDWIDTH_USAGE_SCHEMA_V2,
] as const;
export type BandwidthSchemaId = (typeof BANDWIDTH_SCHEMA_IDS)[number];

export const BANDWIDTH_QUANTITY_KINDS = ['DATA_RATE', 'DATA_VOLUME'] as const;
export type BandwidthQuantityKind = (typeof BANDWIDTH_QUANTITY_KINDS)[number];

export const BANDWIDTH_INDEPENDENCE_CLASSES = [
  'SAME_CONTROLLER',
  'SAME_UPSTREAM_ORGANIZATION',
  'INDEPENDENT_ORGANIZATION',
] as const;
export type BandwidthIndependenceClass = (typeof BANDWIDTH_INDEPENDENCE_CLASSES)[number];

export const BANDWIDTH_REFUSAL_CODES = [
  'FORBIDDEN_FACT_TYPE',
  'CAPACITY_IS_NOT_REALIZED_USAGE',
  'RATE_PRESENTED_AS_VOLUME',
  'DURATION_REQUIRED',
  'NEGATIVE_USAGE',
  'FLOAT_QUANTITY_FORBIDDEN',
  'DUPLICATE_INTERVAL',
  'SUBSCRIBER_PII_FORBIDDEN',
  'URL_FIELD_FORBIDDEN',
  'PACKET_PAYLOAD_FORBIDDEN',
  'BROWSING_HISTORY_FORBIDDEN',
  'DNS_HISTORY_FORBIDDEN',
  'MESSAGE_CONTENT_FORBIDDEN',
  'EMAIL_CONTENT_FORBIDDEN',
  'USER_IP_LOG_FORBIDDEN',
  'CREDENTIAL_MATERIAL_FORBIDDEN',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'SCHEMA_DRIFT',
  'UNIT_CHANGE_WITHOUT_VERSION',
  'STALE_TRAFFIC',
  'IMPOSSIBLE_TIMESTAMP_WINDOW',
  'UTILIZATION_DIMENSION_MISMATCH',
  'STORAGE_IS_NOT_TRANSFER',
  'GROSS_IS_NOT_DELIVERED',
  'CACHE_HIT_IS_NOT_CONTENT_COPY',
  'UNKNOWN_SOURCE_CLASS',
  'UNKNOWN_SEMANTICS',
  'SCHEMA_INCOMPATIBLE',
  'INCOMPATIBLE_DIMENSION',
  'AUTO_MINT_FORBIDDEN',
  'CERTIFICATION_CANNOT_AUTHORIZE_MOONREY',
  'REAL_NETWORK_FORBIDDEN',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
] as const;
export type BandwidthRefusalCode = (typeof BANDWIDTH_REFUSAL_CODES)[number];

export type BandwidthRefusal = {
  readonly code: BandwidthRefusalCode;
  readonly detail: string;
};

/**
 * Privacy-safe network-service identity. Opaque hashed refs only.
 * No packet identity, URL, user identity, or subscriber PII.
 */
export type BandwidthEconomicIdentity = {
  readonly schemaVersion: typeof BANDWIDTH_FABRIC_SCHEMA_VERSION;
  readonly networkServiceRef: IdentityRef;
  readonly serviceAgreementRef: IdentityRef;
  readonly providerRef: IdentityRef;
  readonly networkEdgeRef: IdentityRef;
  readonly transferIntervalRef: IdentityRef;
  readonly trafficAggregateRef: IdentityRef;
  readonly peeringDomainRef: IdentityRef | null;
  readonly controllerRef: IdentityRef;
  readonly accountRef: IdentityRef;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly networkStage: NetworkServiceStage;
  readonly packetPayloadStored: false;
  readonly userBrowsingHistoryStored: false;
  readonly subscriberPiiStored: false;
};

export type BandwidthQualityEvidence = {
  readonly latencyMillis: bigint | null;
  readonly packetLossBps: number | null;
  readonly availabilityBps: number | null;
  readonly uptimeSeconds: bigint | null;
  readonly addedToQuantity: false;
};

export type BandwidthCapacityInventory = {
  readonly rate: ExactQuantity;
  readonly dimension: 'DATA_RATE';
  readonly serviceClass: NetworkServiceStage;
  readonly region: string;
  readonly realizedUsage: false;
};

export type BandwidthUtilization = {
  readonly actualVolume: ExactQuantity;
  readonly capacityVolume: ExactQuantity;
  readonly utilizationNumerator: bigint;
  readonly utilizationDenominator: bigint;
  readonly matchingPeriod: true;
  readonly matchingDimension: true;
  readonly matchingServiceClass: true;
  readonly matchingScope: true;
};

export type BandwidthSourceObservation = {
  readonly sourceClass: BandwidthSourceClass;
  readonly schemaId: BandwidthSchemaId;
  readonly schemaVersion: 1 | 2;
  readonly factType: BandwidthFactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly identifier: string;
  readonly numericValue: string;
  readonly unit: UnitCode | 'B_s' | 'B' | 'MB';
  readonly sourceTimestampUnix: string;
  readonly transferSemantics: BandwidthTransferSemantics | null;
  readonly networkStage: NetworkServiceStage;
  readonly quantityKind: BandwidthQuantityKind;
  readonly durationSeconds: bigint | null;
  readonly region: string;
  readonly networkServiceId: string;
  readonly serviceAgreementId: string;
  readonly providerId: string;
  readonly networkEdgeId: string;
  readonly trafficAggregateId: string;
  readonly peeringDomainId: string | null;
  readonly controllerId: string;
  readonly accountControllerId: string;
  readonly measurementStart: bigint;
  readonly measurementEnd: bigint;
  readonly quality?: BandwidthQualityEvidence | undefined;
  readonly cacheHit?: boolean | undefined;
  readonly retransmissionObserved?: boolean | undefined;
  readonly extras?: Readonly<Record<string, unknown>> | undefined;
};

export type BandwidthEconomicRecord = {
  readonly fabricVersion: typeof BANDWIDTH_FABRIC_VERSION;
  readonly schemaId: BandwidthSchemaId;
  readonly usageSchemaVersion: 1 | 2;
  readonly factType: BandwidthFactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly sourceClass: BandwidthSourceClass;
  readonly identity: BandwidthEconomicIdentity;
  readonly transferSemantics: BandwidthTransferSemantics | null;
  readonly networkStage: NetworkServiceStage;
  readonly quantityKind: BandwidthQuantityKind;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: string;
  readonly dimension: string;
  readonly derivedVolume: ExactQuantity | null;
  readonly measurement: CanonicalProductiveMeasurement;
  readonly receipt: NormalizationReceipt;
  readonly quality: BandwidthQualityEvidence | null;
  readonly cacheHitCreatesContentCopy: false;
  readonly grossEqualsDelivered: false;
  readonly storageEqualsTransfer: false;
  readonly dataRateEqualsDataVolume: false;
  readonly capacityEqualsRealizedUsage: false;
  readonly packetPayloadStored: false;
  readonly userBrowsingHistoryStored: false;
  readonly realProviderContacted: false;
  readonly bandwidthFactAutoMintsMoonRey: false;
};

export function isBandwidthSourceClass(value: string): value is BandwidthSourceClass {
  return (BANDWIDTH_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isBandwidthFactType(value: string): value is BandwidthFactType {
  return (BANDWIDTH_FACT_TYPES as readonly string[]).includes(value);
}

export function isForbiddenBandwidthFactType(value: string): value is ForbiddenBandwidthFactType {
  return (FORBIDDEN_BANDWIDTH_FACT_TYPES as readonly string[]).includes(value);
}

export function isBandwidthTransferSemantics(value: string): value is BandwidthTransferSemantics {
  return (BANDWIDTH_TRANSFER_SEMANTICS as readonly string[]).includes(value);
}

export function bandwidthFactDoesNotMintMoonRey(): false {
  return BANDWIDTH_FACT_AUTO_MINTS_MOONREY;
}

export function dataRateIsNotDataVolume(): false {
  return DATA_RATE_EQUALS_DATA_VOLUME;
}

export function capacityIsNotRealizedUsage(): false {
  return CAPACITY_EQUALS_REALIZED_USAGE;
}

export function bandwidthRefusal(code: BandwidthRefusalCode, detail: string): BandwidthRefusal {
  return Object.freeze({ code, detail });
}

export type { FactType, UnitCode, ClaimType, ProductiveCategory, DataSourceCategory };
