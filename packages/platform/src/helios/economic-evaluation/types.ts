import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  BenchmarkKind,
  ChallengeTrack,
  CostLabel,
  EvaluationMode,
  ExperimentState,
  IntelligenceBaseline,
  ResearchCostSource,
  RunOutcome,
} from './taxonomy.ts';
import type {
  HeliosEvaluationRunId,
  HeliosExperimentId,
  HeliosMicrocapitalChallengeId,
} from './ids.ts';

export type EvaluationMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type RiskLimitSpec = {
  readonly maxLeverageNumerator: number;
  readonly maxLeverageDenominator: number;
  readonly maxConcentrationBps: number;
  readonly allowedAssetClasses: readonly string[];
  readonly maxDrawdownBps: number;
  readonly complianceProfile: string;
};

export type ExecutionAssumptionSpec = {
  readonly mode: EvaluationMode;
  readonly spreadBps: number;
  readonly slippageBps: number;
  readonly commissionMinorPerTrade: string;
  readonly fundingCostBpsAnnual: number;
  readonly dataCostMinor: string;
};

export type ExperimentSuccessCriteria = {
  readonly minNetResultMinor: string | null;
  readonly maxDrawdownBps: number | null;
  readonly beatBenchmarkBps: number | null;
  readonly minDecisions: number | null;
};

export type FrozenExperimentSpec = {
  readonly schema: 'sunrey.helios.economic-experiment.v1';
  readonly experimentId: HeliosExperimentId;
  readonly hypothesis: string;
  readonly strategyCapsuleId: string | null;
  readonly modelVersions: readonly string[];
  readonly policyVersions: readonly string[];
  readonly datasetRef: string;
  readonly forwardPeriod: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly capital: EvaluationMoney;
  readonly researchBudget: EvaluationMoney;
  readonly riskLimits: RiskLimitSpec;
  readonly executionAssumptions: ExecutionAssumptionSpec;
  readonly benchmark: { readonly kind: BenchmarkKind; readonly methodology: string };
  readonly costTreatment: string;
  readonly successCriteria: ExperimentSuccessCriteria;
  readonly failureCriteria: readonly string[];
  readonly frozenAt: UtcInstant;
  readonly frozenHash: string;
  readonly state: ExperimentState;
  readonly customerId: CustomerId;
  readonly microcapitalChallengeId: HeliosMicrocapitalChallengeId | null;
};

export type LatencyPercentiles = {
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly sampleCount: number;
};

export type ContinuousCoverageMetrics = {
  readonly approvedInstrumentsMonitored: number;
  readonly approvedSourcesMonitored: number;
  readonly marketSessionsCovered: number;
  readonly outageDurationMs: number;
  readonly coverageGapCount: number;
  readonly coverageGapMs: number;
};

export type DiscoveryLatencyMetrics = {
  readonly sourceArrivalToDetection: LatencyPercentiles;
  readonly detectionToEvidenceVerification: LatencyPercentiles;
  readonly verificationToCandidate: LatencyPercentiles;
};

export type DecisionLatencyMetrics = {
  readonly candidateToResearch: LatencyPercentiles;
  readonly researchToDecisionValidity: LatencyPercentiles;
  readonly decisionValidityToRisk: LatencyPercentiles;
  readonly riskToExecutableProposal: LatencyPercentiles;
};

export type ExecutionQualityMetrics = {
  readonly submissionToAcknowledgement: LatencyPercentiles;
  readonly acknowledgementToFill: LatencyPercentiles;
  readonly averageSpreadBps: number;
  readonly averageSlippageBps: number;
  readonly adverseSelectionBps: number;
  readonly completionRateBps: number;
  readonly rejectionRateBps: number;
};

export type NetEconomicsBreakdown = {
  readonly grossResult: EvaluationMoney;
  readonly commissions: EvaluationMoney;
  readonly spreadCost: EvaluationMoney;
  readonly slippageCost: EvaluationMoney;
  readonly fundingCost: EvaluationMoney;
  readonly dataCost: EvaluationMoney;
  readonly researchCost: EvaluationMoney;
  readonly netResult: EvaluationMoney;
  readonly realizableNetValue: EvaluationMoney;
};

