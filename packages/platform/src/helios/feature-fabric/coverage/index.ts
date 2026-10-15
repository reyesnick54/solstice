export {
  HELIOS_COVERAGE_TENSOR_SCHEMA,
  MISSINGNESS_REASONS,
  type MissingnessReason,
  type CoverageDimension,
  type EligibleUniverseMember,
  type FeatureCoverageDisposition,
  type FeatureCoverageCell,
  type MissingnessCountByReason,
  type CoverageSliceAggregate,
  type CoverageMetricSet,
  type CoverageTensor,
  type CoverageSnapshot,
  type CoverageManifest,
  type CoverageDriftEvent,
  type CoverageQualificationThresholds,
  type CoverageQualificationVerdict,
} from './types.ts';

export {
  COVERAGE_RATIO_SCALE_BPS,
  ratioBps,
  rollingMeanBps,
  coverageStabilityBps,
  coverageDriftBps,
} from './formulas.ts';

export {
  classifyMissingness,
  dispositionFromMissingness,
  entitlementFailureIsMissingNotZero,
  type CoverageProbeSignal,
} from './classify.ts';

export {
  aggregateCoverageSlices,
  computeCrossSectionalCoverageBps,
  computeFeatureCompletenessBps,
  computeProviderCoverageBps,
  computeCoverageMetricSet,
  tensorFingerprint,
  summarizeExclusions,
} from './metrics.ts';

export {
  buildCoverageTensor,
  sealCoverageSnapshot,
  buildCoverageManifest,
  type FeatureCoverageProbe,
  type BuildCoverageTensorInput,
} from './engine.ts';

export { detectCoverageDrift } from './drift.ts';

export {
  createHeliosCoverageStore,
  type HeliosCoverageStore,
  type HeliosCoverageStoreSnapshot,
} from './store.ts';

export {
  HELIOS_AAF05_COVERAGE_TENSOR_QUALIFIED,
  HELIOS_AAF05_COVERAGE_TENSOR_BLOCKED,
  evaluateAaf05Qualification,
  assessCoverageManifestQualification,
  type Aaf05QualificationChecks,
  type Aaf05QualificationResult,
} from './qualification.ts';
