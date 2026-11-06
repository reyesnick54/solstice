import type { StrategyGenome } from '../os05/types.ts';

import { computeStrategyBehaviorFingerprint } from './behavior-fingerprint.ts';
import { computeStrategySemanticFingerprint } from './semantic-fingerprint.ts';
import type { PopulationDiversityArchiveEntry, PopulationDiversityState, StrategyBehaviorFingerprint } from './types.ts';

export function emptyPopulationDiversityState(): PopulationDiversityState {
  return Object.freeze({ archive: Object.freeze([]) });
}

export function withArchivedEntry(
  state: PopulationDiversityState,
  entry: PopulationDiversityArchiveEntry,
): PopulationDiversityState {
  return Object.freeze({
    archive: Object.freeze([...state.archive, entry]),
  });
}

export function populationArchiveEntryFromGenome(
  genome: StrategyGenome,
  behavior?: StrategyBehaviorFingerprint,
): PopulationDiversityArchiveEntry {
  const beh = behavior ?? computeStrategyBehaviorFingerprint(genome);
  const sem = computeStrategySemanticFingerprint(genome);
  return Object.freeze({
    genomeId: genome.genomeId,
    parameters: genome.parameters,
    behavior: beh,
    semantic: sem,
  });
}
