/**
 * AAFV2.5 — statistical coverage and research bias sentinel (deterministic only).
 */

import type { UtcInstant } from '@solstice/domain';

export const BIAS_SENTINEL_SCHEMA = 'sunrey.helios.bias-sentinel.v2_5' as const;

export const BIAS_SEVERITIES = ['PASS', 'WARNING', 'SEVERE', 'INSUFFICIENT_DATA'] as const;
export type BiasSeverity = (typeof BIAS_SEVERITIES)[number];

export const BIAS_DIMENSIONS = [
  'COVERAGE_BIAS',
  'SURVIVORSHIP_BIAS',
  'LARGE_CAP_BIAS',
  'SMALL_CAP_BIAS',
  'SECTOR_BIAS',
  'INDUSTRY_BIAS',
  'GEOGRAPHIC_BIAS',
  'JURISDICTION_BIAS',
  'VENUE_BIAS',
  'PROVIDER_BIAS',
  'LIQUIDITY_BIAS',
  'VOLATILITY_BIAS',
  'HISTORY_LENGTH_BIAS',
  'ASSET_AGE_BIAS',
  'DELISTING_BIAS',
  'CORPORATE_ACTION_BIAS',
  'FEATURE_COVERAGE_BIAS',
  'HISTORICAL_RETURN_BIAS',
  'ASSET_CLASS_BIAS',
  'TRAIN_HOLDOUT_DRIFT',
  'MISSINGNESS_CORRELATION',
] as const;
export type BiasDimension = (typeof BIAS_DIMENSIONS)[number];

export const BIAS_METRIC_KINDS = [
  'COVERAGE_RATE_DELTA',
  'STANDARDIZED_MEAN_DIFFERENCE',
  'CATEGORICAL_TOTAL_VARIATION',
  'BUCKET_COVERAGE_DELTA',
  'DISTRIBUTION_DIVERGENCE',
  'MISSINGNESS_POINT_BISERIAL',
  'CONDITIONAL_MISSINGNESS_RATE',
  'TIME_WINDOW_STABILITY',
  'TRAIN_HOLDOUT_DELTA',
  'SURVIVORSHIP_ABSENCE_RATE',
  'PROVIDER_CONCENTRATION_DELTA',
  'DELISTING_OMISSION_RATE',
  'CORPORATE_ACTION_OMISSION_RATE',
] as const;
export type BiasMetricKind = (typeof BIAS_METRIC_KINDS)[number];

export const UNIVERSE_COMPARISON_MODES = [
  'INTENDED_ELIGIBLE_UNIVERSE',
  'OBSERVED_USABLE_UNIVERSE',
] as const;
export type UniverseComparisonMode = (typeof UNIVERSE_COMPARISON_MODES)[number];

export type UniverseMemberProfile = {
  readonly canonicalEntityId: string;
  readonly marketCapMinor: bigint | null;
  readonly liquidityScore: number | null;
  readonly volatilityBps: number | null;
  readonly sector: string | null;
  readonly industry: string | null;
  readonly geography: string | null;
  readonly jurisdiction: string | null;
  readonly venue: string | null;
  readonly assetClass: string | null;
  readonly listingAgeDays: number | null;
  readonly assetAgeDays: number | null;
  readonly historicalReturnBps: number | null;
  readonly primaryProviderId: string | null;
  readonly featureCoverageRateBps: number | null;
  readonly delisted: boolean;
  readonly delistedBeforeEvaluation: boolean;
  readonly hadCorporateActionInWindow: boolean;
};

export type UniverseComparison = {
  readonly mode: UniverseComparisonMode;
  readonly memberCount: number;
  readonly memberIds: readonly string[];
};

export type BiasEvidence = {
  readonly evidenceId: string;
  readonly dimension: BiasDimension;
  readonly metricKind: BiasMetricKind;
  readonly intendedValue: string;
  readonly observedValue: string;
  readonly magnitude: number;
  readonly severity: BiasSeverity;
  readonly bucketLabel: string | null;
  readonly diagnosticNote: string;
  readonly correlationIsNotCausation: true;
};

export type BiasFinding = {
  readonly findingId: string;
  readonly dimension: BiasDimension;
  readonly severity: BiasSeverity;
  readonly summary: string;
  readonly evidence: readonly BiasEvidence[];
};

export type CoverageBiasAssessment = {
  readonly intendedCount: number;
  readonly observedCount: number;
  readonly coverageRate: number;
  readonly severity: BiasSeverity;
};

export type SurvivorshipAssessment = {
  readonly deadOrDelistedInIntended: number;
  readonly absentFromObserved: number;
  readonly survivorshipAbsenceRate: number;
  readonly severity: BiasSeverity;
  readonly delistedEntityIds: readonly string[];
};

export type ProviderBiasAssessment = {
  readonly providerSharesIntended: Readonly<Record<string, number>>;
  readonly providerSharesObserved: Readonly<Record<string, number>>;
  readonly concentrationDelta: number;
  readonly severity: BiasSeverity;
};

export type MissingnessModelDiagnostic = {
  readonly modelId: string;
  readonly sufficientObservations: boolean;
  readonly conditionalMissingRates: Readonly<Record<string, number>>;
  readonly note: string;
};

export type BiasAssessment = {
  readonly schemaVersion: typeof BIAS_SENTINEL_SCHEMA;
  readonly assessmentId: string;
  readonly strategyGenomeRef: string | null;
  readonly researchDatasetId: string;
  readonly pointInTimeManifestId: string | null;
  readonly coverageTensorDigest: string | null;
  readonly evaluatedAt: UtcInstant;
  readonly intendedUniverse: UniverseComparison;
  readonly observedUniverse: UniverseComparison;
  readonly severity: BiasSeverity;
  readonly findings: readonly BiasFinding[];
  readonly coverageBias: CoverageBiasAssessment;
  readonly survivorship: SurvivorshipAssessment;
  readonly providerBias: ProviderBiasAssessment;
  readonly missingnessModel: MissingnessModelDiagnostic | null;
  readonly grantsExecutionAuthority: false;
};

export type BiasAssessmentInput = {
  readonly assessmentId: string;
  readonly strategyGenomeRef?: string | null;
  readonly researchDatasetId: string;
  readonly pointInTimeManifestId?: string | null;
  readonly coverageTensorDigest?: string | null;
  readonly evaluatedAt: UtcInstant;
  readonly intendedEligibleUniverse: readonly UniverseMemberProfile[];
  readonly observedUsableEntityIds: readonly string[];
  readonly trainEntityIds?: readonly string[];
  readonly holdoutEntityIds?: readonly string[];
};

export type BiasPromotionDecision = 'CONTINUE' | 'REVIEW_REQUIRED' | 'BLOCK_PROMOTION';

export type BiasPromotionPolicy = {
  readonly policyId: string;
  readonly severeDecision: BiasPromotionDecision;
  readonly warningDecision: BiasPromotionDecision;
  readonly insufficientDataDecision: BiasPromotionDecision;
};

export type BiasPromotionGateResult = {
  readonly decision: BiasPromotionDecision;
  readonly permitted: boolean;
  readonly blockers: readonly string[];
  readonly assessmentSeverity: BiasSeverity;
};
