import type { StrategyGenome } from '../os05/types.ts';

import { computeStrategyBehaviorFingerprint } from './behavior-fingerprint.ts';
import { behavioralDistance, genomeStructureParameterDistance } from './distance.ts';
import { computeStrategySemanticFingerprint } from './semantic-fingerprint.ts';
import type { AntiCloneOutcome, AntiCloneThresholds, PopulationDiversityState } from './types.ts';

/**
 * Reject near-identical offspring before expensive evaluation.
 * Phase 1: genome structure + parameters vs archive; phase 2: behavior vs nearest genome by structure+params.
 */
export function evaluateAntiClone(
  genome: StrategyGenome,
  state: PopulationDiversityState,
  thresholds: AntiCloneThresholds,
): AntiCloneOutcome {
  const sem = computeStrategySemanticFingerprint(genome);
  const candidateBehavior = computeStrategyBehaviorFingerprint(genome);

  if (state.archive.length === 0) {
    return { kind: 'ACCEPT' };
  }

  let bestStruct = Number.POSITIVE_INFINITY;
  let bestEntry = state.archive[0]!;
  for (const e of state.archive) {
    const d = genomeStructureParameterDistance(sem, e.semantic, genome.parameters, e.parameters, 1, 1);
    if (d < bestStruct) {
      bestStruct = d;
      bestEntry = e;
    }
  }

  if (bestStruct <= thresholds.genomeRedundantMaxDistance) {
    return {
      kind: 'GENOME_REDUNDANT',
      nearestGenomeId: bestEntry.genomeId,
      genomeDistance: bestStruct,
    };
  }

  const behD = behavioralDistance(candidateBehavior, bestEntry.behavior);
  if (behD <= thresholds.behaviorRedundantMaxDistance) {
    return {
      kind: 'BEHAVIOR_REDUNDANT',
      nearestGenomeId: bestEntry.genomeId,
      behaviorDistance: behD,
    };
  }

  return { kind: 'ACCEPT' };
}
