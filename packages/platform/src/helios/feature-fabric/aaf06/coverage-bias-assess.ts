import { createHash } from 'node:crypto';

import type {
  CoverageBiasAssessment,
  CoverageBiasAssessmentInput,
  CoverageBiasEvidence,
  CoverageBiasFactor,
  CoverageBiasSeverity,
  UniverseCharacteristicField,
  UniverseEntityCharacteristics,
} from './coverage-bias-types.ts';
import {
  BUCKET_COVERAGE_DELTA_SEVERE,
  BUCKET_COVERAGE_DELTA_WARNING,
  COVERAGE_BIAS_MIN_ELIGIBLE_UNIVERSE,
  COVERAGE_BIAS_MIN_FEATURE_COVERED,
  COVERAGE_GAP_SEVERE_THRESHOLD,
  COVERAGE_GAP_WARNING_THRESHOLD,
  MISSINGNESS_CORR_SEVERE_THRESHOLD,
  MISSINGNESS_CORR_WARNING_THRESHOLD,
  SMD_SEVERE_THRESHOLD,
  SMD_WARNING_THRESHOLD,
  TVD_SEVERE_THRESHOLD,
  TVD_WARNING_THRESHOLD,
  combineSeverities,
  severityFromMagnitude,
} from './coverage-bias-thresholds.ts';
import {
  categoricalDistribution,
  mean,
  numericTertileCutoffs,
  pointBiserialCorrelation,
  quantileBucketLabel,
  standardizedMeanDifference,
  totalVariationDistance,
} from './coverage-bias-statistics.ts';

const NUMERIC_FIELDS: readonly {
  readonly field: UniverseCharacteristicField;
  readonly factor: CoverageBiasFactor;
}[] = Object.freeze([
  { field: 'marketCapMinor', factor: 'MARKET_CAPITALIZATION' },
  { field: 'liquidityScore', factor: 'LIQUIDITY' },
  { field: 'volatilityBps', factor: 'VOLATILITY' },
  { field: 'listingAgeDays', factor: 'LISTING_AGE' },
  { field: 'historicalReturnBps', factor: 'HISTORICAL_RETURN' },
]);

const CATEGORICAL_FIELDS: readonly {
  readonly field: UniverseCharacteristicField;
  readonly factor: CoverageBiasFactor;
}[] = Object.freeze([
  { field: 'sector', factor: 'SECTOR' },
  { field: 'geography', factor: 'GEOGRAPHY' },
  { field: 'assetClass', factor: 'ASSET_CLASS' },
]);

