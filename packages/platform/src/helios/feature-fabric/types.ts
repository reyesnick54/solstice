/**
 * AAF02 — HELIOS evidence-time feature fabric domain types.
 * AAF04 point-in-time compiler consumes temporal-types.ts shapes.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  EntitlementClass,
  InformationTime,
  ObservationEntitlement,
  QualityState,
  SourceIndependence,
} from '../observation/types.ts';

export const HELIOS_FEATURE_FABRIC_SCHEMA = 'sunrey.helios.feature-fabric.v1' as const;

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

export type FeatureValue = {
  readonly kind: FeatureValueKind;
  readonly unit: string | null;
  readonly decimal: string | null;
  readonly integerMinor: string | null;
  readonly boolean: boolean | null;
  readonly text: string | null;
};

export type FeatureSourceRef = {
  readonly observationId: string;
  readonly knowableAt: UtcInstant;
  readonly evidenceRef: string | null;
};

export type FeatureLineageRecord = {
  readonly lineageId: string;
  readonly parentLineageIds: readonly string[];
  readonly transformationId: string;
  readonly transformationVersion: string;
  readonly contentFingerprint: string;
};

export type FeatureDefinition = {
  readonly schemaVersion: typeof HELIOS_FEATURE_FABRIC_SCHEMA;
  readonly featureId: string;
  readonly featureVersion: string;
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
  readonly schemaVersion: typeof HELIOS_FEATURE_FABRIC_SCHEMA;
  readonly featureObservationId: string;
  readonly featureId: string;
  readonly featureVersion: string;
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly value: FeatureValue;
  readonly sourceObservationRefs: readonly FeatureSourceRef[];
  readonly evidenceRefs: readonly string[];
  readonly eventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly computedAt: UtcInstant;
  readonly validFrom: UtcInstant;
  readonly validTo: UtcInstant | null;
  readonly revisionId: string;
  readonly qualityState: FeatureQualityState;
  readonly entitlementState: FeatureEntitlementState;
  readonly entitlementClass: EntitlementClass;
  readonly lineage: FeatureLineageRecord;
  readonly transformationVersion: string;
  readonly transformationParameters: Readonly<Record<string, string>>;
  readonly sourceIndependenceState: SourceIndependence;
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
  readonly schemaVersion: typeof HELIOS_FEATURE_FABRIC_SCHEMA;
  readonly manifestId: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly featureDefinitions: readonly FeatureDefinition[];
  readonly transformations: readonly {
    readonly transformationId: string;
    readonly transformationVersion: string;
    readonly parameters: Readonly<Record<string, string>>;
  }[];
  readonly sourceDatasets: readonly string[];
  readonly sourceObservationRanges: readonly SourceObservationRange[];
  readonly entitlements: readonly ObservationEntitlement[];
  readonly pointInTimeRule: 'knowable_at_lte_evaluation_time';
  readonly universeDefinition: string;
  readonly missingValuePolicy: MissingValuePolicy;
  readonly codeVersion: string;
  readonly modelVersion: string | null;
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
  readonly numericValueMinor?: bigint;
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
};

export type ComputeFeatureResult =
  | { readonly ok: true; readonly observation: FeatureObservation }
  | { readonly ok: false; readonly code: string; readonly message: string };
