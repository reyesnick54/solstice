/**
 * HELIOS EVOL03 — population, lineage, and evolution archive for Strategy Genomes.
 * Append-only research ledger: failed trials are never deleted.
 */

import type { UtcInstant } from '@solstice/domain';
import type { Ratio } from '@solstice/risk';
import type { EvaluationDatasetManifest } from '../evaluation/manifest.ts';
import type { ExtendedEvaluationMetrics } from '../evaluation/types.ts';
import type { StrategyGenomeId } from '../os05/ids.ts';
import type { StrategyGenome } from '../os05/types.ts';
import type { StrategyPromotionState } from '../promotion-state.ts';
import type { TransactionCostAssumptions } from '../types.ts';
import type {
  StrategyEvolutionGenerationId,
  StrategyEvolutionPopulationId,
  StrategyEvolutionTrialId,
  StrategyGeneAttributionId,
} from './ids.ts';

/** Research-stage genetic / search operators (declarative labels only). */
export const EVOLUTION_OPERATORS = [
  'INITIAL',
  'CLONE',
  'MUTATE_PARAMETERS',
  'CROSSOVER',
  'REGIME_SPECIALIZE',
  'GRAPH_EDIT',
  'HUMAN_EDIT',
] as const;

export type EvolutionOperator = (typeof EVOLUTION_OPERATORS)[number];

export type AafCertificateRef = {
  readonly certificateId: string;
  readonly certificateHash: string;
  readonly schemaVersion: string;
};

/**
 * Binding assumptions for OS02 execution twin parity (fixtures / declared posture only).
 */
export type ExecutionTwinAssumptionBundle = {
  readonly twinSchemaVersion: string;
  readonly parityEnvironments: readonly string[];
  readonly capsuleFingerprintUnchangedAcrossEnvironments: boolean;
  readonly grantsExecutionAuthority: false;
  readonly liveFlagsActive: false;
  readonly notes: readonly string[];
};

export type DeflatedSharpeRatioEvidence = {
  readonly method: 'HELIOS_EVOL03_DSR_PLACEHOLDER';
  readonly value: Ratio | null;
  readonly notes: readonly string[];
};

export type ProbabilityOfBacktestOverfittingEvidence = {
  readonly method: 'HELIOS_EVOL03_PBO_PLACEHOLDER';
  readonly value: Ratio | null;
  readonly notes: readonly string[];
};

/** Partition-tagged evaluation metrics (engineering statistics; not return guarantees). */
export type PartitionedEvaluationMetrics = {
  readonly metrics: ExtendedEvaluationMetrics;
  readonly evaluationId: string | null;
};

export type EvolutionTrialOutcomeSlice = {
  /** Inner train/validation partition only — never use holdout metrics during search. */
  readonly innerTrainVal?: PartitionedEvaluationMetrics | null;
  readonly holdout: PartitionedEvaluationMetrics | null;
  readonly walkForward: PartitionedEvaluationMetrics | null;
  readonly shadow: PartitionedEvaluationMetrics | null;
  readonly paper: PartitionedEvaluationMetrics | null;
};

export type EvolutionTrialFailure = {
  readonly codes: readonly string[];
  readonly messages: readonly string[];
};

/**
 * Single evaluated genome instance in the research ledger (includes failed runs).
 */
export type EvolutionTrial = {
  readonly trialId: StrategyEvolutionTrialId;
  readonly genomeId: StrategyGenomeId;
  readonly genomeHash: string;
  readonly parents: readonly StrategyGenomeId[];
  readonly operator: EvolutionOperator;
  readonly generationId: StrategyEvolutionGenerationId;
  readonly populationId: StrategyEvolutionPopulationId | null;
  readonly datasetManifest: Pick<EvaluationDatasetManifest, 'manifestId' | 'hash' | 'version'>;
  readonly aafCertificate: AafCertificateRef;
  readonly evaluation: EvolutionTrialOutcomeSlice;
  readonly transactionCostAssumptions: TransactionCostAssumptions;
  readonly executionTwinAssumptions: ExecutionTwinAssumptionBundle;
  readonly deflatedSharpeRatio: DeflatedSharpeRatioEvidence;
  readonly probabilityOfBacktestOverfitting: ProbabilityOfBacktestOverfittingEvidence;
  readonly failure: EvolutionTrialFailure | null;
  readonly promotionState: StrategyPromotionState;
  readonly createdAt: UtcInstant;
  readonly immutable: true;
};

export type GenerationRecord = {
  readonly generationId: StrategyEvolutionGenerationId;
  readonly ordinal: number;
  readonly populationId: StrategyEvolutionPopulationId | null;
  readonly parentGenerationIds: readonly StrategyEvolutionGenerationId[];
  readonly trialIds: readonly StrategyEvolutionTrialId[];
  readonly createdAt: UtcInstant;
};

export type GenomeAncestry = {
  readonly genomeId: StrategyGenomeId;
  readonly roots: readonly StrategyGenomeId[];
  readonly depth: number;
};

export type ParentSimilarityAssessment = {
  readonly parentA: StrategyGenomeId;
  readonly parentB: StrategyGenomeId;
  readonly jaccardNodeSimilarity: Ratio;
  readonly parameterKeyOverlap: Ratio;
  readonly combinedSimilarity: Ratio;
  readonly nearIdenticalParents: boolean;
};

export type LineageDiversityMetrics = {
  readonly populationId: StrategyEvolutionPopulationId | null;
  readonly genomeCount: number;
  readonly meanPairwiseCombinedDissimilarity: Ratio;
};

/**
 * Genetic memory: reusable component hypothesis from a failed or weak genome.
 * Causality is not inferred — controlled tests are required before promotion.
 */
export type StrategyGeneAttribution = {
  readonly attributionId: StrategyGeneAttributionId;
  readonly sourceGenomeId: StrategyGenomeId;
  readonly sourceTrialId: StrategyEvolutionTrialId;
  readonly componentKind: string;
  readonly componentRef: string;
  readonly notes: string;
  readonly causalityClaim: 'NONE_WITHOUT_CONTROLLED_TEST';
  readonly createdAt: UtcInstant;
};

export type GenomeFitnessEvidence = {
  readonly genomeId: StrategyGenomeId;
  readonly trialIds: readonly StrategyEvolutionTrialId[];
  readonly bestTrialId: StrategyEvolutionTrialId | null;
};
