import type { UtcInstant } from '@solstice/domain';
import type {
  EarnWorkPackageId,
  EarningsBenchmarkStrategy,
  EarningsRealityGateStatus,
  EarningsRegimeSlice,
} from './taxonomy.ts';
import type { TrialId } from './ids.ts';

export type EarningsIssuerProfile = {
  readonly issuerId: string;
  readonly sector: string;
  readonly marketCapTier: 'LARGE' | 'MID' | 'SMALL';
  readonly analystCoverageScore: number;
  readonly liquidityScore: number;
  readonly volatilityBps: number;
};

export type EarningsCalendarEvent = {
  readonly eventId: string;
  readonly issuerId: string;
  readonly fiscalPeriod: string;
  readonly scheduledAt: UtcInstant;
  readonly reportKnowableAt: UtcInstant;
};

export type EarningsEventGraphNode = {
  readonly nodeId: string;
  readonly eventId: string;
  readonly layer: 'CALENDAR' | 'CONSENSUS' | 'FILING' | 'TRANSCRIPT' | 'OPTIONS' | 'PEER';
  readonly knowableAt: UtcInstant;
};

export type SurpriseTensorCell = {
  readonly metric: 'EPS' | 'REVENUE';
  readonly actualMinor: bigint;
  readonly consensusMinor: bigint;
  readonly surpriseBps: number;
};

export type EarningsForecast = {
  readonly epsMinor: bigint;
  readonly revenueMinor: bigint;
  readonly beatProbabilityBps: number;
  readonly intervalLowEpsMinor: bigint;
  readonly intervalHighEpsMinor: bigint;
};

export type EarningsTrialRecord = {
  readonly trialId: TrialId;
  readonly recordedAt: UtcInstant;
  readonly outcome: 'SUCCESS' | 'FAILURE';
  readonly featureCombination: readonly string[];
  readonly thresholds: Readonly<Record<string, number>>;
  readonly genomeRef: string | null;
  readonly modelRef: string;
  readonly hyperparameters: Readonly<Record<string, number | string | boolean>>;
  readonly failureReason: string | null;
};

export type ForecastMetrics = {
  readonly epsMaeMinor: bigint;
  readonly revenueMaeMinor: bigint;
  readonly directionalAccuracyBps: number;
  readonly beatMissBrier: number;
  readonly logLoss: number;
  readonly calibrationDriftBps: number;
  readonly intervalCoverageBps: number;
};

export type InvestmentResearchMetrics = {
  readonly abnormalReturnRankCorrelation: number;
  readonly residualReturn1dBps: number;
  readonly residualReturn5dBps: number;
  readonly residualReturn20dBps: number;
  readonly maxDrawdownBps: number;
  readonly turnoverBps: number;
  readonly transactionCostBps: number;
  readonly slippageBps: number;
  readonly capacityUtilizationBps: number;
  readonly returnPredictabilitySignificant: boolean;
};

export type AntiOverfittingDiagnostics = {
  readonly deflatedSharpeRatio: number | null;
  readonly probabilityOfBacktestOverfitting: number | null;
  readonly trialCount: number;
  readonly multipleTestingAdjusted: boolean;
  readonly sampleSizePermitsDiagnostics: boolean;
};

export type RegimeSliceReport = {
  readonly slice: EarningsRegimeSlice;
  readonly sliceKey: string;
  readonly eventCount: number;
  readonly forecast: ForecastMetrics;
  readonly investment: InvestmentResearchMetrics;
};

export type BenchmarkComparisonRow = {
  readonly strategy: EarningsBenchmarkStrategy;
  readonly forecast: ForecastMetrics;
  readonly investment: InvestmentResearchMetrics;
};

export type EarningsValidationReport = {
  readonly schema: string;
  readonly generatedAt: UtcInstant;
  readonly gitSha: string;
  readonly chronology: ChronologySummary;
  readonly benchmarks: readonly BenchmarkComparisonRow[];
  readonly heliosVsNaiveEpsMaeImprovementBps: number;
  readonly regimeSlices: readonly RegimeSliceReport[];
  readonly antiOverfitting: AntiOverfittingDiagnostics;
  readonly realityGate: EarningsRealityGateStatus;
  readonly realityGateNotes: readonly string[];
  readonly insignificantAlphaNotPromoted: boolean;
};

export type ChronologySummary = {
  readonly trainEventCount: number;
  readonly validationEventCount: number;
  readonly holdoutEventCount: number;
  readonly walkForwardFoldCount: number;
  readonly embargoViolations: number;
  readonly issuerLeakageViolations: number;
};

export type EarnWorkPackageRow = {
  readonly workPackage: EarnWorkPackageId;
  readonly title: string;
  readonly status: 'QUALIFIED' | 'BLOCKED';
  readonly moduleRef: string;
};

export type EarningsPipelineStageResult = {
  readonly stage: EarnWorkPackageId;
  readonly ok: boolean;
  readonly detail: string;
};

export type EarningsPipelineResult = {
  readonly ok: boolean;
  readonly stages: readonly EarningsPipelineStageResult[];
  readonly forecast: EarningsForecast | null;
  readonly validationReport: EarningsValidationReport | null;
  readonly evidenceRef: string | null;
};
