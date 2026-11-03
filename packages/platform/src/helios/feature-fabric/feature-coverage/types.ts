/**
 * Strategy Lab feature coverage tensor — diagnostics only, not financial authority.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

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

export type FeatureCoverageSignal = {
  readonly published: boolean;
  readonly providerAvailable: boolean;
  readonly providerCoversInstrument: boolean;
  readonly entitlementState: 'USABLE' | 'UNAVAILABLE' | 'RESTRICTED';
  readonly entityResolved: boolean;
  readonly applicable: boolean;
  readonly qualityState: 'VALID' | 'DEGRADED_STALE' | 'UNAVAILABLE';
  readonly historicalGap: boolean;
  readonly knowableAtEvaluationTime: boolean;
  readonly valuePresent: boolean;
};

export type FeatureCoverageProbe = {
  readonly member: EligibleUniverseMember;
  readonly featureId: string;
  readonly providerId: string | null;
  readonly signal: FeatureCoverageSignal;
};

export type CoverageTensor = {
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly evaluationTimestamp: UtcInstant;
  readonly eligibleMembers: readonly EligibleUniverseMember[];
  readonly featureIds: readonly string[];
  readonly probes: readonly FeatureCoverageProbe[];
  readonly baselineCoverageRatioBps: number | null;
  readonly totalProbeCount: number;
  readonly usableProbeCount: number;
  readonly coverageRatioBps: number;
  readonly grantsExecutionAuthority: false;
};

export type CoverageSnapshot = {
  readonly snapshotId: string;
  readonly tensorFingerprint: string;
  readonly capturedAt: UtcInstant;
  readonly coverageRatioBps: number;
  readonly usableProbeCount: number;
  readonly totalProbeCount: number;
  readonly grantsExecutionAuthority: false;
};

export type CoverageManifestMetrics = {
  readonly coverageRatioBps: number;
  readonly usableProbeCount: number;
  readonly totalProbeCount: number;
  readonly eligibleUniverseCount: number;
  readonly coverageDriftBps: number | null;
};

export type CoverageManifest = {
  readonly manifestId: string;
  readonly manifestFingerprint: string;
  readonly evaluationId: string | null;
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly featureIds: readonly string[];
  readonly evaluationTensor: CoverageTensor;
  readonly evaluationSnapshot: CoverageSnapshot;
  readonly trainingSnapshot: CoverageSnapshot | null;
  readonly metrics: CoverageManifestMetrics;
  readonly eligibleUniverseCount: number;
  readonly usableFeatureCount: number;
  readonly grantsExecutionAuthority: false;
};

export type CoverageQualificationThresholds = {
  readonly minimumCoverageRatioBps: number;
  readonly maximumCoverageDriftBps: number;
};

export type CoverageQualificationVerdict = {
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly grantsExecutionAuthority: false;
};