export type CapitalEfficiencyMetrics = {
  readonly deployedCapital: EvaluationMoney;
  readonly idleCash: EvaluationMoney;
  readonly reservedCash: EvaluationMoney;
  readonly maxDrawdownBps: number;
  readonly concentrationBps: number;
  readonly turnoverBps: number;
  readonly liquidityRatioBps: number;
};

export type ResearchCostLine = {
  readonly source: ResearchCostSource;
  readonly label: CostLabel;
  readonly amount: EvaluationMoney;
  readonly reference: string;
};

export type BenchmarkComparison = {
  readonly benchmarkKind: BenchmarkKind;
  readonly benchmarkNetResult: EvaluationMoney;
  readonly subjectNetResult: EvaluationMoney;
  readonly excessNetResult: EvaluationMoney;
  readonly methodology: string;
};

export type IntelligenceComparisonRow = {
  readonly baseline: IntelligenceBaseline;
  readonly researchBudget: EvaluationMoney;
  readonly netResult: EvaluationMoney;
  readonly decisionCount: number;
  readonly budgetNormalized: true;
};

export type CalibrationBin = {
  readonly predictedConfidenceBps: number;
  readonly predictedCount: number;
  readonly observedSuccessCount: number;
  readonly observedFrequencyBps: number;
};

export type NoActionEvaluation = {
  readonly candidatesRejected: number;
  readonly observedLaterResultMinor: string | null;
  readonly opportunityCostMinor: string;
  readonly countedAsRealizedProfit: false;
};

export type HiddenCapitalFinding = {
  readonly detected: boolean;
  readonly kind: 'ADDITIONAL_DEPOSIT' | 'SECRET_SUBSIDY' | 'UNREPORTED_CREDIT' | 'TOKEN_MARKUP' | 'SIMULATED_INTERNAL_VALUE' | null;
  readonly amount: EvaluationMoney | null;
  readonly message: string;
};

export type EvaluationRunRecord = {
  readonly runId: HeliosEvaluationRunId;
  readonly experimentId: HeliosExperimentId;
  readonly customerId: CustomerId;
  readonly track: ChallengeTrack | null;
  readonly startedAt: UtcInstant;
  readonly endedAt: UtcInstant | null;
  readonly outcome: RunOutcome;
  readonly startCapital: EvaluationMoney;
  readonly endingCapital: EvaluationMoney;
  readonly maxDrawdownBps: number;
  readonly grossResult: EvaluationMoney;
  readonly netResult: EvaluationMoney;
  readonly realizableNetValue: EvaluationMoney;
  readonly researchCost: EvaluationMoney;
  readonly fees: EvaluationMoney;
  readonly failedStrategies: readonly string[];
  readonly outageMs: number;
  readonly noActionPeriodMs: number;
  readonly liquidationReason: string | null;
  readonly limitations: readonly string[];
  readonly decisionCount: number;
  readonly tradeCount: number;
  readonly hiddenCapitalFindings: readonly HiddenCapitalFinding[];
  readonly principalDepositsExcludedFromGrowth: true;
  readonly deleted: false;
};

export type MicrocapitalChallengeSpec = {
  readonly schema: 'sunrey.helios.microcapital-challenge.v1';
  readonly challengeId: HeliosMicrocapitalChallengeId;
  readonly experimentId: HeliosExperimentId;
  readonly startingCapital: EvaluationMoney;
  readonly targetCapital: EvaluationMoney;
  readonly targetIsExperimentOnly: true;
  readonly notGuaranteed: true;
  readonly notCustomerFacing: true;
  readonly horizonDays: number;
  readonly riskLimits: RiskLimitSpec;
  readonly benchmark: { readonly kind: BenchmarkKind; readonly methodology: string };
  readonly allowedStrategyClasses: readonly string[];
  readonly allowedEconomicActivities: readonly string[];
  readonly researchBudget: EvaluationMoney;
  readonly operationalSubsidyMinor: string;
  readonly costSchedule: readonly ResearchCostLine[];
  readonly stopConditions: readonly string[];
  readonly trackARules: readonly string[];
  readonly trackBRules: readonly string[];
  readonly catchUpModeForbidden: true;
  readonly frozenAt: UtcInstant;
};

