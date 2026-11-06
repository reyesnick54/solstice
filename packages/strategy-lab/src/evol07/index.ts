export {
  HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION,
  HELIOS_EVOL07_NEAREST_NEIGHBOR_ENGINE_SCHEMA_VERSION,
  HELIOS_EVOL07_NEUTRAL_DIAGNOSTIC_DATASET_ID,
  HELIOS_EVOL07_NOVELTY_ENGINE_BLOCKED,
  HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED,
  HELIOS_EVOL07_SEMANTIC_FINGERPRINT_SCHEMA_VERSION,
} from './taxonomy.ts';

export type {
  AntiCloneOutcome,
  AntiCloneThresholds,
  NoveltyDistanceWeights,
  PopulationDiversityArchiveEntry,
  PopulationDiversityState,
  ResearchSelectionNoveltyInput,
  ResearchSelectionNoveltyResult,
  StrategyBehaviorFingerprint,
  StrategyNoveltyScore,
  StrategySemanticFingerprint,
} from './types.ts';

export { DEFAULT_EVOL07_ANTI_CLONE_THRESHOLDS, DEFAULT_EVOL07_NOVELTY_WEIGHTS } from './constants.ts';

export { computeStrategyBehaviorFingerprint, behaviorVector } from './behavior-fingerprint.ts';

export { computeStrategySemanticFingerprint, structuralDistance } from './semantic-fingerprint.ts';

export {
  parameterDistance,
  behavioralDistance,
  combinedDistance,
  nearestNeighborInArchive,
  genomeStructureParameterDistance,
} from './distance.ts';

export { computeStrategyNoveltyScore } from './novelty-score.ts';

export { emptyPopulationDiversityState, withArchivedEntry, populationArchiveEntryFromGenome } from './population-state.ts';

export { evaluateAntiClone } from './anti-clone.ts';

export { researchSelectionNoveltyReward } from './research-selection.ts';

export {
  evaluateEvol07NoveltyEngineQualification,
  evol07EngineeringQualificationChecks,
} from './qualification.ts';
export type { Evol07QualificationChecks, Evol07QualificationResult } from './qualification.ts';

export { clamp01, signedTo01, l1Distance, multisetJaccardDistance } from './math.ts';
