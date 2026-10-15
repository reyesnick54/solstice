import type { CoverageManifest, CoverageSnapshot, CoverageTensor } from './types.ts';
import { HELIOS_FEATURE_COVERAGE_SCHEMA } from './types.ts';

export function buildCoverageManifest(input: {
  readonly evaluationId: string | null;
  readonly universeId: string;
  readonly universeDefinition: string;
  readonly featureIds: readonly string[];
  readonly evaluationTensor: CoverageTensor;
  readonly evaluationSnapshot: CoverageSnapshot;
  readonly trainingSnapshot: CoverageSnapshot | null;
}): CoverageManifest {
  return Object.freeze({
    schemaVersion: HELIOS_FEATURE_COVERAGE_SCHEMA,
    evaluationId: input.evaluationId,
    universeId: input.universeId,
    universeDefinition: input.universeDefinition,
    featureIds: Object.freeze([...input.featureIds]),
    metrics: Object.freeze({
      coverageRatioBps: input.evaluationTensor.coverageRatioBps,
      driftFromBaselineBps: input.evaluationTensor.driftFromBaselineBps,
      eligibleMemberCount: input.evaluationTensor.eligibleMemberCount,
      probeCount: input.evaluationTensor.probes.length,
    }),
    evaluationSnapshot: input.evaluationSnapshot,
    trainingSnapshot: input.trainingSnapshot,
  });
}
