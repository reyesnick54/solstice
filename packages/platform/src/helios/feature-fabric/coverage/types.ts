/**
 * AAF05 — feature coverage tensor and manifest types (strategy-lab integration).
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const HELIOS_FEATURE_COVERAGE_SCHEMA = 'sunrey.helios.feature-coverage.v1' as const;

export type CoverageEntitlementState = 'USABLE' | 'RESTRICTED' | 'UNAVAILABLE' | 'UNKNOWN';

export type CoverageQualityState =
  | 'VALID'
  | 'DEGRADED_STALE'
  | 'DEGRADED_GAP'
  | 'DEGRADED_ENTITLEMENT'
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

export type CoverageTensor = {
  readonly schemaVersion: typeof HELIOS_FEATURE_COVERAGE_SCHEMA;
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly eligibleMemberCount: number;
  readonly featureIds: readonly string[];
  readonly probes: readonly FeatureCoverageProbe[];
  readonly coverageRatioBps: number;
  readonly driftFromBaselineBps: number | null;
};

export type CoverageSnapshot = {
  readonly schemaVersion: typeof HELIOS_FEATURE_COVERAGE_SCHEMA;
  readonly snapshotId: string;
  readonly capturedAt: UtcInstant;
  readonly tensorDigest: string;
  readonly coverageRatioBps: number;
};

export type CoverageManifestMetrics = {
  readonly coverageRatioBps: number;
  readonly driftFromBaselineBps: number | null;
  readonly eligibleMemberCount: number;
  readonly probeCount: number;
};

export type CoverageManifest = {
  readonly schemaVersion: typeof HELIOS_FEATURE_COVERAGE_SCHEMA;
  readonly evaluationId: string | null;
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly featureIds: readonly string[];
  readonly metrics: CoverageManifestMetrics;
  readonly evaluationSnapshot: CoverageSnapshot;
  readonly trainingSnapshot: CoverageSnapshot | null;
};

export type CoverageQualificationThresholds = {
  readonly minimumCoverageRatioBps: number;
  readonly maximumCoverageDriftBps: number;
};
