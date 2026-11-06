import type { UtcInstant } from '@solstice/domain';

import type { EvolutionAntiOverfittingDiagnostics } from './anti-overfitting.ts';
import type { PointInTimeDatasetManifestSeal } from '../evaluation/point-in-time-dataset-seal.ts';
import type { StrategyEvaluationId } from '../evaluation/ids.ts';
import type { StrategyGenome, StrategyGenomeId, StrategyGenomeVersion } from '../os05/types.ts';
import type {
  EvolutionBudgetId,
  EvolutionEvidenceManifestId,
  EvolutionGenerationId,
  EvolutionObjectiveId,
  EvolutionPolicyId,
  EvolutionProgramId,
  EvolutionRunId,
  GenomeCandidateId,
  GenomeLineageEdgeId,
  GenomePopulationId,
} from './ids.ts';

/**
 * HELIOS strategy evolution (EVOL01): research-only mutation and evaluation of declarative Strategy Genome.
 *
 * Critical: evolution does not issue Execution Authority, modify risk limits, waive AAF or compliance,
 * promote strategies to live trading, or erase failed trials. Outputs remain Strategy Genome data.
 */

/** Domain qualification marker for EVOL01 (typed constant; not a runtime gate). */
export const HELIOS_EVOL01_EVOLUTION_DOMAIN_QUALIFIED = 'HELIOS_EVOL01_EVOLUTION_DOMAIN_QUALIFIED' as const;

/** Candidate / lineage lifecycle within an evolution program (distinct from strategy capsule promotion state). */
export const EVOLUTION_CANDIDATE_LIFECYCLE = [
  'PROPOSED',
  'VALIDATED',
  'EVALUATING',
  'CHALLENGER',
  'CHAMPION',
  'NICHE_ELITE',
  'DEGRADED',
  'DEMOTED',
  'RETIRED',
  'REJECTED',
] as const;

export type EvolutionCandidateLifecycleState = (typeof EVOLUTION_CANDIDATE_LIFECYCLE)[number];

export const EVOLUTION_PROGRAM_STATES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ABORTED'] as const;
export type EvolutionProgramState = (typeof EVOLUTION_PROGRAM_STATES)[number];

export const EVOLUTION_RUN_STATES = ['PENDING', 'RUNNING', 'COMPLETED', 'ABORTED', 'FAILED'] as const;
export type EvolutionRunState = (typeof EVOLUTION_RUN_STATES)[number];

/** Single scalar or lexicographic objective component (no strategy code; declarative weights only). */
export type EvolutionObjective = {
  readonly objectiveId: EvolutionObjectiveId;
  readonly label: string;
  /** Higher is better unless maximize is false. */
  readonly maximize: boolean;
  /** Non-negative integer weight in fixed-point minor units (e.g. 1_000_000n = unit weight). */
  readonly weightMinor: bigint;
};

/** Caps on search and evaluation; all optional fields mean “unset / use policy default”. */
export type EvolutionBudget = {
  readonly budgetId: EvolutionBudgetId;
  readonly maxGenerations: number | null;
  readonly maxCandidatesPerGeneration: number | null;
  readonly maxEvaluationRecords: number | null;
  /** Optional research spend cap in minor currency units. */
  readonly researchSpendCapMinor: bigint | null;
};

/** Governance and allowed operators for an evolution program (references external policy seal). */
export type EvolutionPolicy = {
  readonly policyId: EvolutionPolicyId;
  readonly policyContentHash: string;
  readonly permitsGenomeMutation: true;
  readonly selfPromotionForbidden: true;
};

/** Program definition: ties objectives, budget, and policy; does not execute trading. */
export type EvolutionProgram = {
  readonly programId: EvolutionProgramId;
  readonly name: string;
  readonly hypothesis: string;
  readonly state: EvolutionProgramState;
  readonly createdAt: UtcInstant;
  readonly objectives: readonly EvolutionObjective[];
  readonly budget: EvolutionBudget;
  readonly policy: EvolutionPolicy;
};

/** One run of a program (e.g. one search session). */
export type EvolutionRun = {
  readonly runId: EvolutionRunId;
  readonly programId: EvolutionProgramId;
  readonly state: EvolutionRunState;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly generationCount: number;
};

/** One generation within a run. */
export type EvolutionGeneration = {
  readonly generationId: EvolutionGenerationId;
  readonly runId: EvolutionRunId;
  readonly index: number;
  readonly populationId: GenomePopulationId;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
};

/** A population groups candidate genomes under one generation. */
export type GenomePopulation = {
  readonly populationId: GenomePopulationId;
  readonly generationId: EvolutionGenerationId;
  readonly candidateIds: readonly GenomeCandidateId[];
};

/**
 * One evolved candidate: always a declarative Strategy Genome (OS05) plus evolution metadata.
 * Failed trials are retained by reference (evaluation ids); nothing in this type erases history.
 */
export type GenomeCandidate = {
  readonly candidateId: GenomeCandidateId;
  readonly programId: EvolutionProgramId;
  readonly runId: EvolutionRunId;
  readonly generationId: EvolutionGenerationId;
  readonly lifecycle: EvolutionCandidateLifecycleState;
  readonly genome: StrategyGenome;
  readonly parentCandidateIds: readonly GenomeCandidateId[];
  readonly parentGenomeIds: readonly StrategyGenomeId[];
  /** Sealed evaluation artifacts for this candidate (chronological, append-only). */
  readonly evaluationRecordIds: readonly StrategyEvaluationId[];
};

