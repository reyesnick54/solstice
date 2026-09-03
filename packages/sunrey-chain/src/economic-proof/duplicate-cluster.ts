import { economicProofDigest, sortedJoin } from './hash.ts';
import type {
  CanonicalEventId,
  DuplicateCluster,
  DuplicateClusterId,
  EconomicClaimId,
  RegisteredEconomicObservation,
  EconomicObservationId,
  EconomyKind,
  ClusterResolutionStatus,
} from './types.ts';

export function asDuplicateClusterId(value: string): DuplicateClusterId {
  return value as DuplicateClusterId;
}

export function deriveDuplicateClusterId(canonicalEventId: CanonicalEventId): DuplicateClusterId {
  return asDuplicateClusterId(economicProofDigest(['cluster', canonicalEventId]));
}

export function clusterConfidence(observationCount: number, sourceClassCount: number): DuplicateCluster['confidence'] {
  if (observationCount >= 3 && sourceClassCount >= 2) {
    return 'HIGH';
  }
  if (observationCount >= 2) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function clusterResolutionStatus(
  observationCount: number,
  sourceClassCount: number,
): ClusterResolutionStatus {
  if (observationCount <= 1) {
    return 'SINGLE_OBSERVATION';
  }
  if (sourceClassCount >= 2) {
    return 'CORROBORATING';
  }
  return 'PENDING_REVIEW';
}

export function buildDuplicateCluster(input: {
  readonly canonicalEventId: CanonicalEventId;
  readonly economy: EconomyKind;
  readonly observations: readonly RegisteredEconomicObservation[];
  readonly claimId?: EconomicClaimId;
}): DuplicateCluster {
  const observationIds = Object.freeze(
    [...new Set(input.observations.map((observation) => observation.observationId))].sort(),
  ) as readonly EconomicObservationId[];
  const sourceClasses = Object.freeze(
    [...new Set(input.observations.map((observation) => observation.sourceClass))].sort(),
  );
  return Object.freeze({
    clusterId: deriveDuplicateClusterId(input.canonicalEventId),
    canonicalEventId: input.canonicalEventId,
    economy: input.economy,
    observationIds,
    sourceClasses,
    claimId: input.claimId ?? null,
    resolutionStatus: clusterResolutionStatus(observationIds.length, sourceClasses.length),
    confidence: clusterConfidence(observationIds.length, sourceClasses.length),
  });
}

export function mergeClusterObservations(
  cluster: DuplicateCluster,
  observations: readonly RegisteredEconomicObservation[],
): DuplicateCluster {
  const mergedIds = sortedJoin([...cluster.observationIds, ...observations.map((o) => o.observationId)]);
  const mergedSourceClasses = sortedJoin([
    ...cluster.sourceClasses,
    ...observations.map((o) => o.sourceClass),
  ]);
  const observationIds = mergedIds.split(',').filter(Boolean) as EconomicObservationId[];
  const sourceClasses = mergedSourceClasses.split(',').filter(Boolean);
  return Object.freeze({
    ...cluster,
    observationIds: Object.freeze(observationIds),
    sourceClasses: Object.freeze(sourceClasses),
    resolutionStatus: clusterResolutionStatus(observationIds.length, sourceClasses.length),
    confidence: clusterConfidence(observationIds.length, sourceClasses.length),
  });
}
