/**
 * AAFV2.1 — universal evidence-time feature fabric domain types.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  EntitlementClass,
  InformationTime,
  ObservationEntitlement,
  QualityState,
  SourceIndependence,
} from '../../observation/types.ts';

export const HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA = 'sunrey.helios.feature-fabric.v2.1' as const;

export const FEATURE_FAMILIES = [
  'MARKET_PRICE',
  'MARKET_VOLUME',
  'MARKET_MICROSTRUCTURE',
  'TECHNICAL',
  'VOLATILITY',
  'FUNDAMENTAL',
  'EARNINGS',
  'MACRO',
  'NEWS',
  'SENTIMENT',
  'OPTIONS',
  'FUTURES',
  'CRYPTO',
  'ONCHAIN',
  'PREDICTION_MARKET',
  'ALTERNATIVE_DATA',
  'CROSS_ASSET',
  'REGIME',
  'RESEARCH_DERIVED',
] as const;

export type FeatureFamily = (typeof FEATURE_FAMILIES)[number];

export const FEATURE_VALUE_KINDS = [
  'decimal',
  'integer_minor',
  'boolean',
  'text',
  'ratio',
  'vector_slot',
] as const;

export type FeatureValueKind = (typeof FEATURE_VALUE_KINDS)[number];

export const FEATURE_QUALITY_STATES = [
  'VALID',
  'DEGRADED_STALE',
  'DEGRADED_ENTITLEMENT',
  'DEGRADED_MISSING_INPUT',
  'DEGRADED_CONTRADICTORY',
  'UNAVAILABLE',
] as const;

export type FeatureQualityState = (typeof FEATURE_QUALITY_STATES)[number];

export const FEATURE_AVAILABILITY_STATES = [
  'AVAILABLE',
  'RESTRICTED',
  'NOT_YET_KNOWABLE',
  'UNAVAILABLE',
] as const;

export type FeatureAvailabilityState = (typeof FEATURE_AVAILABILITY_STATES)[number];

export const FEATURE_ENTITLEMENT_STATES = [
  'USABLE',
  'RESTRICTED',
  'UNAVAILABLE',
  'UNKNOWN',
] as const;

export type FeatureEntitlementState = (typeof FEATURE_ENTITLEMENT_STATES)[number];

export const MISSING_VALUE_POLICIES = ['fail', 'omit', 'forward_fill', 'zero'] as const;
export type MissingValuePolicy = (typeof MISSING_VALUE_POLICIES)[number];

export type FeatureQuality = {
  readonly state: FeatureQualityState;
  readonly degradedReason: string | null;
};

export type FeatureAvailability = {
  readonly state: FeatureAvailabilityState;
  readonly evaluationTimeUtc: UtcInstant;
};

export type FeatureValue = {
  readonly kind: FeatureValueKind;
  readonly unit: string | null;
  readonly decimal: string | null;
  readonly integerMinor: string | null;
  readonly boolean: boolean | null;
  readonly text: string | null;
};

/** Canonical source reference for lineage and cross-asset joins. */
export type FeatureSourceReference = {
  readonly observationId: string;
  readonly knowableAt: UtcInstant;
  readonly evidenceRef: string | null;
  readonly revisionId: string | null;
};

export type FeatureLineageRecord = {
  readonly lineageId: string;
  readonly parentLineageIds: readonly string[];
  readonly transformationId: string;
  readonly transformationVersion: string;
  readonly contentFingerprint: string;
};

export type FeatureComputation = {
  readonly computationId: string;
  readonly computeKind: 'SOURCE_AGGREGATE' | 'DERIVED' | 'CROSS_ASSET' | 'TECHNICAL';
  readonly inputFeatureIds: readonly string[];
  readonly inputLineageHashes: readonly string[];
  readonly transformationVersion: string;
};

export type FeatureDefinition = {
  readonly schemaVersion: typeof HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA;
  readonly featureId: string;
  readonly featureVersion: string;
  readonly featureFamily: FeatureFamily;
  readonly displayName: string;
  readonly description: string;
  readonly valueKind: FeatureValueKind;
  readonly unit: string | null;
  readonly transformationId: string;
  readonly transformationVersion: string;
  readonly transformationParameters: Readonly<Record<string, string>>;
  readonly grantsExecutionAuthority: false;
};

