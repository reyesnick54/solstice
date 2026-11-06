import type { UtcInstant } from '@solstice/domain';

import type { EvolutionAntiOverfittingDiagnostics } from './anti-overfitting.ts';
import type { PointInTimeDatasetManifestSeal } from '../evaluation/point-in-time-dataset-seal.ts';
import type { StrategyGenome } from '../os05/types.ts';

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
