export {
  HELIOS_UNIVERSAL_FEATURE_FABRIC_SCHEMA,
  FEATURE_FAMILIES,
  FEATURE_VALUE_KINDS,
  FEATURE_QUALITY_STATES,
  FEATURE_AVAILABILITY_STATES,
  FEATURE_ENTITLEMENT_STATES,
  MISSING_VALUE_POLICIES,
  type FeatureFamily,
  type FeatureValueKind,
  type FeatureQualityState,
  type FeatureAvailabilityState,
  type FeatureEntitlementState,
  type MissingValuePolicy,
  type FeatureValue,
  type FeatureSourceReference,
  type FeatureLineageRecord,
  type FeatureComputation,
  type FeatureDefinition,
  type FeatureObservation,
  type FeatureSnapshot,
  type FeatureVector,
  type FeatureQuality,
  type FeatureAvailability,
  type FeatureManifest,
  type FeatureContributionInput,
  type ComputeFeatureInput,
  type ComputeDerivedFeatureInput,
  type ComputeFeatureResult,
  type SourceObservationRange,
} from './types.ts';

export {
  maxKnowableAt,
  maxKnowableAtObservations,
  isFeatureVisibleAt,
  rejectFutureContribution,
  rejectAnyFutureContribution,
  rejectFutureInputObservation,
  assertDerivedKnowableNotBeforeInputs,
  assertKnowableNotFromEventTimeAlone,
  parseFeatureEvaluationTime,
} from './knowable-at.ts';

export { deriveFeatureEntitlement, deriveFeatureEntitlementFromInputs, entitlementsFromContributions } from './entitlement.ts';
export {
  deriveFeatureQuality,
  deriveFeatureQualityFromInputs,
  featureQualityRecord,
  deriveSourceIndependence,
  availabilityAt,
} from './quality.ts';
export {
  featureContentFingerprint,
  buildFeatureLineage,
  transformationVersionChangeCreatesNewLineage,
} from './lineage.ts';
export {
  computeFeatureObservation,
  recomputeFeatureObservation,
  selectFeatureRevisionAt,
  buildFeatureObservationFromParts,
} from './compute.ts';
export { computeDerivedFeatureObservation } from './derived.ts';
export { buildFeatureManifest, buildSourceObservationRanges, computeManifestHash } from './manifest.ts';
export {
  createHeliosUniversalFeatureFabricStore,
  type HeliosUniversalFeatureFabricStore,
  type HeliosUniversalFeatureFabricStoreSnapshot,
} from './store.ts';
export { HeliosUniversalFeatureFabric, type HeliosUniversalFeatureFabricOptions } from './fabric.ts';
export {
  FUNDAMENTAL_UNIVERSAL_COMPILER_VERSION,
  fundamentalFeatureDefinition,
  pointInTimeFundamentalSnapshotToObservations,
  pointInTimeFundamentalSnapshotToVector,
} from './fundamental-bridge.ts';
export { technicalIndicatorToUniversalObservation, predictionMarketSnapshotToUniversalObservation } from './adapters.ts';
export { sealUniversalFeatureManifest } from './evidence.ts';
export {
  HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED,
  HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_BLOCKED,
  evaluateAafv2UniversalFeatureFabricQualification,
  type Aafv2UniversalQualificationChecks,
  type Aafv2UniversalQualificationResult,
} from './qualification.ts';
