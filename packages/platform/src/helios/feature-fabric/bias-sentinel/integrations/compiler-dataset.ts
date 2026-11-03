import type { UniverseMemberProfile } from '../types.ts';

/** Portable AAFV2.3 / AAF04 dataset compiler manifest reference for bias sentinel binding. */
export type PointInTimeDatasetManifestRef = {
  readonly manifestId: string;
  readonly strategyEvaluationId: string;
};

export function biasSentinelProfilesFromCompilerManifest(input: {
  readonly manifest: PointInTimeDatasetManifestRef;
  readonly intendedEligibleUniverse: readonly UniverseMemberProfile[];
  readonly observedUsableEntityIds: readonly string[];
}): {
  readonly pointInTimeManifestId: string;
  readonly researchDatasetId: string;
} {
  void input.intendedEligibleUniverse;
  void input.observedUsableEntityIds;
  return Object.freeze({
    pointInTimeManifestId: input.manifest.manifestId,
    researchDatasetId: input.manifest.strategyEvaluationId,
  });
}
