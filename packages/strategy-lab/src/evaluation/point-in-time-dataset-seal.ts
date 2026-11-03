/**
 * Strategy Lab evaluation seal for compiled point-in-time datasets (no platform import).
 */

import type { ChronologicalEvaluationConfig } from './types.ts';

/** Minimal manifest seal attached to chronological evaluation configs. */
export type PointInTimeDatasetManifestSeal = {
  readonly manifestId: string;
  readonly datasetId: string;
  readonly strategyGenomeId: string;
  readonly strategyEvaluationId: string;
  readonly compilerVersion: string;
  readonly contentHash: string;
};

export type ChronologicalEvaluationPitConfig = ChronologicalEvaluationConfig & {
  readonly pointInTimeDatasetSeal?: PointInTimeDatasetManifestSeal;
};

export function attachPointInTimeDatasetSeal(
  config: ChronologicalEvaluationConfig,
  seal: PointInTimeDatasetManifestSeal,
): ChronologicalEvaluationPitConfig {
  return Object.freeze({
    ...config,
    pointInTimeDatasetSeal: seal,
  });
}
