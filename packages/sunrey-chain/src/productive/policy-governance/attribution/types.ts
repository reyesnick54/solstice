/**
 * Chunk 120 — Canonical productive economic event identity types.
 *
 * A ProductiveEconomicEvent is the underlying productive occurrence.
 * A claim is an assertion about that event. This layer establishes
 * identity and attribution. It does not allocate MoonRey and does
 * not mint.
 *
 * Strengthens Chunk 74 fingerprints without replacing
 * governedContributionFingerprint, crossCategoryEventFingerprint,
 * or capacityOutputEventFingerprint.
 */

import type { MeasurementPeriod } from '../../types.ts';

export const ATTRIBUTION_SCHEMA_VERSION = 1 as const;
export const EVENT_FINGERPRINT_V3_DOMAIN = 'SUNREY_MOONREY_EVENT_V3' as const;
export const ATTRIBUTION_GRAPH_DOMAIN = 'SUNREY_MOONREY_ATTRIBUTION_GRAPH_V1' as const;
export const EVENT_IDENTITY_PRODUCTION_ACTIVE = false as const;

/**
 * Historical fingerprint domains. v1 and v2 remain authoritative for
 * their original issuance-eligibility paths and must not be deleted.
 */
export const HISTORICAL_FINGERPRINT_DOMAINS = Object.freeze({
  v1Contribution: 'SUNREY_PRODUCTIVE_V1',
  v2GovernedContribution: 'SUNREY_MOONREY_POLICY_V1',
  v2CrossCategory: 'SUNREY_MOONREY_EVENT_V1',
  v2CapacityOutput: 'SUNREY_MOONREY_ASSET_EVENT_V1',
  v3EconomicEvent: EVENT_FINGERPRINT_V3_DOMAIN,
} as const);

/**
 * Deliberate event classes. One ProductiveCategory does not always
 * equal one event class. Factory manufacturing and robot telemetry
 * may share MANUFACTURING_TRANSFORMATION_EVENT.
 */
export const PRODUCTIVE_ECONOMIC_EVENT_CLASSES = [
  'RESOURCE_EXTRACTION_EVENT',
  'ENERGY_PRODUCTION_EVENT',
  'AGRICULTURAL_PRODUCTION_EVENT',
  'WATER_PRODUCTION_EVENT',
  'COMPUTE_EXECUTION_EVENT',
  'AI_COMPUTE_EVENT',
  'MANUFACTURING_TRANSFORMATION_EVENT',
  'MACHINE_OPERATION_EVENT',
  'GOODS_CREATION_EVENT',
  'LOGISTICS_DELIVERY_EVENT',
  'STORAGE_SERVICE_EVENT',
  'BANDWIDTH_SERVICE_EVENT',
  'INFRASTRUCTURE_SERVICE_EVENT',
  'SERVICE_DELIVERY_EVENT',
] as const;
export type ProductiveEconomicEventClass = (typeof PRODUCTIVE_ECONOMIC_EVENT_CLASSES)[number];

export const PRODUCTIVE_ECONOMIC_EVENT_STATUSES = ['OBSERVED', 'VERIFIED', 'SUPERSEDED', 'DISPUTED'] as const;
export type ProductiveEconomicEventStatus = (typeof PRODUCTIVE_ECONOMIC_EVENT_STATUSES)[number];

/**
 * SAME_UNDERLYING_EVENT implies duplicate economic creation risk.
 * INPUT_TO / OUTPUT_OF describe flow and do not imply duplicate value.
 */
export const EVENT_RELATION_TYPES = [
  'SAME_UNDERLYING_EVENT',
  'DERIVED_VIEW_OF',
  'INPUT_TO',
  'OUTPUT_OF',
  'TRANSFORMS',
  'DELIVERS',
  'STORES',
  'TRANSPORTS',
  'CONSUMES',
  'PRODUCES',
  'ENABLES',
  'DEPENDENT_ON',
  'DISTINCT_VALUE_EVENT',
  'SUPERSEDES',
  'CORRECTS',
] as const;
export type EventRelationType = (typeof EVENT_RELATION_TYPES)[number];

export const LINKAGE_CONFIDENCE_CLASSES = [
  'AUTHORITATIVE_LINK',
  'VERIFIED_LINK',
  'STRONG_EVIDENCE',
  'POSSIBLE_MATCH',
  'UNRELATED',
] as const;
export type LinkageConfidenceClass = (typeof LINKAGE_CONFIDENCE_CLASSES)[number];

export const ATTRIBUTION_NODE_KINDS = [
  'ECONOMIC_EVENT',
  'PRODUCTIVE_OBJECT',
  'CLAIM',
  'VERIFIED_CONTRIBUTION',
  'ECONOMIC_ASSET',
] as const;
export type AttributionNodeKind = (typeof ATTRIBUTION_NODE_KINDS)[number];

export const LINEAGE_NODE_KINDS = [
  'RAW_MATERIAL_BATCH',
  'ENERGY_INPUT',
  'MANUFACTURING_TRANSFORMATION',
  'OUTPUT_BATCH',
  'GOODS_IDENTITY',
  'LOGISTICS_MOVEMENT',
  'STORAGE_HOLDING',
  'COMPUTE_USAGE',
  'AI_INFERENCE',
] as const;
export type LineageNodeKind = (typeof LINEAGE_NODE_KINDS)[number];

export type IdentityRef = string;

export type DeliveryPeriod = {
  readonly fromUnixSeconds: bigint;
  readonly untilUnixSeconds: bigint;
};