/** Directed edge for genealogy across candidates / genome versions (audit and anti-duplication). */
export type GenomeLineageEdge = {
  readonly edgeId: GenomeLineageEdgeId;
  readonly programId: EvolutionProgramId;
  readonly runId: EvolutionRunId;
  readonly fromCandidateId: GenomeCandidateId;
  readonly toCandidateId: GenomeCandidateId;
  readonly fromGenomeId: StrategyGenomeId;
  readonly fromGenomeVersion: StrategyGenomeVersion;
  readonly toGenomeId: StrategyGenomeId;
  readonly toGenomeVersion: StrategyGenomeVersion;
  readonly mutationSummary: string;
  readonly createdAt: UtcInstant;
};

/** Sealed manifest linking program/run/generation evidence (evaluation records, hashes). */
export type EvolutionEvidenceManifest = {
  readonly manifestId: EvolutionEvidenceManifestId;
  readonly programId: EvolutionProgramId;
  readonly runId: EvolutionRunId;
  readonly generationId: EvolutionGenerationId | null;
  readonly contentHash: string;
  readonly evaluationRecordIds: readonly StrategyEvaluationId[];
  readonly sealedAt: UtcInstant;
};

// ---- EVOL14 (Strategy Genome self-evolution qualification simulation) ----

export type EvolutionTrialOutcome = 'SUCCESS' | 'FAILED';

export type EvolutionPhase =
  | 'SEED'
  | 'POPULATION_INIT'
  | 'POPULATION_SCHEDULING'
  | 'MUTATION_CROSSOVER'
  | 'VALIDATION_REJECT'
  | 'AAF_PIT_DATASET'
  | 'INNER_TRAIN_VAL'
  | 'CMA_ES'
  | 'MAP_ELITES_UPDATE'
  | 'NOVELTY'
  | 'FALSIFICATION'
  | 'FREEZE'
  | 'HOLDOUT_OPEN'
  | 'DSR_PBO'
  | 'CHALLENGER_SELECT'
  | 'FORWARD_SHADOW'
  | 'EXECUTION_TWIN_PAPER'
  | 'CHAMPION_COMPARE'
  | 'RESEARCH_PROMOTION'
  | 'EVIDENCE_SEAL';

export type EvolutionSealedEvidenceEntry = {
  readonly phase: EvolutionPhase;
  readonly trialId: string;
  readonly contentHash: string;
  readonly at: UtcInstant;
};

export type EvolutionTrialRecord = {
  readonly trialId: string;
  readonly phase: EvolutionPhase;
  readonly outcome: EvolutionTrialOutcome;
  readonly genomeId: string | null;
  readonly detail: string;
};

export type StrategyScientistObservation = {
  readonly hypothesisId: string;
  readonly operatorIntelligenceRef: string;
  readonly falsificationTarget: string;
  readonly notes: string;
};

export type EvolvedGenomeCandidate = {
  readonly genome: StrategyGenome;
  readonly lineageParentIds: readonly string[];
  readonly operatorTag: 'MUTATION' | 'CROSSOVER' | 'CMA_ES' | 'SEED';
};

export type MapElitesCell = {
  readonly behaviourA: number;
  readonly behaviourB: number;
  readonly genomeId: string;
  readonly fitnessMinor: bigint;
};

export type NoveltyAssessment = {
  readonly genomeId: string;
  readonly behaviouralDistance: number;
  readonly archiveSize: number;
};

export type FalsificationResult = {
  readonly genomeId: string;
  readonly stressPerturbationBps: number;
  readonly fitnessDeltaMinor: bigint;
  readonly fragile: boolean;
};

export type ChampionChallengerComparison = {
  readonly incumbentGenomeId: string;
  readonly challengerGenomeId: string;
  readonly incumbentRobustnessScore: number;
  readonly challengerRobustnessScore: number;
  readonly preferredGenomeId: string;
  readonly promotionJustified: boolean;
};

export type EvolutionSimulationResult = {
  readonly evaluatedAt: UtcInstant;
  readonly gitSha: string;
  readonly pitSealSample: PointInTimeDatasetManifestSeal;
  readonly seedCount: number;
  readonly populationSize: number;
  readonly invalidGenomesRejected: number;
  readonly mapElitesCells: readonly MapElitesCell[];
  readonly noveltyAssessments: readonly NoveltyAssessment[];
  readonly falsificationResults: readonly FalsificationResult[];
  readonly cmaEsGenerations: number;
  readonly cmaEsMeanVector: readonly number[];
  readonly regimeGateFailures: number;
  readonly holdoutDegradationDetected: boolean;
  readonly overfitCandidateRejected: boolean;
  readonly overfitRejectionReasons: readonly string[];
  readonly moderateCandidatePreferred: boolean;
  readonly antiOverfitting: EvolutionAntiOverfittingDiagnostics;
  readonly championComparison: ChampionChallengerComparison;
  readonly scientistObservation: StrategyScientistObservation;
  readonly trials: readonly EvolutionTrialRecord[];
  readonly sealedEvidenceTrail: readonly EvolutionSealedEvidenceEntry[];
  readonly trialSuccessCount: number;
  readonly trialFailureCount: number;
};
