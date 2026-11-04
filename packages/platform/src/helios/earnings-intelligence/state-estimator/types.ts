/**
 * HELIOS EARN09 — probabilistic earnings state types.
 * Return-path outputs are model inference only, never canonical facts.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  EarningsEstimateTarget,
  EarningsExpertKind,
  EarningsGatingVariable,
  EarningsKnowledgeLayer,
  HELIOS_EARNINGS_STATE_ESTIMATOR_AUTHORITY,
  HELIOS_EARNINGS_STATE_ESTIMATOR_SCHEMA,
} from './taxonomy.ts';

export type EarningsRegimeLabel = string;
export type EarningsSectorLabel = string;

/** Context variables that gate expert influence in the mixture. */
export type EarningsGatingContext = {
  readonly sector: EarningsSectorLabel;
  readonly marketCapTier: 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO';
  readonly liquidityScore: number;
  readonly earningsRegime: EarningsRegimeLabel;
  readonly macroRegime: EarningsRegimeLabel;
  readonly dataCoverage: number;
  readonly forecastDispersion: number;
  readonly optionsAvailable: boolean;
};

export type EarningsExpertSignal = {
  readonly expertKind: EarningsExpertKind;
  readonly estimate: number;
  readonly uncertainty: number;
  readonly dataQuality: number;
  readonly historicalCalibration: number;
  readonly applicableRegime: readonly EarningsRegimeLabel[];
  /** Primary targets this expert informs (mixture may still borrow strength across targets). */
  readonly primaryTargets: readonly EarningsEstimateTarget[];
  readonly evaluatedAt: UtcInstant;
};

export type StudentTDistribution = {
  readonly kind: 'student_t';
  readonly mean: number;
  readonly scale: number;
  readonly degreesOfFreedom: number;
};

export type ConformalInterval = {
  readonly lower: number;
  readonly upper: number;
  readonly coverageLevel: number;
  readonly temporallyValidAsOf: UtcInstant;
  readonly disclaimer: 'NOT_GUARANTEED_UNDER_REGIME_SHIFT';
};

export type NumericalForecastDistribution = {
  readonly pointEstimate: string;
  readonly studentT: StudentTDistribution;
  readonly conformalInterval: ConformalInterval | null;
};

export type ProbabilityForecast = {
  readonly probability: number;
  readonly uncertainty: number;
};

export type ReturnForecastDistribution = {
  readonly knowledgeLayer: Extract<EarningsKnowledgeLayer, 'model_inference' | 'agent_hypothesis'>;
  readonly researchOnly: true;
  readonly notAFact: true;
  readonly studentT: StudentTDistribution;
  readonly conformalInterval: ConformalInterval | null;
};

export type NextQuarterEPSDistribution = NumericalForecastDistribution;
export type NextQuarterRevenueDistribution = NumericalForecastDistribution;

export type EarningsEvidenceContribution = {
  readonly expertKind: EarningsExpertKind;
  readonly diagnosticMethod: 'leave_one_source_out';
  readonly epsDelta: string | null;
  readonly revenueDelta: string | null;
  readonly beatProbabilityDelta: number | null;
  readonly weightShare: number;
  readonly nonCausalDisclaimer: 'NOT_A_CAUSAL_ATTRIBUTION';
};

export type EarningsCalibrationSnapshot = {
  readonly brierScore: number | null;
  readonly logLoss: number | null;
  readonly mae: number | null;
  readonly medianAbsoluteError: number | null;
  readonly crps: number | null;
  readonly expectedCalibrationError: number | null;
  readonly intervalCoverage: number | null;
  readonly sampleCount: number;
};

export type ProbabilisticEarningsState = {
  readonly schema: typeof HELIOS_EARNINGS_STATE_ESTIMATOR_SCHEMA;
  readonly authority: typeof HELIOS_EARNINGS_STATE_ESTIMATOR_AUTHORITY;
  readonly instrumentId: string;
  readonly fiscalPeriodKey: string;
  readonly asOf: UtcInstant;
  readonly gatingContext: EarningsGatingContext;
  readonly gatingVariablesUsed: readonly EarningsGatingVariable[];
  readonly nextQuarterEps: NextQuarterEPSDistribution;
  readonly nextQuarterRevenue: NextQuarterRevenueDistribution;
  readonly beatProbability: ProbabilityForecast;
  readonly missProbability: ProbabilityForecast;
  readonly revenueBeatProbability: ProbabilityForecast;
  readonly guidanceRaiseProbability: ProbabilityForecast;
  readonly guidanceCutProbability: ProbabilityForecast;
  readonly marginExpansionProbability: ProbabilityForecast;
  readonly earningsQualityRiskProbability: ProbabilityForecast;
  readonly announcementReturnDistribution: ReturnForecastDistribution | null;
  readonly postEventResidualReturnDistribution: ReturnForecastDistribution | null;
  readonly evidenceContributions: readonly EarningsEvidenceContribution[];
  readonly calibration: EarningsCalibrationSnapshot;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

export type EarningsOutcomeRecord = {
  readonly instrumentId: string;
  readonly fiscalPeriodKey: string;
  readonly outcomeKnownAt: UtcInstant;
  readonly actualEps: string;
  readonly actualRevenue: string;
  readonly beatConsensus: boolean;
  readonly revenueBeat: boolean;
  readonly guidanceRaised: boolean | null;
  readonly guidanceCut: boolean | null;
  readonly marginExpanded: boolean | null;
  readonly qualityRiskRealized: boolean | null;
  readonly announcementReturn: number | null;
  readonly postEventResidualReturn: number | null;
};

export type ExpertReliabilityRecord = {
  readonly expertKind: EarningsExpertKind;
  readonly ewmaBrier: number;
  readonly ewmaMae: number;
  readonly bayesianAlpha: number;
  readonly bayesianBeta: number;
  readonly sampleCount: number;
  readonly lastUpdatedAt: UtcInstant | null;
};

export type ConformalResidualRecord = {
  readonly target: EarningsEstimateTarget;
  readonly fiscalPeriodKey: string;
  readonly outcomeKnownAt: UtcInstant;
  readonly absoluteError: number;
  readonly scaledError: number;
};

export type EarningsStateEstimatorStoreSnapshot = {
  readonly reliabilityByExpert: Readonly<Record<EarningsExpertKind, ExpertReliabilityRecord>>;
  readonly conformalResiduals: readonly ConformalResidualRecord[];
  readonly calibrationHistory: readonly EarningsCalibrationSnapshot[];
};

export type EstimateProbabilisticEarningsStateInput = {
  readonly instrumentId: string;
  readonly fiscalPeriodKey: string;
  readonly asOf: UtcInstant;
  readonly gating: EarningsGatingContext;
  readonly expertSignals: readonly EarningsExpertSignal[];
  readonly includeResearchReturnDistributions?: boolean;
};

export type ApplyEarningsOutcomeInput = {
  readonly outcome: EarningsOutcomeRecord;
  readonly appliedAt: UtcInstant;
  readonly priorState: ProbabilisticEarningsState;
  readonly expertSignalsAtDecision: readonly EarningsExpertSignal[];
};
