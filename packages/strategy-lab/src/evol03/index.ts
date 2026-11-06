/**
 * HELIOS EVOL03 — exports.
 */

export {
  asStrategyEvolutionPopulationId,
  asStrategyEvolutionTrialId,
  asStrategyEvolutionGenerationId,
  asStrategyGeneAttributionId,
} from './ids.ts';
export type {
  StrategyEvolutionPopulationId,
  StrategyEvolutionTrialId,
  StrategyEvolutionGenerationId,
  StrategyGeneAttributionId,
} from './ids.ts';

export {
  HELIOS_EVOL03_POPULATION_ARCHIVE_BLOCKED,
  HELIOS_EVOL03_POPULATION_ARCHIVE_QUALIFIED,
  evaluateEvol03PopulationArchiveQualification,
} from './qualification.ts';
export type { Evol03QualificationChecks, Evol03QualificationResult } from './qualification.ts';

export { EVOLUTION_OPERATORS } from './types.ts';
export type {
  AafCertificateRef,
  DeflatedSharpeRatioEvidence,
  ProbabilityOfBacktestOverfittingEvidence,
  EvolutionOperator,
  EvolutionTrial,
  EvolutionTrialOutcomeSlice,
  EvolutionTrialFailure,
  GenerationRecord,
  GenomeAncestry,
  GenomeFitnessEvidence,
  LineageDiversityMetrics,
  PartitionedEvaluationMetrics,
  ExecutionTwinAssumptionBundle,
  ParentSimilarityAssessment,
  StrategyGeneAttribution,
} from './types.ts';

export { EvolutionArchive } from './evolution-archive.ts';
export { StrategyPopulationStore, type StrategyPopulationRecord } from './strategy-population-store.ts';

export { assessParentPairSimilarity } from './genome-diversity.ts';
export {
  ancestorsFromTrials,
  buildChildIndex,
  buildParentIndex,
  commonAncestor,
  descendantsFromTrials,
  lineageDepth as lineageDepthFromGraph,
  operatorHistory as operatorHistoryFromTrials,
  rootAncestors,
} from './lineage.ts';
