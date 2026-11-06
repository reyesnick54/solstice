import type { UtcInstant } from '@solstice/domain';
import type { ResearchBudgetSnapshot, ResearchValueInput } from '@solstice/platform';
import type { StrategyGenomeId, StrategyGenomeVersion } from '../os05/ids.ts';
import type { StrategyGenome } from '../os05/types.ts';
import type { StrategyIslandId } from './taxonomy.ts';

/** Worker niche: island membership plus optional sub-label for diversity tracking. */
export type PopulationNiche = {
  readonly island: StrategyIslandId;
  /** Distinct sub-population within an island (isolation). */
  readonly subNicheId: string;
};

export type EvaluationPhase = 'PENDING' | 'EVALUATING' | 'COMPLETE' | 'STALLED';

/** One observation of research fitness (e.g. holdout score); not trading PnL. */
export type FitnessObservation = {
  readonly step: number;
  readonly fitness: number;
};

/** Running uncertainty from trajectory (normal approx. confidence interval half-width). */
export type FitnessUncertainty = {
  readonly meanFitness: number;
  readonly confidenceHalfWidth: number;
  readonly sampleCount: number;
};

export type EvolutionLineage = {
  readonly workerId: string;
  readonly island: StrategyIslandId;
  readonly parentWorkerIds: readonly string[];
  readonly generation: number;
  readonly createdAt: UtcInstant;
};

/**
 * Full worker state for population scheduling (research compute only).
 */
export type EvolutionWorkerState = {
  readonly workerId: string;
  readonly currentGenome: StrategyGenome;
  readonly niche: PopulationNiche;
  readonly evaluationPhase: EvaluationPhase;
  /** Research-budget units spent on this lineage (minor units string). */
  readonly researchBudgetSpentMinor: string;
  /** Monotonic evaluation steps since worker creation. */
  readonly evaluationAge: number;
  readonly fitnessTrajectory: readonly FitnessObservation[];
  readonly uncertainty: FitnessUncertainty;
  readonly lineage: EvolutionLineage;
  /** Island migration counter (for controlled cross-island gene flow). */
  readonly migrationGeneration: number;
};

export type ExploitKind = 'COPY_STRUCTURE_FROM_DONOR' | 'MERGE_PARAMETERS_FROM_DONOR';

export type ExploitDecision = {
  readonly kind: 'EXPLOIT';
  readonly exploitKind: ExploitKind;
  readonly recipientWorkerId: string;
  readonly donorWorkerId: string;
  readonly island: StrategyIslandId;
  readonly reason: string;
};

export type ExploreKind = 'PARAMETER_MUTATION' | 'STRUCTURE_MUTATION';

export type ExploreDecision = {
  readonly kind: 'EXPLORE';
  readonly exploreKind: ExploreKind;
  readonly workerId: string;
  readonly island: StrategyIslandId;
  readonly detail: string;
};

/** Per-worker research compute allocation proposal for H20 Meta Allocator. */
export type ResearchBudgetAllocation = {
  readonly workerId: string;
  readonly expectedInformationValueTier: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  readonly researchValueInput: ResearchValueInput;
  readonly maxResearchSpendMinor: string;
  readonly currency: string;
  /** Signals for H20 (research compute budgeting). */
  readonly populationUncertainty: number;
  readonly nicheScarcity: number;
  readonly historicalMutationProductivity: number;
  readonly computeCostMinor: string;
  /** Explicitly not investment capital. */
  readonly grantsInvestmentCapital: false;
  readonly reasonCodes: readonly string[];
};

export type MutationProductivityRecord = {
  readonly island: StrategyIslandId;
  /** Successful fitness improvements after mutation per unit spent (rolling). */
  readonly productivityScore: number;
};

export type PopulationSchedulerConfig = {
  readonly minimumEvaluationAge: number;
  /** Generations between optional cross-island migration attempts. */
  readonly migrationCooldownSteps: number;
  /** Probability [0,1] that a migration slot copies from another island when eligible. */
  readonly migrationProbability: number;
  /** Penalty [0,1] applied to cross-island fitness comparison (niche isolation). */
  readonly crossIslandFitnessPenalty: number;
  /** Minimum confidence half-width to treat uncertainty as HIGH for H20. */
  readonly highUncertaintyHalfWidth: number;
  /** Estimated compute cost (minor) for one exploration step. */
  readonly estimatedResearchCostMinor: string;
  readonly currency: string;
  /** PRNG in [0,1). */
  readonly random: () => number;
};

export type PopulationSchedulerResult = {
  readonly updatedWorkers: readonly EvolutionWorkerState[];
  readonly exploitDecisions: readonly ExploitDecision[];
  readonly exploreDecisions: readonly ExploreDecision[];
  readonly researchAllocations: readonly ResearchBudgetAllocation[];
};

export type CreateEvolutionWorkerInput = {
  readonly workerId: string;
  readonly genomeId: StrategyGenomeId;
  readonly genomeVersion: StrategyGenomeVersion;
  readonly name: string;
  readonly hypothesis: string;
  readonly nodes: StrategyGenome['nodes'];
  readonly parameters: StrategyGenome['parameters'];
  readonly niche: PopulationNiche;
  readonly createdAt: UtcInstant;
  readonly createdBy: string;
  readonly featureManifestVersion: string;
  readonly nodeCatalogVersion: string;
  readonly parentGenomeIds?: readonly StrategyGenomeId[];
  readonly genomeMutationReason: string | null;
};
