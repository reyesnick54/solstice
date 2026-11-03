/**
 * Strategy Lab feature manifests — reproducible evaluation context.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { entitlementsFromContributions } from './entitlement.ts';
import {
  HELIOS_FEATURE_FABRIC_SCHEMA,
  type FeatureDefinition,
  type FeatureManifest,
  type FeatureObservation,
  type FeatureContributionInput,
  type MissingValuePolicy,
  type SourceObservationRange,
} from './types.ts';

export function buildSourceObservationRanges(
  observations: readonly FeatureObservation[],
): readonly SourceObservationRange[] {
  const byId = new Map<string, { min: UtcInstant; max: UtcInstant }>();
  for (const feature of observations) {
    for (const ref of feature.sourceObservationRefs) {
      const existing = byId.get(ref.observationId);
      if (!existing) {
        byId.set(ref.observationId, { min: ref.knowableAt, max: ref.knowableAt });
        continue;
      }
      if (Date.parse(ref.knowableAt) < Date.parse(existing.min)) {
        existing.min = ref.knowableAt;
      }
      if (Date.parse(ref.knowableAt) > Date.parse(existing.max)) {
        existing.max = ref.knowableAt;
      }
    }
  }
  return Object.freeze(
    [...byId.entries()].map(([observationId, range]) =>
      Object.freeze({
        observationId,
        minKnowableAt: range.min,
        maxKnowableAt: range.max,
      }),
    ),
  );
}

export function buildFeatureManifest(input: {
  readonly evaluationTimestamp: UtcInstant;
  readonly definitions: readonly FeatureDefinition[];
  readonly observations: readonly FeatureObservation[];
  readonly contributions: readonly FeatureContributionInput[];
  readonly sourceDatasets: readonly string[];
  readonly universeDefinition: string;
  readonly missingValuePolicy: MissingValuePolicy;
  readonly codeVersion: string;
  readonly modelVersion: string | null;
}): FeatureManifest {
  const manifestId = createHash('sha256')
    .update(
      JSON.stringify({
        evaluationTimestamp: input.evaluationTimestamp,
        definitions: input.definitions.map((d) => `${d.featureId}@${d.featureVersion}`),
        codeVersion: input.codeVersion,
      }),
    )
    .digest('hex')
    .slice(0, 32);

  const transformations = Object.freeze(
    input.definitions.map((definition) =>
      Object.freeze({
        transformationId: definition.transformationId,
        transformationVersion: definition.transformationVersion,
        parameters: definition.transformationParameters,
      }),
    ),
  );

  return Object.freeze({
    schemaVersion: HELIOS_FEATURE_FABRIC_SCHEMA,
    manifestId: `manifest.${manifestId}`,
    evaluationTimestamp: input.evaluationTimestamp,
    featureDefinitions: Object.freeze([...input.definitions]),
    transformations,
    sourceDatasets: Object.freeze([...input.sourceDatasets]),
    sourceObservationRanges: buildSourceObservationRanges(input.observations),
    entitlements: entitlementsFromContributions(input.contributions),
    pointInTimeRule: 'knowable_at_lte_evaluation_time',
    universeDefinition: input.universeDefinition,
    missingValuePolicy: input.missingValuePolicy,
    codeVersion: input.codeVersion,
    modelVersion: input.modelVersion,
    featureSnapshotIds: Object.freeze(
      input.observations.map((row) => row.featureObservationId),
    ),
    grantsExecutionAuthority: false,
  });
}
