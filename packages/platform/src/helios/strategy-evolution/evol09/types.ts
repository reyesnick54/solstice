/**
 * HELIOS EVOL09 — evolutionary multiple-testing firewall (types).
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED,
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED,
  HELIOS_EVOL09_SCHEMA,
} from './taxonomy.ts';

export type EvolutionTrialId = string & { readonly __brand: 'EvolutionTrialId' };

/** Origin of a genome evaluation; every evaluation counts as one trial regardless of origin. */
export type GenomeEvaluationOrigin =
  | 'INITIAL'
  | 'MUTATION'
  | 'CROSSOVER'
  | 'PARAMETER_SEARCH'
  | 'CMA_ES_SAMPLE'
  | 'LLM_GENERATED'
  | 'MANUAL'
  | 'FAILED_COMPILE'
  | 'ABORTED';

export type GenomeEvaluationOutcome =
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED';

export type EvolutionTrialRecord = {
  readonly trialId: EvolutionTrialId;
  readonly recordedAt: UtcInstant;
  readonly genomeId: string;
  readonly generation: number;
  readonly origin: GenomeEvaluationOrigin;
  readonly outcome: GenomeEvaluationOutcome;
  readonly strategyFamilyId: string;
  readonly featureFamilyId: string;
  readonly parameterVectorFingerprint: string;
  /** In-sample or research-window returns used for evolution feedback (never the sealed holdout). */
  readonly researchReturns: readonly number[];
  /** Optional behavioral signature for similarity (normalized series or hash-sized vector). */
  readonly behavioralSignature: readonly number[] | null;
};

/**
 * Running counters: every genome evaluation increments totalTrials and the relevant family counters.
 */
export type MultipleTestingState = {
  readonly totalTrials: number;
  readonly strategyFamilyTrials: Readonly<Record<string, number>>;
  readonly featureFamilyTrials: Readonly<Record<string, number>>;
  readonly parameterTrials: number;
  readonly generationCount: number;
  readonly effectiveIndependentTrials: number;
};

export type SelectionBiasAssessment = {
  /** Max absolute correlation among research return series when enough trials exist. */
  readonly maxPairwiseReturnCorrelation: number | null;
  readonly meanPairwiseReturnCorrelation: number | null;
  /** Max absolute correlation among behavioral signatures when present. */
  readonly maxPairwiseBehavioralCorrelation: number | null;
  readonly meanPairwiseBehavioralCorrelation: number | null;
  /** Fraction of trial pairs with genome fingerprints within a small normalized distance. */
  readonly nearDuplicateGenomeRate: number | null;
  /** Ratio of effective independent trials to raw total (0–1]. */
  readonly trialInflationFactor: number;
  readonly meetsMinimumTrackRecord: boolean;
  readonly notes: readonly string[];
};

export type FamilyWiseResearchBudget = {
  readonly maxTrialsPerStrategyFamily: number;
  readonly maxTrialsPerFeatureFamily: number;
  readonly maxParameterTrials: number;
  readonly maxTotalTrials: number;
};

export type FamilyWiseBudgetViolation = {
  readonly kind: 'STRATEGY_FAMILY' | 'FEATURE_FAMILY' | 'PARAMETER' | 'TOTAL';
  readonly limit: number;
  readonly observed: number;
  readonly familyId?: string;
};

export type ResearchFdrConfig = {
  readonly featureScreenIds: readonly string[];
  readonly rawPValues: readonly number[];
  readonly fdrLevel: number;
};

export type ResearchFdrResult = {
  readonly featureScreenIds: readonly string[];
  readonly adjustedPValues: readonly number[];
  readonly rejectedNullHypothesis: readonly boolean[];
  readonly fdrLevel: number;
  readonly applicable: boolean;
};

export type SealedHoldoutVaultState = 'RESEARCH_ACTIVE' | 'FROZEN';

export type SealedHoldoutSegment = {
  readonly segmentId: string;
  readonly reservedForHoldout: true;
};

/**
 * Holdout is inaccessible to the evolutionary engine until the research program is frozen.
 */
export type SealedHoldoutVault = {
  readonly state: SealedHoldoutVaultState;
  readonly segment: SealedHoldoutSegment;
  readonly unsealedHoldoutScore: number | null;
  readonly unsealedHoldoutGradient: readonly number[] | null;
  readonly unsealedHoldoutRejectionReason: string | null;
};

/**
 * Feedback channels available to the evolutionary engine during active research.
 * Holdout score, gradient, and rejection reason must not appear here — use `SealedHoldoutVault` / `unsealHoldoutAfterFreeze`.
 */
export type EvolutionEngineResearchFeedback = {
  readonly fitnessScore: number | null;
  readonly gradientHint: readonly number[] | null;
  readonly rejectionReason: string | null;
};

export type HoldoutRevealAfterFreeze = {
  readonly holdoutScore: number | null;
  readonly holdoutGradient: readonly number[] | null;
  readonly holdoutRejectionReason: string | null;
};

export type StrategyDiscoveryEvidence = {
  readonly schema: typeof HELIOS_EVOL09_SCHEMA;
  readonly qualificationMarker:
    | typeof HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED
    | typeof HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED;
  readonly multipleTesting: MultipleTestingState;
  readonly selectionBias: SelectionBiasAssessment;
  readonly familyBudgetViolations: readonly FamilyWiseBudgetViolation[];
  readonly deflatedSharpeRatio: number | null;
  readonly probabilisticSharpeRatio: number | null;
  readonly probabilityOfBacktestOverfitting: number | null;
  readonly fdrScreen: ResearchFdrResult | null;
  readonly holdoutVault: SealedHoldoutVault;
  readonly holdoutStillSealed: boolean;
};
