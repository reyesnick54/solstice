/**
 * Strategy Lab integration seam for AAF04 PointInTimeDatasetManifest artifacts.
 * Chronological evaluation can attach compiled feature manifests without rewriting the engine.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ChronologicalEvaluationConfig } from './types.ts';
import type { StrategyEvaluationId } from './ids.ts';
import {
  reproduceVectorsFromManifest,
  type CompiledFeatureVector,
  type FeatureCompilerContext,
  type FeatureDefinition,
  type PointInTimeDatasetManifest,
} from '../../../platform/src/helios/feature-fabric/index.ts';

export type PointInTimeFeatureEvaluationAttachment = {
  readonly manifest: PointInTimeDatasetManifest;
  readonly featureDefinitions: readonly FeatureDefinition[];
  readonly context: FeatureCompilerContext;
  readonly entityId: string;
  readonly instrumentId: string;
  readonly decisionTimes: readonly UtcInstant[];
};

export type ChronologicalEvaluationPitConfig = ChronologicalEvaluationConfig & {
  readonly pointInTimeFeatureAttachment?: PointInTimeFeatureEvaluationAttachment;
};

export function attachPointInTimeManifestToEvaluation(
  config: ChronologicalEvaluationConfig,
  attachment: PointInTimeFeatureEvaluationAttachment,
): ChronologicalEvaluationPitConfig {
  return Object.freeze({
    ...config,
    pointInTimeFeatureAttachment: attachment,
  });
}

export function resolvePointInTimeVectorsForEvaluation(
  attachment: PointInTimeFeatureEvaluationAttachment,
): readonly CompiledFeatureVector[] {
  const reproduced = reproduceVectorsFromManifest({
    manifest: attachment.manifest,
    entityId: attachment.entityId,
    instrumentId: attachment.instrumentId,
    decisionTimes: attachment.decisionTimes,
    featureDefinitions: attachment.featureDefinitions,
    context: attachment.context,
  });
  if (!reproduced.ok) {
    throw new Error(reproduced.error.message);
  }
  return reproduced.value;
}

export function pitManifestMatchesEvaluation(
  manifest: PointInTimeDatasetManifest,
  evaluationId: StrategyEvaluationId,
): boolean {
  return manifest.strategyEvaluationId === evaluationId;
}
