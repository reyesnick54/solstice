import {
  assessCoverageManifestQualification,
  type CoverageManifest,
  type CoverageQualificationThresholds,
} from '../../../platform/src/helios/feature-fabric/coverage/index.ts';
import type { QualificationPolicy } from '../qualification-policy.ts';

export function coverageThresholdsFromPolicy(
  policy: QualificationPolicy,
): CoverageQualificationThresholds | null {
  if (policy.minimumCoverageRatioBps === null || policy.maximumCoverageDriftBps === null) {
    return null;
  }
  return Object.freeze({
    minimumCoverageRatioBps: policy.minimumCoverageRatioBps,
    maximumCoverageDriftBps: policy.maximumCoverageDriftBps,
  });
}

export function evaluateCoveragePromotionGate(input: {
  readonly policy: QualificationPolicy;
  readonly evaluationManifest: CoverageManifest | null;
  readonly trainingManifest?: CoverageManifest | null;
  readonly nonUniversalFeaturesUsed?: boolean;
}): { readonly passed: boolean; readonly blockers: readonly string[] } {
  if (
    input.nonUniversalFeaturesUsed &&
    input.policy.requireCoverageManifestForNonUniversalFeatures &&
    input.evaluationManifest === null
  ) {
    return Object.freeze({ passed: false, blockers: Object.freeze(['coverage_manifest_required']) });
  }
  const thresholds = coverageThresholdsFromPolicy(input.policy);
  if (!thresholds || !input.evaluationManifest) {
    return Object.freeze({ passed: true, blockers: Object.freeze([]) });
  }
  const verdict = assessCoverageManifestQualification({
    manifest: input.evaluationManifest,
    thresholds,
    trainingManifest: input.trainingManifest ?? null,
  });
  return Object.freeze({ passed: verdict.passed, blockers: verdict.blockers });
}
