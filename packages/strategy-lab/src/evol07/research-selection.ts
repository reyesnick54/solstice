import { clamp01 } from './math.ts';
import type { ResearchSelectionNoveltyInput, ResearchSelectionNoveltyResult } from './types.ts';

/**
 * Novelty is a tie-breaker: never the sole signal.
 * Requires validity, non-trivial fitness (not worst in cohort), and sparse niche (high nearest-neighbor distance).
 */
export function researchSelectionNoveltyReward(input: ResearchSelectionNoveltyInput): ResearchSelectionNoveltyResult {
  if (!input.candidateValid) {
    return { noveltyReward: 0, applied: false, reason: 'invalid_candidate' };
  }
  if (input.cohortFitnessRank >= 0.85) {
    return { noveltyReward: 0, applied: false, reason: 'trivially_inferior' };
  }
  if (input.novelty.nearestNeighborDistance < 0.12) {
    return { noveltyReward: 0, applied: false, reason: 'dense_niche' };
  }
  const reward = clamp01(0.25 * input.novelty.noveltyScore * (1 - input.cohortFitnessRank));
  return {
    noveltyReward: reward,
    applied: reward > 0,
    reason: 'novelty_supplement',
  };
}
