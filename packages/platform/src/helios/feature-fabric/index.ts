export {
  HELIOS_FEATURE_FABRIC_SCHEMA,
  FEATURE_VALUE_KINDS,
  FEATURE_QUALITY_STATES,
  FEATURE_AVAILABILITY_STATES,
  FEATURE_ENTITLEMENT_STATES,
  MISSING_VALUE_POLICIES,
  type FeatureValueKind,
  type FeatureQualityState,
  type FeatureAvailabilityState,
  type FeatureEntitlementState,
  type MissingValuePolicy,
  type FeatureValue,
  type FeatureSourceRef,
  type FeatureLineageRecord,
  type FeatureDefinition,
  type FeatureObservation,
  type FeatureSnapshot,
  type FeatureVector,
  type FeatureManifest,
  type FeatureContributionInput,
  type ComputeFeatureInput,
  type ComputeFeatureResult,
  type SourceObservationRange,
} from './types.ts';

export {
  FEATURE_COMPUTE_KINDS,
  TEMPORAL_OBSERVATION_KINDS,
  type CorporateActionRevisionRow,
  type FeatureComputeKind,
  type MissingnessPolicy as TemporalMissingnessPolicy,
  type RevisionPolicy,
  type TemporalFeatureDefinition,
  type TemporalObservation,
  type TemporalObservationKind,
  type TickerSymbolRow,
  type UniverseMembershipRow,
} from './temporal-types.ts';

export {
  maxKnowableAt,
  isFeatureVisibleAt,
  rejectFutureContribution,
  rejectAnyFutureContribution,
  assertKnowableNotFromEventTimeAlone,
  parseFeatureEvaluationTime,
} from './knowable-at.ts';

export { deriveFeatureEntitlement, entitlementsFromContributions } from './entitlement.ts';
export { deriveFeatureQuality, deriveSourceIndependence, availabilityAt } from './quality.ts';
export {
  featureContentFingerprint,
  buildFeatureLineage,
  transformationVersionChangeCreatesNewLineage,
} from './lineage.ts';
export {
  computeFeatureObservation,
  recomputeFeatureObservation,
  selectFeatureRevisionAt,
} from './compute.ts';
export { buildFeatureManifest, buildSourceObservationRanges } from './manifest.ts';
export {
  createHeliosFeatureFabricStore,
  type HeliosFeatureFabricStore,
  type HeliosFeatureFabricStoreSnapshot,
} from './store.ts';
export { HeliosFeatureFabric, type HeliosFeatureFabricOptions } from './fabric.ts';
export {
  HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED,
  HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_BLOCKED,
  evaluateAaf02Qualification,
  type Aaf02QualificationChecks,
  type Aaf02QualificationResult,
} from './qualification.ts';

export * from './compiler/index.ts';
export * from './revision-ledger/index.ts';
export { createRevisionLedgerStore as createPointInTimeRevisionLedgerStore } from './revision-ledger/index.ts';
export * from './aaf06/index.ts';
export * from './macro-intelligence/index.ts';

export * from './entity-resolution/index.ts';
export { computeFeatureWithResolvedEntity, type ComputeFeatureWithResolutionInput } from './entity-binding.ts';
export * from './feature-coverage/index.ts';
