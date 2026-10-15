import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  buildCoverageManifest,
  buildCoverageTensor,
  sealCoverageSnapshot,
  type CoverageManifest,
  type EligibleUniverseMember,
  type FeatureCoverageProbe,
} from '../../../platform/src/helios/feature-fabric/coverage/index.ts';
import { membersAt } from '../dataset.ts';
import type { EvaluationDatasetManifest } from './manifest.ts';
import { isKnowableAt } from './information-time.ts';

export function strategyUsesNonUniversalFeatures(requiredData: readonly string[]): boolean {
  return requiredData.length > 0;
}

function memberFromInstrument(
  instrumentId: string,
  evaluationTimestamp: UtcInstant,
): EligibleUniverseMember {
  return Object.freeze({
    canonicalEntityId: `entity:${instrumentId}`,
    canonicalInstrumentId: instrumentId,
    evaluationTimestamp,
    sector: null,
    industry: null,
    marketCapBucket: null,
    liquidityBucket: null,
    geography: null,
    venue: null,
    assetClass: null,
  });
}

function latestObservationForInstrument(
  manifest: EvaluationDatasetManifest,
  instrumentId: string,
  evaluationTimestamp: UtcInstant,
) {
  const eligible = manifest.observations
    .filter(
      (row) =>
        row.instrumentId === instrumentId &&
        isKnowableAt(evaluationTimestamp, row.informationTime.knowableAt),
    )
    .sort(
      (a, b) =>
        Date.parse(b.informationTime.sourceEventTime) - Date.parse(a.informationTime.sourceEventTime),
    );
  return eligible[0] ?? null;
}

export function buildStrategyEvaluationCoverageManifest(input: {
  readonly evaluationId: string | null;
  readonly manifest: EvaluationDatasetManifest;
  readonly evaluationTimestamp: UtcInstant;
  readonly featureIds: readonly string[];
  readonly trainingCoverageManifest?: CoverageManifest | null;
}): CoverageManifest | null {
  if (input.featureIds.length === 0) {
    return null;
  }
  const membership = membersAt(input.manifest.membership, input.evaluationTimestamp);
  const eligibleMembers = membership.map((instrumentId) =>
    memberFromInstrument(instrumentId, input.evaluationTimestamp),
  );
  const probes: FeatureCoverageProbe[] = [];
  for (const instrumentId of membership) {
    const observation = latestObservationForInstrument(input.manifest, instrumentId, input.evaluationTimestamp);
    for (const featureId of input.featureIds) {
      probes.push(
        Object.freeze({
          member: memberFromInstrument(instrumentId, input.evaluationTimestamp),
          featureId,
          providerId: observation?.providerId ?? null,
          signal: Object.freeze({
            published: observation !== null,
            providerAvailable: observation !== null && !observation.degraded,
            providerCoversInstrument: observation !== null,
            entitlementState: observation?.available ? 'USABLE' : 'UNAVAILABLE',
            entityResolved: true,
            applicable: true,
            qualityState: observation?.degraded ? 'DEGRADED_STALE' : observation ? 'VALID' : 'UNAVAILABLE',
            historicalGap: observation === null,
            knowableAtEvaluationTime:
              observation !== null &&
              isKnowableAt(input.evaluationTimestamp, observation.informationTime.knowableAt),
            valuePresent: observation !== null && observation.available && observation.sessionOpen,
          }),
        }),
      );
    }
  }

  const baseline =
    input.trainingCoverageManifest?.metrics.coverageRatioBps ?? null;

  const tensor = buildCoverageTensor({
    universeId: input.manifest.manifestId,
    universeDefinition: `strategy-lab:${input.manifest.hash}`,
    evaluationTimestamp: input.evaluationTimestamp,
    eligibleMembers,
    featureIds: input.featureIds,
    probes,
    baselineCoverageRatioBps: baseline,
  });
  const evaluationSnapshot = sealCoverageSnapshot({ tensor, capturedAt: input.evaluationTimestamp });
  return buildCoverageManifest({
    evaluationId: input.evaluationId,
    universeDefinition: tensor.universeDefinition,
    universeId: tensor.universeId,
    featureIds: input.featureIds,
    evaluationTensor: tensor,
    evaluationSnapshot,
    trainingSnapshot: null,
  });
}
