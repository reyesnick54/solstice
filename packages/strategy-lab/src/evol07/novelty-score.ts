import type { StrategyGenome } from '../os05/types.ts';

import { nearestNeighborInArchive } from './distance.ts';
import { clamp01 } from './math.ts';
import { computeStrategySemanticFingerprint } from './semantic-fingerprint.ts';
import { HELIOS_EVOL07_NEAREST_NEIGHBOR_ENGINE_SCHEMA_VERSION } from './taxonomy.ts';
import type {
  NoveltyDistanceWeights,
  PopulationDiversityState,
  StrategyBehaviorFingerprint,
  StrategyNoveltyScore,
} from './types.ts';

/**
 * Nearest-neighbor novelty: distance in combined structural / parameter / behavioral space.
 * noveltyScore = min(1, nearestNeighborDistance) — higher when farther from archive (more novel).
 */
export function computeStrategyNoveltyScore(
  genome: StrategyGenome,
  behavior: StrategyBehaviorFingerprint,
  state: PopulationDiversityState,
  weights: NoveltyDistanceWeights,
): StrategyNoveltyScore {
  const sem = computeStrategySemanticFingerprint(genome);
  const nn = nearestNeighborInArchive(sem, genome.parameters, behavior, state.archive, weights);
  const noveltyScore = clamp01(nn.distance);
  return Object.freeze({
    schemaVersion: HELIOS_EVOL07_NEAREST_NEIGHBOR_ENGINE_SCHEMA_VERSION,
    nearestNeighborDistance: nn.distance,
    noveltyScore,
    nearestNeighborGenomeId: nn.nearestGenomeId,
  });
}
