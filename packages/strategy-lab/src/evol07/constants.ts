import type { AntiCloneThresholds, NoveltyDistanceWeights } from './types.ts';

/** Default weights: structural, parameter, behavioral (sum need not be 1 — normalized internally). */
export const DEFAULT_EVOL07_NOVELTY_WEIGHTS: NoveltyDistanceWeights = Object.freeze({
  structural: 0.35,
  parameter: 0.25,
  behavioral: 0.4,
});

export const DEFAULT_EVOL07_ANTI_CLONE_THRESHOLDS: AntiCloneThresholds = Object.freeze({
  genomeRedundantMaxDistance: 0.06,
  behaviorRedundantMaxDistance: 0.05,
});
