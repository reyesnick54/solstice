export type {
  CoverageManifest,
  CoverageManifestMetrics,
  CoverageQualificationThresholds,
  CoverageQualificationVerdict,
  CoverageSnapshot,
  CoverageTensor,
  EligibleUniverseMember,
  FeatureCoverageProbe,
  FeatureCoverageSignal,
} from './types.ts';

export { buildCoverageTensor, sealCoverageSnapshot } from './tensor.ts';
export { assessCoverageManifestQualification, buildCoverageManifest } from './manifest.ts';