function evidenceId(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

function numericFromEntity(
  entity: UniverseEntityCharacteristics,
  field: UniverseCharacteristicField,
): number | null {
  switch (field) {
    case 'marketCapMinor':
      return entity.marketCapMinor === null ? null : Number(entity.marketCapMinor);
    case 'liquidityScore':
      return entity.liquidityScore;
    case 'volatilityBps':
      return entity.volatilityBps;
    case 'listingAgeDays':
      return entity.listingAgeDays;
    case 'historicalReturnBps':
      return entity.historicalReturnBps;
    default:
      return null;
  }
}

function categoricalFromEntity(
  entity: UniverseEntityCharacteristics,
  field: UniverseCharacteristicField,
): string | null {
  switch (field) {
    case 'sector':
      return entity.sector;
    case 'geography':
      return entity.geography;
    case 'assetClass':
      return entity.assetClass;
    default:
      return null;
  }
}

function buildEvidence(input: {
  readonly factor: CoverageBiasFactor;
  readonly metricKind: CoverageBiasEvidence['metricKind'];
  readonly fullUniverseValue: string;
  readonly coveredUniverseValue: string;
  readonly magnitude: number;
  readonly severity: CoverageBiasSeverity;
  readonly bucketLabel: string | null;
  readonly diagnosticNote: string;
}): CoverageBiasEvidence {
  return Object.freeze({
    evidenceId: evidenceId([
      input.factor,
      input.metricKind,
      input.bucketLabel ?? '',
      input.fullUniverseValue,
      input.coveredUniverseValue,
    ]),
    factor: input.factor,
    metricKind: input.metricKind,
    fullUniverseValue: input.fullUniverseValue,
    coveredUniverseValue: input.coveredUniverseValue,
    magnitude: input.magnitude,
    severity: input.severity,
    bucketLabel: input.bucketLabel,
    diagnosticNote: input.diagnosticNote,
    correlationIsNotCausation: true,
  });
}

function assessNumericField(
  eligible: readonly UniverseEntityCharacteristics[],
  coveredSet: ReadonlySet<string>,
  field: UniverseCharacteristicField,
  factor: CoverageBiasFactor,
): { readonly evidence: CoverageBiasEvidence[]; readonly severity: CoverageBiasSeverity } {
  const fullValues: number[] = [];
  const coveredValues: number[] = [];
  for (const entity of eligible) {
    const value = numericFromEntity(entity, field);
    if (value === null || !Number.isFinite(value)) {
      continue;
    }
    fullValues.push(value);
    if (coveredSet.has(entity.entityId)) {
      coveredValues.push(value);
    }
  }
  if (fullValues.length < 5 || coveredValues.length < 3) {
    return { evidence: [], severity: 'PASS' };
  }
  const smd = standardizedMeanDifference(fullValues, coveredValues) ?? 0;
  const severity = severityFromMagnitude(smd, SMD_WARNING_THRESHOLD, SMD_SEVERE_THRESHOLD);
  const evidence = [
    buildEvidence({
      factor,
      metricKind: 'STANDARDIZED_MEAN_DIFFERENCE',
      fullUniverseValue: String(mean(fullValues) ?? 0),
      coveredUniverseValue: String(mean(coveredValues) ?? 0),
      magnitude: smd,
      severity,
      bucketLabel: null,
      diagnosticNote:
        'Standardized mean difference between feature-covered and full eligible universes; descriptive only.',
    }),
  ];

  const cutoffs = numericTertileCutoffs(fullValues);
  const bucketEvidence: CoverageBiasEvidence[] = [];
  const bucketSeverities: CoverageBiasSeverity[] = [];
  if (cutoffs) {
    for (const bucket of ['LOW', 'MID', 'HIGH'] as const) {
      const fullInBucket = eligible.filter((entity) => {
        const value = numericFromEntity(entity, field);
        return value !== null && quantileBucketLabel(value, cutoffs) === bucket;
      });
      if (fullInBucket.length === 0) {
        continue;
      }
      const coveredInBucket = fullInBucket.filter((entity) => coveredSet.has(entity.entityId));
      const fullRate = fullInBucket.length / eligible.length;
      const coveredRate = coveredInBucket.length / Math.max(1, coveredSet.size);
      const delta = coveredRate - fullRate;
      const bucketSeverity = severityFromMagnitude(
        delta,
        BUCKET_COVERAGE_DELTA_WARNING,
        BUCKET_COVERAGE_DELTA_SEVERE,
      );
      bucketSeverities.push(bucketSeverity);
      bucketEvidence.push(
        buildEvidence({
          factor,
          metricKind: 'BUCKET_COVERAGE_DELTA',
          fullUniverseValue: fullRate.toFixed(4),
          coveredUniverseValue: coveredRate.toFixed(4),
          magnitude: delta,
          severity: bucketSeverity,
          bucketLabel: bucket,
          diagnosticNote: 'Coverage rate delta within numeric tertile bucket.',
        }),
      );
    }
  }

  return {
    evidence: [...evidence, ...bucketEvidence],
    severity: combineSeverities([severity, ...bucketSeverities]),
  };
}

function assessCategoricalField(
  eligible: readonly UniverseEntityCharacteristics[],
  coveredSet: ReadonlySet<string>,
  field: UniverseCharacteristicField,
  factor: CoverageBiasFactor,
): { readonly evidence: CoverageBiasEvidence[]; readonly severity: CoverageBiasSeverity } {
  const fullLabels: string[] = [];
  const coveredLabels: string[] = [];
  for (const entity of eligible) {
    const label = categoricalFromEntity(entity, field);
    if (!label) {
      continue;
    }
    fullLabels.push(label);
    if (coveredSet.has(entity.entityId)) {
      coveredLabels.push(label);
    }
  }
  if (fullLabels.length < 5 || coveredLabels.length < 3) {
    return { evidence: [], severity: 'PASS' };
  }
  const tvd = totalVariationDistance(
    categoricalDistribution(fullLabels),
    categoricalDistribution(coveredLabels),
  );
  const severity = severityFromMagnitude(tvd, TVD_WARNING_THRESHOLD, TVD_SEVERE_THRESHOLD);
  const evidence: CoverageBiasEvidence[] = [
    buildEvidence({
      factor,
      metricKind: 'CATEGORICAL_TOTAL_VARIATION',
      fullUniverseValue: JSON.stringify([...categoricalDistribution(fullLabels).entries()]),
      coveredUniverseValue: JSON.stringify([...categoricalDistribution(coveredLabels).entries()]),
      magnitude: tvd,
      severity,
      bucketLabel: null,
      diagnosticNote: 'Total variation distance between categorical distributions.',
    }),
  ];

  const bucketSeverities: CoverageBiasSeverity[] = [];
  const categories = new Set(fullLabels);
  for (const category of categories) {
    const fullInBucket = eligible.filter((entity) => categoricalFromEntity(entity, field) === category);
    const coveredInBucket = fullInBucket.filter((entity) => coveredSet.has(entity.entityId));
    const fullRate = fullInBucket.length / eligible.length;
    const coveredRate = coveredInBucket.length / Math.max(1, coveredSet.size);
    const delta = coveredRate - fullRate;
    const bucketSeverity = severityFromMagnitude(
      delta,
      BUCKET_COVERAGE_DELTA_WARNING,
      BUCKET_COVERAGE_DELTA_SEVERE,
    );
    bucketSeverities.push(bucketSeverity);
    evidence.push(
      buildEvidence({
        factor,
        metricKind: 'BUCKET_COVERAGE_DELTA',
        fullUniverseValue: fullRate.toFixed(4),
        coveredUniverseValue: coveredRate.toFixed(4),
        magnitude: delta,
        severity: bucketSeverity,
        bucketLabel: category,
        diagnosticNote: 'Coverage rate delta within categorical bucket.',
      }),
    );
  }

  return { evidence, severity: combineSeverities([severity, ...bucketSeverities]) };
}

function assessMissingnessCorrelation(
  eligible: readonly UniverseEntityCharacteristics[],
  coveredSet: ReadonlySet<string>,
): { readonly evidence: CoverageBiasEvidence[]; readonly severity: CoverageBiasSeverity } {
  const missingIndicators: number[] = [];
  const marketCaps: number[] = [];
  for (const entity of eligible) {
    if (entity.marketCapMinor === null) {
      continue;
    }
    missingIndicators.push(coveredSet.has(entity.entityId) ? 0 : 1);
    marketCaps.push(Number(entity.marketCapMinor));
  }
  const correlation = pointBiserialCorrelation(missingIndicators, marketCaps);
  if (correlation === null) {
    return { evidence: [], severity: 'PASS' };
  }
  const severity = severityFromMagnitude(
    correlation,
    MISSINGNESS_CORR_WARNING_THRESHOLD,
    MISSINGNESS_CORR_SEVERE_THRESHOLD,
  );
  return {
    evidence: [
      buildEvidence({
        factor: 'MISSINGNESS_CORRELATION',
        metricKind: 'MISSINGNESS_POINT_BISERIAL',
        fullUniverseValue: 'feature_missing=1|present=0',
        coveredUniverseValue: String(correlation),
        magnitude: correlation,
        severity,
        bucketLabel: 'marketCapMinor',
        diagnosticNote:
          'Point-biserial correlation between feature missingness and market capitalization; association is not causal.',
      }),
    ],
    severity,
  };
}

export function assessCoverageBias(input: CoverageBiasAssessmentInput): CoverageBiasAssessment {
  const eligible = input.eligibleUniverse;
  const coveredSet = new Set(input.featureCoveredEntityIds);
  const eligibleCount = eligible.length;
  const coveredCount = eligible.filter((row) => coveredSet.has(row.entityId)).length;

  if (
    eligibleCount < COVERAGE_BIAS_MIN_ELIGIBLE_UNIVERSE ||
    coveredCount < COVERAGE_BIAS_MIN_FEATURE_COVERED
  ) {
    return Object.freeze({
      assessmentId: input.assessmentId,
      researchDatasetId: input.researchDatasetId,
      evaluatedAt: input.evaluatedAt,
      eligibleUniverseCount: eligibleCount,
      featureCoveredCount: coveredCount,
      overallCoverageRate: eligibleCount === 0 ? 0 : coveredCount / eligibleCount,
      severity: 'INSUFFICIENT_DATA',
      factors: Object.freeze(['OVERALL_COVERAGE']),
      evidence: Object.freeze([]),
      grantsExecutionAuthority: false,
    });
  }

  const overallCoverageRate = coveredCount / eligibleCount;
  const coverageGap = 1 - overallCoverageRate;
  const overallSeverity = severityFromMagnitude(
    coverageGap,
    COVERAGE_GAP_WARNING_THRESHOLD,
    COVERAGE_GAP_SEVERE_THRESHOLD,
  );

  const evidence: CoverageBiasEvidence[] = [
    buildEvidence({
      factor: 'OVERALL_COVERAGE',
      metricKind: 'COVERAGE_RATE_DELTA',
      fullUniverseValue: '1.0000',
      coveredUniverseValue: overallCoverageRate.toFixed(4),
      magnitude: coverageGap,
      severity: overallSeverity,
      bucketLabel: null,
      diagnosticNote: 'Difference between full eligible universe and feature-covered subset.',
    }),
  ];
  const severities: CoverageBiasSeverity[] = [overallSeverity];
  const factors: CoverageBiasFactor[] = ['OVERALL_COVERAGE'];

  for (const { field, factor } of NUMERIC_FIELDS) {
    const result = assessNumericField(eligible, coveredSet, field, factor);
    if (result.evidence.length > 0) {
      evidence.push(...result.evidence);
      severities.push(result.severity);
      factors.push(factor);
    }
  }

  for (const { field, factor } of CATEGORICAL_FIELDS) {
    const result = assessCategoricalField(eligible, coveredSet, field, factor);
    if (result.evidence.length > 0) {
      evidence.push(...result.evidence);
      severities.push(result.severity);
      factors.push(factor);
    }
  }

  const missingness = assessMissingnessCorrelation(eligible, coveredSet);
  if (missingness.evidence.length > 0) {
    evidence.push(...missingness.evidence);
    severities.push(missingness.severity);
    factors.push('MISSINGNESS_CORRELATION');
  }

  return Object.freeze({
    assessmentId: input.assessmentId,
    researchDatasetId: input.researchDatasetId,
    evaluatedAt: input.evaluatedAt,
    eligibleUniverseCount: eligibleCount,
    featureCoveredCount: coveredCount,
    overallCoverageRate,
    severity: combineSeverities(severities),
    factors: Object.freeze([...new Set(factors)]),
    evidence: Object.freeze(evidence),
    grantsExecutionAuthority: false,
  });
}
