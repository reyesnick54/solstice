/**
 * AAF06 — coverage-bias sentinel domain types (deterministic diagnostics only).
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const COVERAGE_BIAS_SEVERITIES = [
  'PASS',
  'WARNING',
  'SEVERE',
  'INSUFFICIENT_DATA',
] as const;
export type CoverageBiasSeverity = (typeof COVERAGE_BIAS_SEVERITIES)[number];

export const COVERAGE_BIAS_FACTORS = [
  'OVERALL_COVERAGE',
  'MARKET_CAPITALIZATION',
  'LIQUIDITY',
  'VOLATILITY',
  'SECTOR',
  'GEOGRAPHY',
  'LISTING_AGE',
  'HISTORICAL_RETURN',
  'ASSET_CLASS',
  'MISSINGNESS_CORRELATION',
] as const;
export type CoverageBiasFactor = (typeof COVERAGE_BIAS_FACTORS)[number];

export const UNIVERSE_CHARACTERISTIC_FIELDS = [
  'marketCapMinor',
  'liquidityScore',
  'volatilityBps',
  'sector',
  'geography',
  'listingAgeDays',
  'historicalReturnBps',
  'assetClass',
] as const;
export type UniverseCharacteristicField = (typeof UNIVERSE_CHARACTERISTIC_FIELDS)[number];

export type UniverseEntityCharacteristics = {
  readonly entityId: string;
  readonly marketCapMinor: bigint | null;
  readonly liquidityScore: number | null;
  readonly volatilityBps: number | null;
  readonly sector: string | null;
  readonly geography: string | null;
  readonly listingAgeDays: number | null;
  readonly historicalReturnBps: number | null;
  readonly assetClass: string | null;
};

export type CoverageBiasMetricKind =
  | 'COVERAGE_RATE_DELTA'
  | 'STANDARDIZED_MEAN_DIFFERENCE'
  | 'CATEGORICAL_TOTAL_VARIATION'
  | 'BUCKET_COVERAGE_DELTA'
  | 'MISSINGNESS_POINT_BISERIAL';

export type CoverageBiasEvidence = {
  readonly evidenceId: string;
  readonly factor: CoverageBiasFactor;
  readonly metricKind: CoverageBiasMetricKind;
  readonly fullUniverseValue: string;
  readonly coveredUniverseValue: string;
  readonly magnitude: number;
  readonly severity: CoverageBiasSeverity;
  readonly bucketLabel: string | null;
  readonly diagnosticNote: string;
  readonly correlationIsNotCausation: true;
};

export type CoverageBiasAssessment = {
  readonly assessmentId: string;
  readonly researchDatasetId: string;
  readonly evaluatedAt: UtcInstant;
  readonly eligibleUniverseCount: number;
  readonly featureCoveredCount: number;
  readonly overallCoverageRate: number;
  readonly severity: CoverageBiasSeverity;
  readonly factors: readonly CoverageBiasFactor[];
  readonly evidence: readonly CoverageBiasEvidence[];
  readonly grantsExecutionAuthority: false;
};

export type CoverageBiasAssessmentInput = {
  readonly assessmentId: string;
  readonly researchDatasetId: string;
  readonly evaluatedAt: UtcInstant;
  readonly eligibleUniverse: readonly UniverseEntityCharacteristics[];
  readonly featureCoveredEntityIds: readonly string[];
};
