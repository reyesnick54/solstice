/**
 * HELIOS EVOL09 — evolutionary multiple-testing firewall.
 */

export {
  HELIOS_EVOL09_SCHEMA,
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED,
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED,
  EVOL09_MINIMUM_TRACK_RECORD_PERIODS,
  EVOL09_MIN_TRIALS_FOR_PBO,
} from './taxonomy.ts';

export type {
  EvolutionTrialId,
  GenomeEvaluationOrigin,
  GenomeEvaluationOutcome,
  EvolutionTrialRecord,
  MultipleTestingState,
  SelectionBiasAssessment,
  FamilyWiseResearchBudget,
  FamilyWiseBudgetViolation,
  ResearchFdrConfig,
  ResearchFdrResult,
  SealedHoldoutVaultState,
  SealedHoldoutSegment,
  SealedHoldoutVault,
  EvolutionEngineResearchFeedback,
  HoldoutRevealAfterFreeze,
  StrategyDiscoveryEvidence,
} from './types.ts';

export { evolutionTrialIdFromFingerprint } from './ids.ts';

export {
  createEvolutionTrialRegistry,
  assertEveryGenomeEvaluationCounts,
  type EvolutionTrialRegistry,
  type EvolutionTrialRegistrySnapshot,
  type RecordEvolutionTrialInput,
} from './trial-registry.ts';

export {
  computeEffectiveIndependentTrials,
  buildMultipleTestingState,
  buildSelectionBiasAssessment,
  computeEvol09DeflatedSharpe,
  computeProbabilisticSharpeRatio,
  computeEvol09Pbo,
  trialSharpeRatiosForPbo,
  benjaminiHochbergFdr,
  maxAndMeanPairwiseReturnCorrelation,
  maxAndMeanPairwiseBehavioralCorrelation,
  nearDuplicateGenomeRate,
} from './stats.ts';

export { evaluateFamilyWiseBudget } from './budget.ts';

export {
  createSealedHoldoutVault,
  freezeResearchProgram,
  unsealHoldoutAfterFreeze,
  scrubHoldoutFromEnginePayload,
} from './holdout.ts';

export { buildStrategyDiscoveryEvidence } from './evidence.ts';

export {
  evaluateEvol09MultipleTestingFirewallQualification,
  type Evol09QualificationResult,
} from './qualification.ts';