export type FeatureObservation = {
  readonly schemaVersion: typeof HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA;
  readonly featureObservationId: string;
  readonly featureId: string;
  readonly featureVersion: string;
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly value: FeatureValue;
  readonly valueType: FeatureValueKind;
  readonly unit: string | null;
  readonly eventTime: UtcInstant;
  readonly sourcePublishedTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly computedAt: UtcInstant;
  readonly validFrom: UtcInstant;
  readonly validTo: UtcInstant | null;
  readonly revisionId: string;
  readonly sourceRefs: readonly FeatureSourceReference[];
  readonly evidenceRefs: readonly string[];
  readonly entitlementState: FeatureEntitlementState;
  readonly entitlementClass: EntitlementClass;
  readonly qualityState: FeatureQualityState;
  readonly quality: FeatureQuality;
  readonly confidence: string;
  readonly transformationVersion: string;
  readonly transformationParameters: Readonly<Record<string, string>>;
  readonly sourceIndependenceState: SourceIndependence;
  readonly lineage: FeatureLineageRecord;
  readonly lineageHash: string;
  readonly computation: FeatureComputation | null;
  readonly grantsExecutionAuthority: false;
};

export type FeatureSnapshot = {
  readonly snapshotId: string;
  readonly evaluationTime: UtcInstant;
  readonly canonicalEntityId: string;
  readonly features: readonly FeatureObservation[];
  readonly grantsExecutionAuthority: false;
};

export type FeatureVector = {
  readonly vectorId: string;
  readonly evaluationTime: UtcInstant;
  readonly orderedFeatureIds: readonly string[];
  readonly slots: readonly (FeatureObservation | null)[];
  readonly grantsExecutionAuthority: false;
};

export type SourceObservationRange = {
  readonly observationId: string;
  readonly minKnowableAt: UtcInstant;
  readonly maxKnowableAt: UtcInstant;
};

export type FeatureManifest = {
  readonly schemaVersion: typeof HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA;
  readonly manifestId: string;
  readonly manifestHash: string;
  readonly createdAt: UtcInstant;
  readonly decisionTime: UtcInstant;
  readonly entityUniverse: readonly string[];
  readonly instrumentUniverse: readonly string[];
  readonly featureDefinitions: readonly FeatureDefinition[];
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly sourceObservations: readonly FeatureSourceReference[];
  readonly sourceRevisions: readonly string[];
  readonly transformationVersions: readonly string[];
  readonly entitlements: readonly ObservationEntitlement[];
  readonly missingDataPolicy: MissingValuePolicy;
  readonly qualityPolicy: 'propagate_worst_upstream';
  readonly compilerVersion: string;
  readonly lineageHashes: readonly string[];
  readonly sourceDatasets: readonly string[];
  readonly sourceObservationRanges: readonly SourceObservationRange[];
  readonly pointInTimeRule: 'knowable_at_lte_decision_time';
  readonly featureSnapshotIds: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type FeatureContributionInput = {
  readonly observationId: string;
  readonly informationTime: InformationTime;
  readonly entitlement: ObservationEntitlement;
  readonly qualityState: QualityState;
  readonly sourceIndependence: SourceIndependence;
  readonly evidenceRef: string | null;
  readonly revisionId?: string | null;
  readonly numericValueMinor?: bigint;
  readonly confidence?: string;
};

export type ComputeFeatureInput = {
  readonly definition: FeatureDefinition;
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId?: string | null;
  readonly eventTime: UtcInstant;
  readonly computedAt: UtcInstant;
  readonly revisionId: string;
  readonly validFrom: UtcInstant;
  readonly validTo?: UtcInstant | null;
  readonly contributions: readonly FeatureContributionInput[];
  readonly evaluationTimeForVisibility?: UtcInstant | null;
  readonly computation?: FeatureComputation | null;
};

export type ComputeDerivedFeatureInput = {
  readonly definition: FeatureDefinition;
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId?: string | null;
  readonly eventTime: UtcInstant;
  readonly computedAt: UtcInstant;
  readonly revisionId: string;
  readonly validFrom: UtcInstant;
  readonly validTo?: UtcInstant | null;
  readonly inputObservations: readonly FeatureObservation[];
  readonly evaluationTimeForVisibility?: UtcInstant | null;
  readonly combineValue?: (inputs: readonly FeatureObservation[]) => FeatureValue;
};

export type ComputeFeatureResult =
  | { readonly ok: true; readonly observation: FeatureObservation }
  | { readonly ok: false; readonly code: string; readonly message: string };
