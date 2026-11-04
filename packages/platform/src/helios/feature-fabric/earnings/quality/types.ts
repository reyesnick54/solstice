import type { UtcInstant } from '../../../../../../domain/src/time.ts';
import {
  EARN06_QUALITY_FEATURE_IDS,
  type Earn06ComparisonBasis,
  type Earn06ForensicSignalClass,
  type Earn06QualityFeatureId,
  type HELIOS_EARN06_EARNINGS_QUALITY_SCHEMA,
} from './taxonomy.ts';

export type Earn06FeatureQuality = 'VALID' | 'DEGRADED_MISSING_INPUT' | 'UNAVAILABLE';

export type Earn06QuarterFinancials = {
  readonly fiscalPeriod: string;
  readonly periodEnd: string;
  readonly knowableAt: UtcInstant;
  readonly revenueMinor: bigint | null;
  readonly netIncomeMinor: bigint | null;
  readonly operatingIncomeMinor: bigint | null;
  readonly grossProfitMinor: bigint | null;
  readonly operatingCashFlowMinor: bigint | null;
  readonly freeCashFlowMinor: bigint | null;
  readonly accountsReceivableMinor: bigint | null;
  readonly inventoryMinor: bigint | null;
  readonly deferredRevenueMinor: bigint | null;
  readonly workingCapitalMinor: bigint | null;
  readonly shareCountScaled: bigint | null;
  readonly dilutedEpsMinor: bigint | null;
  readonly effectiveTaxRateBps: bigint | null;
  readonly capexMinor: bigint | null;
  readonly capitalizedCostsMinor: bigint | null;
  readonly nonGaapAdjustmentsMinor: bigint | null;
  readonly oneTimeItemsMinor: bigint | null;
  readonly sbcMinor: bigint | null;
  readonly buybackSpendMinor: bigint | null;
  readonly evidenceRefs: readonly string[];
};

export type Earn06ManagementGuidance = {
  readonly metricId: string;
  readonly valueMinor: bigint;
  readonly knowableAt: UtcInstant;
  readonly fiscalPeriod: string;
  readonly evidenceRef: string | null;
};

export type Earn06ComputedFeature = {
  readonly featureId: Earn06QualityFeatureId;
  readonly formulaVersion: string;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly knowableAt: UtcInstant;
  readonly quality: Earn06FeatureQuality;
  readonly observationRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type Earn06ScorecardInterpretation = 'FAVORABLE' | 'NEUTRAL' | 'UNFAVORABLE' | 'UNAVAILABLE';

export type EarningsQualityScorecardDimension = {
  readonly dimensionId: string;
  readonly label: string;
  readonly featureId: Earn06QualityFeatureId;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly interpretation: Earn06ScorecardInterpretation;
  readonly quality: Earn06FeatureQuality;
};

/** Separate dimensions only — no opaque composite score. */
export type EarningsQualityScorecard = {
  readonly schema: typeof HELIOS_EARN06_EARNINGS_QUALITY_SCHEMA;
  readonly canonicalEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly fiscalPeriod: string;
  readonly dimensions: readonly EarningsQualityScorecardDimension[];
  readonly grantsExecutionAuthority: false;
};

export type ForensicHypothesis = {
  readonly hypothesisId: string;
  readonly signalClass: Earn06ForensicSignalClass;
  readonly comparisonBasis: Earn06ComparisonBasis;
  readonly summary: string;
  readonly detail: string;
  readonly relatedFeatureIds: readonly Earn06QualityFeatureId[];
  readonly evidenceRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type ForensicChangeDetectorResult = {
  readonly evaluationTime: UtcInstant;
  readonly fiscalPeriod: string;
  readonly formulaVersion: string;
  readonly hypotheses: readonly ForensicHypothesis[];
  readonly grantsExecutionAuthority: false;
};

export type Earn06QualityFeaturePlane = {
  readonly evaluationTime: UtcInstant;
  readonly canonicalEntityId: string;
  readonly fiscalPeriod: string;
  readonly features: readonly Earn06ComputedFeature[];
  readonly scorecard: EarningsQualityScorecard;
  readonly forensic: ForensicChangeDetectorResult;
  readonly grantsExecutionAuthority: false;
};

export type ForensicAccountingResearchChallenge = {
  readonly target: 'BULLISH' | 'BEARISH';
  readonly prompt: string;
  readonly linkedHypothesisIds: readonly string[];
};

export type ForensicAccountingResearchBrief = {
  readonly agentName: typeof import('./taxonomy.ts').FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly evaluationTime: UtcInstant;
  readonly scorecardPeriod: string;
  readonly challenges: readonly ForensicAccountingResearchChallenge[];
  readonly openResearchQuestions: readonly string[];
  readonly grantsExecutionAuthority: false;
  readonly issuesOrders: false;
};

export type Earn06QuarterHistory = {
  readonly current: Earn06QuarterFinancials;
  readonly previousQuarter: Earn06QuarterFinancials | null;
  readonly sameQuarterPriorYear: Earn06QuarterFinancials | null;
  readonly trailingFourQuarters: readonly Earn06QuarterFinancials[];
  readonly guidance: Earn06ManagementGuidance | null;
};

export const EARN06_SCORECARD_DIMENSION_LABELS: Readonly<Record<Earn06QualityFeatureId, string>> = Object.freeze(
  Object.fromEntries(
    EARN06_QUALITY_FEATURE_IDS.map((id) => {
      const label = id
        .replace('earn06.', '')
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      return [id, label];
    }),
  ) as Record<Earn06QualityFeatureId, string>,
);