export type EventIdentityEvidence = {
  readonly transformationRef: IdentityRef | null;
  readonly alternateViewGroupRef: IdentityRef | null;
  readonly physicalObjectRefs: readonly IdentityRef[];
  readonly sourceObjectRefs: readonly IdentityRef[];
  readonly inputLotRefs: readonly IdentityRef[];
  readonly outputLotRefs: readonly IdentityRef[];
  readonly serialAssetRefs: readonly IdentityRef[];
  readonly measurementPeriod: MeasurementPeriod;
  readonly deliveryPeriod: DeliveryPeriod;
  readonly geographyId: string;
  readonly jurisdiction: string;
  readonly oracleFactRefs: readonly IdentityRef[];
  readonly sourceProvenanceRefs: readonly IdentityRef[];
  readonly upstreamEventRefs: readonly IdentityRef[];
  readonly downstreamEventRefs: readonly IdentityRef[];
  readonly canonicalMeasurementRefs: readonly IdentityRef[];
  readonly controllerRefs: readonly IdentityRef[];
  readonly participantRefs: readonly IdentityRef[];
  readonly sourceSystemRefs: readonly IdentityRef[];
  readonly lineageRoot: IdentityRef | null;
  readonly economicTransformationRef: IdentityRef | null;
};

export type HistoricalFingerprintSet = {
  readonly v1Contribution: string | null;
  readonly v2GovernedContribution: string | null;
  readonly v2CrossCategory: string | null;
  readonly v2CapacityOutput: string | null;
};

export type ProductiveEconomicEvent = {
  readonly schemaVersion: typeof ATTRIBUTION_SCHEMA_VERSION;
  readonly eventId: string;
  readonly eventVersion: number;
  readonly eventClass: ProductiveEconomicEventClass;
  readonly sourceObjectRefs: readonly IdentityRef[];
  readonly participantRefs: readonly IdentityRef[];
  readonly controllerRefs: readonly IdentityRef[];
  readonly inputAssetRefs: readonly IdentityRef[];
  readonly outputAssetRefs: readonly IdentityRef[];
  readonly sourceFactRefs: readonly IdentityRef[];
  readonly claimRefs: readonly IdentityRef[];
  readonly contributionRefs: readonly IdentityRef[];
  readonly measurementPeriod: MeasurementPeriod;
  readonly deliveryPeriod: DeliveryPeriod;
  readonly geography: string;
  readonly jurisdiction: string;
  readonly canonicalMeasurementRefs: readonly IdentityRef[];
  readonly parentEventRefs: readonly IdentityRef[];
  readonly childEventRefs: readonly IdentityRef[];
  readonly lineageRoot: IdentityRef;
  readonly eventFingerprint: string;
  readonly historicalFingerprints: HistoricalFingerprintSet;
  readonly evidenceDigest: string;
  readonly status: ProductiveEconomicEventStatus;
  readonly authorizesMoonReyIssuance: false;
  readonly containsRawIndustrialData: false;
  readonly productionActive: false;
};

export type EventRelation = {
  readonly fromId: string;
  readonly toId: string;
  readonly relation: EventRelationType;
  readonly confidence: LinkageConfidenceClass;
  readonly impliesDuplicateValue: boolean;
};

export type LinkageAssessment = {
  readonly confidence: LinkageConfidenceClass;
  readonly relation: EventRelationType | null;
  readonly canEstablishSameUnderlyingEvent: boolean;
  readonly reviewRequired: boolean;
};

export type AttributionGraphNode = {
  readonly id: string;
  readonly kind: AttributionNodeKind;
  readonly label: string;
};

export type AttributionGraphEdge = {
  readonly from: string;
  readonly to: string;
  readonly relation: EventRelationType;
  readonly confidence: LinkageConfidenceClass;
};

export type ProductiveAttributionGraph = {
  readonly schemaVersion: typeof ATTRIBUTION_SCHEMA_VERSION;
  readonly nodes: readonly AttributionGraphNode[];
  readonly edges: readonly AttributionGraphEdge[];
  readonly projectionHash: string;
  readonly isLedger: false;
  readonly isMonetaryAuthority: false;
  readonly canMint: false;
  readonly containsRawIndustrialData: false;
  readonly productionActive: false;
};

export type BatchLineageNode = {
  readonly nodeId: string;
  readonly kind: LineageNodeKind;
  readonly assetRef: IdentityRef;
  readonly eventRef: string | null;
};

export type BatchLineageEdge = {
  readonly fromId: string;
  readonly toId: string;
  readonly relation: EventRelationType;
  readonly confidence: LinkageConfidenceClass;
};

export const ATTRIBUTION_AUTHORITY_BOUNDARY = Object.freeze({
  authorizesMoonReyIssuance: false,
  authorizesSunReyIssuance: false,
  authorizesSettlement: false,
  issuesExecutionAuthority: false,
  isLedger: false,
  isMonetaryAuthority: false,
  canMint: false,
  decidesAllocation: false,
  productionActive: false,
  containsRawIndustrialData: false,
} as const);

export function isProductiveEconomicEventClass(value: string): value is ProductiveEconomicEventClass {
  return (PRODUCTIVE_ECONOMIC_EVENT_CLASSES as readonly string[]).includes(value);
}

export function isEventRelationType(value: string): value is EventRelationType {
  return (EVENT_RELATION_TYPES as readonly string[]).includes(value);
}

export function isLinkageConfidenceClass(value: string): value is LinkageConfidenceClass {
  return (LINKAGE_CONFIDENCE_CLASSES as readonly string[]).includes(value);
}

export function relationImpliesDuplicateValue(relation: EventRelationType): boolean {
  return relation === 'SAME_UNDERLYING_EVENT';
}

export function confidenceCanEstablishSameUnderlyingEvent(confidence: LinkageConfidenceClass): boolean {
  return confidence === 'AUTHORITATIVE_LINK' || confidence === 'VERIFIED_LINK';
}