export type TrackBEconomicActivity = {
  readonly activityId: string;
  readonly revenueReceived: EvaluationMoney;
  readonly directDeliveryCost: EvaluationMoney;
  readonly platformCost: EvaluationMoney;
  readonly researchCost: EvaluationMoney;
  readonly netEconomicValue: EvaluationMoney;
  readonly labeledAsInvestmentPnl: false;
};

export type StatisticalSummary = {
  readonly runCount: number;
  readonly decisionCount: number;
  readonly tradeCount: number;
  readonly meanNetResultMinor: string;
  readonly medianNetResultMinor: string;
  readonly bestNetResultMinor: string;
  readonly worstNetResultMinor: string;
  readonly varianceMinorSquared: string;
  readonly maxDrawdownBps: number;
  readonly smallSampleWarning: boolean;
  readonly minimumSampleForSignificance: number;
};

export type EconomicEvaluationReport = {
  readonly schema: 'sunrey.helios.economic-evaluation-report.v1';
  readonly reportId: string;
  readonly generatedAt: UtcInstant;
  readonly experiment: FrozenExperimentSpec;
  readonly microcapitalChallenge: MicrocapitalChallengeSpec | null;
  readonly runs: readonly EvaluationRunRecord[];
  readonly coverage: ContinuousCoverageMetrics;
  readonly discoveryLatency: DiscoveryLatencyMetrics;
  readonly decisionLatency: DecisionLatencyMetrics;
  readonly executionQuality: ExecutionQualityMetrics;
  readonly netEconomics: NetEconomicsBreakdown;
  readonly capitalEfficiency: CapitalEfficiencyMetrics;
  readonly researchCosts: readonly ResearchCostLine[];
  readonly benchmarkComparison: BenchmarkComparison;
  readonly intelligenceComparison: readonly IntelligenceComparisonRow[];
  readonly calibration: readonly CalibrationBin[];
  readonly noActionEvaluation: NoActionEvaluation;
  readonly trackBActivities: readonly TrackBEconomicActivity[];
  readonly statisticalSummary: StatisticalSummary;
  readonly failurePeriods: readonly { readonly start: UtcInstant; readonly end: UtcInstant; readonly reason: string }[];
  readonly limitations: readonly string[];
  readonly PERFORMANCE_CLAIM_ALLOWED: false;
};

export type EvaluationRunInput = {
  readonly experimentId: HeliosExperimentId;
  readonly customerId: CustomerId;
  readonly track?: ChallengeTrack | null;
  readonly startCapital: EvaluationMoney;
  readonly grossResultMinor: string;
  readonly commissionsMinor: string;
  readonly spreadCostMinor: string;
  readonly slippageCostMinor: string;
  readonly fundingCostMinor: string;
  readonly dataCostMinor: string;
  readonly researchCostMinor: string;
  readonly unrealizedMinor: string;
  readonly realizedMinor: string;
  readonly cashMinor: string;
  readonly maxDrawdownBps: number;
  readonly failedStrategies?: readonly string[];
  readonly outageMs?: number;
  readonly noActionPeriodMs?: number;
  readonly decisionCount?: number;
  readonly tradeCount?: number;
  readonly outcome?: RunOutcome;
  readonly liquidationReason?: string | null;
  readonly limitations?: readonly string[];
  readonly depositsDuringRun?: readonly EvaluationMoney[];
  readonly hiddenCapitalEvents?: readonly HiddenCapitalFinding[];
};
