/**
 * Controlled seam for Strategy Lab ↔ platform point-in-time feature compiler.
 * Platform owns compilation; strategy-lab attaches manifests to evaluation configs only.
 */

import type { UtcInstant } from '@solstice/domain';

import type { ChronologicalEvaluationConfig } from './types.ts';
import {
  resolvePointInTimeVectorsForEvaluation as resolvePlatformPointInTimeVectors,
  type PointInTimeFeatureEvaluationAttachment,
} from '../../../platform/src/helios/feature-fabric/compiler/strategy-lab-bridge.ts';

export type { PointInTimeFeatureEvaluationAttachment };

export type ChronologicalEvaluationPointInTimeFeatureConfig = ChronologicalEvaluationConfig & {
  readonly pointInTimeFeatureAttachment: PointInTimeFeatureEvaluationAttachment;
};

export function attachPointInTimeManifestToEvaluation(
  config: ChronologicalEvaluationConfig,
  attachment: PointInTimeFeatureEvaluationAttachment,
): ChronologicalEvaluationPointInTimeFeatureConfig {
  return Object.freeze({
    ...config,
    pointInTimeFeatureAttachment: attachment,
  });
}

export function resolvePointInTimeVectorsForEvaluation(
  attachment: PointInTimeFeatureEvaluationAttachment & {
    readonly decisionTimes: readonly UtcInstant[];
  },
) {
  return resolvePlatformPointInTimeVectors(attachment);
}
