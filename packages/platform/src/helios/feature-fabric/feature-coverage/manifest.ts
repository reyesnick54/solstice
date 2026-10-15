import { createHash } from 'node:crypto';

import type {
  CoverageManifest,
  CoverageQualificationThresholds,
  CoverageQualificationVerdict,
  CoverageSnapshot,
  CoverageTensor,
} from './types.ts';

export function buildCoverageManifest(input: {
  readonly evaluationId: string | null;
  readonly universeDefinition: string;
  readonly universeId: string;
  readonly featureIds: readonly string[];
  readonly evaluationTensor: CoverageTensor;
  readonly evaluationSnapshot: CoverageSnapshot;
  readonly trainingSnapshot: CoverageSnapshot | null;
}): CoverageManifest {
  const driftBps =
    input.trainingSnapshot === null
      ? null
      : Math.abs(input.evaluationSnapshot.coverageRatioBps - input.trainingSnapshot.coverageRatioBps);
  const manifestMaterial = JSON.stringify({
    evaluationId: input.evaluationId,
    universeId: input.universeId,
    universeDefinition: input.universeDefinition,
    featureIds: input.featureIds,
    evaluationFingerprint: input.evaluationSnapshot.tensorFingerprint,
    trainingFingerprint: input.trainingSnapshot?.tensorFingerprint ?? null,
    metrics: {
      coverageRatioBps: input.evaluationTensor.coverageRatioBps,
      usableProbeCount: input.evaluationTensor.usableProbeCount,
      totalProbeCount: input.evaluationTensor.totalProbeCount,
    },
  });
  const manifestFingerprint = createHash('sha256').update(manifestMaterial).digest('hex');
  const manifestId = `coverage-manifest:${manifestFingerprint.slice(0, 20)}`;
  return Object.freeze({
    manifestId,
    manifestFingerprint,
    evaluationId: input.evaluationId,
    universeId: input.universeId,
    universeDefinition: input.universeDefinition,
    featureIds: Object.freeze([...input.featureIds]),
    evaluationTensor: input.evaluationTensor,
    evaluationSnapshot: input.evaluationSnapshot,
    trainingSnapshot: input.trainingSnapshot,
    metrics: Object.freeze({
      coverageRatioBps: input.evaluationTensor.coverageRatioBps,
      usableProbeCount: input.evaluationTensor.usableProbeCount,
      totalProbeCount: input.evaluationTensor.totalProbeCount,
      eligibleUniverseCount: input.evaluationTensor.eligibleMembers.length,
      coverageDriftBps: driftBps,
    }),
    eligibleUniverseCount: input.evaluationTensor.eligibleMembers.length,
    usableFeatureCount: input.evaluationTensor.usableProbeCount,
    grantsExecutionAuthority: false,
  });
}

export function assessCoverageManifestQualification(input: {
  readonly manifest: CoverageManifest;
  readonly thresholds: CoverageQualificationThresholds;
  readonly trainingManifest: CoverageManifest | null;
}): CoverageQualificationVerdict {
  const blockers: string[] = [];
  if (input.manifest.metrics.coverageRatioBps < input.thresholds.minimumCoverageRatioBps) {
    blockers.push('coverage_ratio_below_minimum');
  }
  const drift =
    input.trainingManifest === null
      ? input.manifest.metrics.coverageDriftBps
      : Math.abs(
          input.manifest.metrics.coverageRatioBps - input.trainingManifest.metrics.coverageRatioBps,
        );
  if (drift !== null && drift > input.thresholds.maximumCoverageDriftBps) {
    blockers.push('coverage_drift_exceeds_maximum');
  }
  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    grantsExecutionAuthority: false,
  });
}
