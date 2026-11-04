/**
 * AAFV2.3 — request, dataset, and policy types for the point-in-time dataset compiler.
 */

import type { UtcInstant } from '@solstice/domain';
import type { FeatureEntitlementState } from '../types.ts';
import type {
  CorporateActionRevisionRow,
  MissingnessPolicy,
  RevisionPolicy,
  TemporalFeatureDefinition,
  TemporalObservation,
  TickerSymbolRow,
  UniverseMembershipRow,
} from '../temporal-types.ts';
import type { PointInTimeDatasetManifest } from './manifest.ts';
import type { CompiledFeatureVector, FeatureCompilerContext } from './compile.ts';
import type { Aafv203LeakageReasonCode } from './leakage-scanner.ts';

export const TEMPORAL_JOIN_POLICIES = ['AS_OF_KNOWABLE', 'AS_OF_SOURCE_EVENT'] as const;
export type TemporalJoinPolicy = (typeof TEMPORAL_JOIN_POLICIES)[number];

export const REVISION_SELECTION_POLICIES = [
  'LATEST_KNOWABLE_REVISION',
  'INITIAL_PUBLICATION_ONLY',
] as const;
export type RevisionSelectionPolicy = (typeof REVISION_SELECTION_POLICIES)[number];

export type InformationTimePolicy = {
  readonly temporalJoinPolicy: TemporalJoinPolicy;
  readonly revisionSelectionPolicy: RevisionSelectionPolicy;
  readonly missingnessPolicy: MissingnessPolicy;
};

export function revisionPolicyFromSelection(policy: RevisionSelectionPolicy): RevisionPolicy {
  return policy;
}

export const INFORMATION_TIME_POLICY_DEFAULT: InformationTimePolicy = Object.freeze({
  temporalJoinPolicy: 'AS_OF_KNOWABLE',
  revisionSelectionPolicy: 'LATEST_KNOWABLE_REVISION',
  missingnessPolicy: 'FAIL_CLOSED',
});

export type UniverseMemberRef = {
  readonly entityId: string;
  readonly instrumentId: string;
};

export type UniverseSnapshot = {
  readonly universeId: string;
  readonly version: string;
  readonly definition: string;
  readonly indexId?: string;
  readonly members: readonly UniverseMemberRef[];
  readonly membershipRows: readonly UniverseMembershipRow[];
  readonly entityGraphVersion: string;
};

export type PointInTimeDatasetRequest = {
  readonly universe: UniverseSnapshot;
  readonly decisionTimes: readonly UtcInstant[];
  readonly featureDefinitions: readonly TemporalFeatureDefinition[];
  readonly strategyGenomeId: string;
  readonly informationTimePolicy: InformationTimePolicy;
  readonly context: Omit<
    FeatureCompilerContext,
    'revisionPolicy' | 'missingnessPolicy' | 'entityResolutionVersion' | 'universeMembership' | 'indexId'
  > & {
    readonly observations: readonly TemporalObservation[];
    readonly tickerHistory?: readonly TickerSymbolRow[];
    readonly corporateActionRevisions?: readonly CorporateActionRevisionRow[];
    readonly sourceProviders?: readonly string[];
    readonly qualityPolicies?: readonly string[];
    readonly entitlementState?: FeatureEntitlementState;
    readonly transformVersions?: Readonly<Record<string, string>>;
    readonly revisionRefs?: readonly string[];
  };
};

export type DatasetQualification = {
  readonly leakageScanPassed: boolean;
  readonly manifestSealed: boolean;
  readonly vectorCount: number;
  readonly decisionTimeCount: number;
  readonly memberCount: number;
};

export type PointInTimeDataset = {
  readonly datasetId: string;
  readonly manifest: PointInTimeDatasetManifest;
  readonly vectors: readonly CompiledFeatureVector[];
  readonly qualification: DatasetQualification;
};

export type Aafv203CompilerFailure = {
  readonly code:
    | 'LEAKAGE_DETECTED'
    | 'MISSING_FEATURE'
    | 'INVALID_MANIFEST'
    | 'REPRODUCTION_MISMATCH'
    | 'INVALID_REQUEST';
  readonly message: string;
  readonly leakageCode?: Aafv203LeakageReasonCode;
  readonly decisionTime?: UtcInstant;
  readonly entityId?: string;
  readonly instrumentId?: string;
};
