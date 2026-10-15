import type { CoverageManifest, CoverageQualificationThresholds } from './types.ts';

export function assessCoverageManifestQualification(input: {
  readonly manifest: CoverageManifest;
  readonly thresholds: CoverageQualificationThresholds;
  readonly trainingManifest?: CoverageManifest | null;
}): { readonly passed: boolean; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (input.manifest.metrics.coverageRatioBps < input.thresholds.minimumCoverageRatioBps) {
    blockers.push('coverage_ratio_below_minimum');
  }
  const drift = input.manifest.metrics.driftFromBaselineBps;
  if (drift !== null && Math.abs(drift) > input.thresholds.maximumCoverageDriftBps) {
    blockers.push('coverage_drift_exceeds_maximum');
  }
  if (input.trainingManifest) {
    const trainingRatio = input.trainingManifest.metrics.coverageRatioBps;
    const evalRatio = input.manifest.metrics.coverageRatioBps;
    const trainDrift = Math.abs(evalRatio - trainingRatio);
    if (trainDrift > input.thresholds.maximumCoverageDriftBps) {
      blockers.push('evaluation_training_coverage_drift');
    }
  }
  return Object.freeze({ passed: blockers.length === 0, blockers: Object.freeze(blockers) });
}
