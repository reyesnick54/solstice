/**
 * Feature lineage and deterministic fingerprints.
 */

import { createHash } from 'node:crypto';

import type { FeatureDefinition, FeatureLineageRecord } from './types.ts';

export function featureContentFingerprint(input: {
  readonly featureId: string;
  readonly featureVersion: string;
  readonly transformationVersion: string;
  readonly transformationParameters: Readonly<Record<string, string>>;
  readonly revisionId: string;
  readonly sourceObservationIds: readonly string[];
  readonly valueCanonical: string;
}): string {
  const payload = JSON.stringify({
    featureId: input.featureId,
    featureVersion: input.featureVersion,
    transformationVersion: input.transformationVersion,
    transformationParameters: input.transformationParameters,
    revisionId: input.revisionId,
    sourceObservationIds: [...input.sourceObservationIds].sort(),
    valueCanonical: input.valueCanonical,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function buildFeatureLineage(input: {
  readonly definition: FeatureDefinition;
  readonly parentLineageIds: readonly string[];
  readonly revisionId: string;
  readonly sourceObservationIds: readonly string[];
  readonly valueCanonical: string;
}): FeatureLineageRecord {
  const contentFingerprint = featureContentFingerprint({
    featureId: input.definition.featureId,
    featureVersion: input.definition.featureVersion,
    transformationVersion: input.definition.transformationVersion,
    transformationParameters: input.definition.transformationParameters,
    revisionId: input.revisionId,
    sourceObservationIds: input.sourceObservationIds,
    valueCanonical: input.valueCanonical,
  });
  const lineageId = createHash('sha256')
    .update(
      `${input.definition.featureId}:${input.definition.transformationVersion}:${contentFingerprint}`,
    )
    .digest('hex')
    .slice(0, 32);
  return Object.freeze({
    lineageId,
    parentLineageIds: Object.freeze([...input.parentLineageIds]),
    transformationId: input.definition.transformationId,
    transformationVersion: input.definition.transformationVersion,
    contentFingerprint,
  });
}

export function transformationVersionChangeCreatesNewLineage(
  prior: FeatureLineageRecord,
  nextTransformationVersion: string,
): boolean {
  return prior.transformationVersion !== nextTransformationVersion;
}
