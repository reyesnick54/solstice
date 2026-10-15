/**
 * AAF05 — feature coverage tensor and manifest types (strategy-lab integration).
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const HELIOS_COVERAGE_TENSOR_SCHEMA = 'sunrey.helios.coverage-tensor.v1' as const;

export const HELIOS_FEATURE_COVERAGE_SCHEMA = 'sunrey.helios.feature-coverage.v1' as const;

export const MISSINGNESS_REASONS = [
  'UNKNOWN',
  'NOT_APPLICABLE',
  'ENTITY_UNRESOLVED',
  'NOT_YET_PUBLISHED',
  'PROVIDER_UNAVAILABLE',
  'NOT_COVERED_BY_PROVIDER',
  'ENTITLEMENT_RESTRICTED',
  'HISTORICAL_GAP',
  'QUALITY_REJECTED',
  'SOURCE_STALE',
] as const;

export type MissingnessReason = (typeof MISSINGNESS_REASONS)[number];

export type MissingnessCountByReason = Readonly<Record<MissingnessReason, number>>;

export type CoverageEntitlementState = 'USABLE' | 'RESTRICTED' | 'UNAVAILABLE' | 'UNKNOWN';

export type CoverageQualityState =
  | 'VALID'
  | 'DEGRADED_STALE'
  | 'DEGRADED_GAP'
  | 'DEGRADED_ENTITLEMENT'
  | 'DEGRADED_OUTLIER'
  | 'DEGRADED_SEQUENCE'
  | 'DEGRADED_CONTRADICTORY'
  | 'UNAVAILABLE';

export type FeatureCoverageSignal = {
  readonly published: boolean;
  readonly providerAvailable: boolean;
  readonly providerCoversInstrument: boolean;
  readonly entitlementState: CoverageEntitlementState;
  readonly entityResolved: boolean;
  readonly applicable: boolean;
  readonly qualityState: CoverageQualityState;
  readonly historicalGap: boolean;
  readonly knowableAtEvaluationTime: boolean;
  readonly valuePresent: boolean;
};

export type EligibleUniverseMember = {
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly sector: string | null;
  readonly industry: string | null;
  readonly marketCapBucket: string | null;
  readonly liquidityBucket: string | null;
  readonly geography: string | null;
  readonly venue: string | null;
  readonly assetClass: string | null;
};

export type FeatureCoverageProbe = {
  readonly member: EligibleUniverseMember;
  readonly featureId: string;
  readonly providerId: string | null;
  readonly signal: FeatureCoverageSignal;
};

export type FeatureCoverageCell = {
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly featureId: string;
  readonly providerId: string | null;
  readonly sector: string | null;
  readonly industry: string | null;
  readonly marketCapBucket: string | null;
  readonly liquidityBucket: string | null;
  readonly geography: string | null;
  readonly venue: string | null;
  readonly assetClass: string | null;
  readonly disposition: 'USABLE' | 'MISSING';
  readonly missingnessReason: MissingnessReason | null;
  readonly imputed: boolean;
};

export type CoverageMetricSet = {
  readonly coverageRatioBps: number;
  readonly rollingCoverageRatioBps: number | null;
  readonly providerCoverageRatioBps: Readonly<Record<string, number>>;
  readonly crossSectionalCoverageRatioBps: number;
  readonly featureCompletenessRatioBps: Readonly<Record<string, number>>;
  readonly coverageStabilityBps: number;
  readonly coverageDriftBps: number | null;
};

export type CoverageSliceAggregate = {
  readonly sliceKey: string;
  readonly dimension:
    | 'entity'
    | 'instrument'
    | 'timestamp'
    | 'feature'
    | 'provider'
    | 'sector'
    | 'industry'
    | 'marketCapBucket'
    | 'liquidityBucket'
    | 'geography'
    | 'venue'
    | 'assetClass';
  readonly dimensionValue: string;
  readonly eligibleUniverseCount: number;
  readonly usableFeatureCount: number;
  readonly expectedCellCount: number;
  readonly coverageRatioBps: number;
  readonly missingnessByReason: MissingnessCountByReason;
};

export type CoverageTensor = {
  readonly schemaVersion: typeof HELIOS_COVERAGE_TENSOR_SCHEMA;
  readonly tensorId: string;
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly featureIds: readonly string[];
  readonly eligibleUniverseCount: number;
  readonly usableFeatureCount: number;
  readonly expectedCellCount: number;
  readonly cells: readonly FeatureCoverageCell[];
  readonly slices: readonly CoverageSliceAggregate[];
  readonly metrics: CoverageMetricSet;
  readonly featureFabricSchema: string;
  readonly grantsExecutionAuthority: false;
};

export type CoverageSnapshot = {
  readonly snapshotId: string;
  readonly capturedAt: UtcInstant;
  readonly tensorId: string;
  readonly universeId: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly eligibleUniverseCount: number;
  readonly usableFeatureCount: number;
  readonly expectedCellCount: number;
  readonly metrics: CoverageMetricSet;
  readonly tensorFingerprint: string;
  readonly grantsExecutionAuthority: false;
};

export type CoverageManifest = {
  readonly schemaVersion: typeof HELIOS_COVERAGE_TENSOR_SCHEMA;
  readonly manifestId: string;
  readonly evaluationId: string | null;
  readonly universeDefinition: string;
  readonly universeId: string;
  readonly featureIds: readonly string[];
  readonly eligibleUniverseCount: number;
  readonly usableFeatureCount: number;
  readonly expectedCellCount: number;
  readonly exclusionByReason: MissingnessCountByReason;
  readonly snapshotIds: readonly string[];
  readonly metrics: CoverageMetricSet;
  readonly trainingSnapshotId: string | null;
  readonly evaluationSnapshotId: string;
  readonly manifestFingerprint: string;
  readonly grantsExecutionAuthority: false;
};

export type CoverageDriftEvent = {
  readonly eventId: string;
  readonly detectedAt: UtcInstant;
  readonly universeId: string;
  readonly featureId: string | null;
  readonly baselineSnapshotId: string;
  readonly currentSnapshotId: string;
  readonly metric: 'coverageRatioBps';
  readonly baselineValueBps: number;
  readonly currentValueBps: number;
  readonly driftBps: number;
  readonly material: boolean;
  readonly grantsExecutionAuthority: false;
};

export type CoverageQualificationThresholds = {
  readonly minimumCoverageRatioBps: number;
  readonly maximumCoverageDriftBps: number;
};
