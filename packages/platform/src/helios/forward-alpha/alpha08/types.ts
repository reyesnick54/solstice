/**
 * HELIOS FORWARD ALPHA08 — forward data-snooping firewall (types).
 */

import type { UtcInstant } from '@solstice/domain';

import type { HELIOS_EVOL09_SCHEMA } from '../../strategy-evolution/evol09/taxonomy.ts';

import type {
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED,
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED,
  HELIOS_ALPHA08_SCHEMA,
} from './taxonomy.ts';

export type ForwardTrialCandidateId = string & { readonly __brand: 'ForwardTrialCandidateId' };
export type ForwardTrialFamilyId = string & { readonly __brand: 'ForwardTrialFamilyId' };

export type ForwardCandidateKind =
  | 'STRATEGY_GENOME'
  | 'VARIANT'
  | 'MUTATION'
  | 'PARAMETER_CANDIDATE'
  | 'FEATURE_COMBINATION'
  | 'CAMPAIGN';

export type ForwardMonitoringOutcome = 'ACTIVE' | 'UNDERPERFORM_BENCHMARK' | 'WITHDRAWN_RESEARCH_ONLY';

/**
 * Family axes carried with every forward-monitored candidate; used for effective trial counting.
 */
export type ForwardTrialFamily = {
  readonly familyId: ForwardTrialFamilyId;
  readonly strategyFamilyId: string;
  readonly signalFamilyId: string;
  readonly assetClassId: string;
  readonly evolutionGeneration: number;
  readonly featureFamilyId: string;
};

export type ForwardTrialCandidate = {
  readonly candidateId: ForwardTrialCandidateId;
  readonly recordedAt: UtcInstant;
  readonly trialFamily: ForwardTrialFamily;
  readonly kind: ForwardCandidateKind;
  readonly genomeId: string;
  readonly parameterVectorFingerprint: string;
  readonly campaignId: string | null;
  /** Forward (out-of-sample) return series versus predeclared benchmark. */
  readonly forwardExcessReturns: readonly number[];
  readonly behavioralSignature: readonly number[] | null;
  /**
   * Cumulative research trials that produced this lineage (EVOL09 ledger).
   * Forward monitoring does not reset this search cost.
   */
  readonly priorCumulativeResearchTrials: number;
  readonly priorEffectiveIndependentResearchTrials: number;
  readonly monitoringOutcome: ForwardMonitoringOutcome;
  /** Losing or inactive candidates remain in the trial universe for audit. */
  readonly retainedInTrialUniverse: true;
};

export type ForwardMultipleTestingState = {
  readonly forwardMonitoredCandidates: number;
  readonly strategyFamilyCounts: Readonly<Record<string, number>>;
  readonly signalFamilyCounts: Readonly<Record<string, number>>;
  readonly assetClassCounts: Readonly<Record<string, number>>;
  readonly featureFamilyCounts: Readonly<Record<string, number>>;
  readonly campaignCount: number;
  readonly priorCumulativeResearchTrials: number;
  readonly priorEffectiveIndependentResearchTrials: number;
  readonly forwardEffectiveIndependentTrials: number;
  /** Combined search cost: prior research + forward monitoring (not erased by forward evidence). */
  readonly combinedEffectiveTrialCount: number;
  readonly evol09Schema: typeof HELIOS_EVOL09_SCHEMA;
};

export type BenchmarkCandidateComparison = {
  readonly candidateId: ForwardTrialCandidateId;
  readonly trialFamilyId: ForwardTrialFamilyId;
  readonly kind: ForwardCandidateKind;
  readonly monitoringOutcome: ForwardMonitoringOutcome;
  readonly meanExcessReturn: number;
  readonly excessSharpe: number | null;
  readonly vsBenchmarkStudentizedT: number | null;
  readonly beatsBenchmarkPointEstimate: boolean;
};

export type RealityCheckResult = {
  readonly test: 'WHITE_REALITY_CHECK';
  readonly bootstrapMethod: 'IID' | 'STATIONARY_BLOCK';
  readonly blockLength: number | null;
  readonly bootstrapReplications: number;
  readonly seed: number;
  readonly observedMaxStudentizedExcess: number;
  readonly pValue: number;
  readonly nullRejectedAt05: boolean;
  readonly allCandidateComparisons: readonly BenchmarkCandidateComparison[];
  /** Explicit best candidate id — reporting must still include full comparison table. */
  readonly argmaxCandidateId: ForwardTrialCandidateId | null;
};

export type SpaResult = {
  readonly test: 'HANSEN_SPA';
  readonly bootstrapMethod: 'IID' | 'STATIONARY_BLOCK';
  readonly blockLength: number | null;
  readonly bootstrapReplications: number;
  readonly seed: number;
  readonly spaStatistic: number;
  readonly pValue: number;
  readonly consistentSuperiorityClaimed: boolean;
  readonly allCandidateComparisons: readonly BenchmarkCandidateComparison[];
  readonly argmaxCandidateId: ForwardTrialCandidateId | null;
};

export type StrategySelectionPenalty = {
  readonly deflatedSharpeRatio: number | null;
  readonly probabilityOfBacktestOverfitting: number | null;
  readonly combinedEffectiveTrialCount: number;
  readonly trialInflationFromCorrelation: number;
  readonly priorResearchTrialCarryover: number;
  readonly selectionPenaltyBps: number;
  readonly notes: readonly string[];
};

export type ForwardDataSnoopingFirewallEvidence = {
  readonly schema: typeof HELIOS_ALPHA08_SCHEMA;
  readonly qualificationMarker:
    | typeof HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED
    | typeof HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED;
  readonly multipleTesting: ForwardMultipleTestingState;
  readonly selectionPenalty: StrategySelectionPenalty;
  readonly realityCheck: RealityCheckResult | null;
  readonly spa: SpaResult | null;
  readonly trialUniverseCandidateIds: readonly ForwardTrialCandidateId[];
  readonly blockers: readonly string[];
};
