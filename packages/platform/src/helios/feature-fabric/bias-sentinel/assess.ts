import { createHash } from 'node:crypto';

import { diagnoseMissingnessModel } from './missingness-model.ts';
import {
  categoricalDistribution,
  mean,
  numericTertileCutoffs,
  pointBiserialCorrelation,
  providerConcentrationDelta,
  providerShareDistribution,
  quantileBucketLabel,
  standardizedMeanDifference,
  totalVariationDistance,
} from './statistics.ts';
import {
  BIAS_MIN_INTENDED_UNIVERSE,
  BIAS_MIN_OBSERVED_USABLE,
  BUCKET_COVERAGE_DELTA_SEVERE,
  BUCKET_COVERAGE_DELTA_WARNING,
  COVERAGE_GAP_SEVERE_THRESHOLD,
  COVERAGE_GAP_WARNING_THRESHOLD,
  DELISTING_OMISSION_SEVERE,
  DELISTING_OMISSION_WARNING,
  MISSINGNESS_CORR_SEVERE_THRESHOLD,
  MISSINGNESS_CORR_WARNING_THRESHOLD,
  PROVIDER_CONCENTRATION_DELTA_SEVERE,
  PROVIDER_CONCENTRATION_DELTA_WARNING,
  SMD_SEVERE_THRESHOLD,
  SMD_WARNING_THRESHOLD,
  SURVIVORSHIP_ABSENCE_SEVERE,
  SURVIVORSHIP_ABSENCE_WARNING,
  TRAIN_HOLDOUT_DELTA_SEVERE,
  TRAIN_HOLDOUT_DELTA_WARNING,
  TVD_SEVERE_THRESHOLD,
  TVD_WARNING_THRESHOLD,
  combineSeverities,
  severityFromMagnitude,
} from './thresholds.ts';
import type {
  BiasAssessment,
  BiasAssessmentInput,
  BiasDimension,
  BiasEvidence,
  BiasFinding,
  BiasSeverity,
  CoverageBiasAssessment,
  ProviderBiasAssessment,
  SurvivorshipAssessment,
  UniverseMemberProfile,
} from './types.ts';
import { BIAS_SENTINEL_SCHEMA } from './types.ts';

function evidenceId(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

function findingId(dimension: BiasDimension, assessmentId: string): string {
  return evidenceId([assessmentId, dimension]);
}

function buildEvidence(input: {
  readonly dimension: BiasDimension;
  readonly metricKind: BiasEvidence['metricKind'];
  readonly intendedValue: string;
  readonly observedValue: string;
  readonly magnitude: number;
  readonly severity: BiasSeverity;
  readonly bucketLabel: string | null;
  readonly diagnosticNote: string;
}): BiasEvidence {
  return Object.freeze({
    evidenceId: evidenceId([
      input.dimension,
      input.metricKind,
      input.bucketLabel ?? '',
      input.intendedValue,
      input.observedValue,
    ]),
    dimension: input.dimension,
    metricKind: input.metricKind,
    intendedValue: input.intendedValue,
    observedValue: input.observedValue,
    magnitude: input.magnitude,
    severity: input.severity,
    bucketLabel: input.bucketLabel,
    diagnosticNote: input.diagnosticNote,
    correlationIsNotCausation: true,
  });
}

function buildFinding(
  assessmentId: string,
  dimension: BiasDimension,
  evidence: readonly BiasEvidence[],
  summary: string,
): BiasFinding | null {
  if (evidence.length === 0) {
    return null;
  }
  const severity = combineSeverities(evidence.map((row) => row.severity));
  if (severity === 'PASS') {
    return null;
  }
  return Object.freeze({
    findingId: findingId(dimension, assessmentId),
    dimension,
    severity,
    summary,
    evidence: Object.freeze(evidence),
  });
}

type NumericFieldSpec = {
  readonly read: (member: UniverseMemberProfile) => number | null;
  readonly dimension: BiasDimension;
  readonly largeCapDimension?: BiasDimension;
  readonly smallCapDimension?: BiasDimension;
};

const NUMERIC_SPECS: readonly NumericFieldSpec[] = Object.freeze([
  {
    read: (m) => (m.marketCapMinor === null ? null : Number(m.marketCapMinor)),
    dimension: 'LARGE_CAP_BIAS',
    largeCapDimension: 'LARGE_CAP_BIAS',
    smallCapDimension: 'SMALL_CAP_BIAS',
  },
  { read: (m) => m.liquidityScore, dimension: 'LIQUIDITY_BIAS' },
  { read: (m) => m.volatilityBps, dimension: 'VOLATILITY_BIAS' },
  { read: (m) => m.listingAgeDays, dimension: 'HISTORY_LENGTH_BIAS' },
  { read: (m) => m.assetAgeDays, dimension: 'ASSET_AGE_BIAS' },
  { read: (m) => m.historicalReturnBps, dimension: 'HISTORICAL_RETURN_BIAS' },
  { read: (m) => (m.featureCoverageRateBps === null ? null : m.featureCoverageRateBps), dimension: 'FEATURE_COVERAGE_BIAS' },
]);

const CATEGORICAL_SPECS = Object.freeze([
  { read: (m: UniverseMemberProfile) => m.sector, dimension: 'SECTOR_BIAS' as const },
  { read: (m: UniverseMemberProfile) => m.industry, dimension: 'INDUSTRY_BIAS' as const },
  { read: (m: UniverseMemberProfile) => m.geography, dimension: 'GEOGRAPHIC_BIAS' as const },
  { read: (m: UniverseMemberProfile) => m.jurisdiction, dimension: 'JURISDICTION_BIAS' as const },
  { read: (m: UniverseMemberProfile) => m.venue, dimension: 'VENUE_BIAS' as const },
  { read: (m: UniverseMemberProfile) => m.assetClass, dimension: 'ASSET_CLASS_BIAS' as const },
]);

function assessNumericField(
  intended: readonly UniverseMemberProfile[],
  observedSet: ReadonlySet<string>,
  spec: NumericFieldSpec,
): BiasEvidence[] {
  const fullValues: number[] = [];
  const observedValues: number[] = [];
  for (const member of intended) {
    const value = spec.read(member);
    if (value === null || !Number.isFinite(value)) {
      continue;
    }
    fullValues.push(value);
    if (observedSet.has(member.canonicalEntityId)) {
      observedValues.push(value);
    }
  }
  if (fullValues.length < 5 || observedValues.length < 3) {
    return [];
  }
  const smd = standardizedMeanDifference(fullValues, observedValues) ?? 0;
  let dimension = spec.dimension;
  if (spec.largeCapDimension && spec.smallCapDimension) {
    dimension = smd >= 0 ? spec.largeCapDimension : spec.smallCapDimension;
  }
  const severity = severityFromMagnitude(smd, SMD_WARNING_THRESHOLD, SMD_SEVERE_THRESHOLD);
  const evidence: BiasEvidence[] = [
    buildEvidence({
      dimension,
      metricKind: 'STANDARDIZED_MEAN_DIFFERENCE',
      intendedValue: String(mean(fullValues) ?? 0),
      observedValue: String(mean(observedValues) ?? 0),
      magnitude: smd,
      severity,
      bucketLabel: null,
      diagnosticNote:
        'Standardized mean difference between intended eligible and observed usable universes.',
    }),
  ];

  const cutoffs = numericTertileCutoffs(fullValues);
  if (cutoffs) {
    for (const bucket of ['LOW', 'MID', 'HIGH'] as const) {
      const inBucket = intended.filter((member) => {
        const value = spec.read(member);
        return value !== null && quantileBucketLabel(value, cutoffs) === bucket;
      });
      if (inBucket.length === 0) {
        continue;
      }
      const observedInBucket = inBucket.filter((member) => observedSet.has(member.canonicalEntityId));
      const intendedRate = inBucket.length / intended.length;
      const observedRate = observedInBucket.length / Math.max(1, observedSet.size);
      const delta = observedRate - intendedRate;
      evidence.push(
        buildEvidence({
          dimension,
          metricKind: 'BUCKET_COVERAGE_DELTA',
          intendedValue: intendedRate.toFixed(4),
          observedValue: observedRate.toFixed(4),
          magnitude: delta,
          severity: severityFromMagnitude(
            delta,
            BUCKET_COVERAGE_DELTA_WARNING,
            BUCKET_COVERAGE_DELTA_SEVERE,
          ),
          bucketLabel: bucket,
          diagnosticNote: 'Usable-universe rate delta within numeric tertile bucket.',
        }),
      );
    }
  }
  return evidence;
}

function assessCategoricalField(
  intended: readonly UniverseMemberProfile[],
  observedSet: ReadonlySet<string>,
  read: (member: UniverseMemberProfile) => string | null,
  dimension: BiasDimension,
): BiasEvidence[] {
  const intendedLabels: string[] = [];
  const observedLabels: string[] = [];
  for (const member of intended) {
    const label = read(member);
    if (!label) {
      continue;
    }
    intendedLabels.push(label);
    if (observedSet.has(member.canonicalEntityId)) {
      observedLabels.push(label);
    }
  }
  if (intendedLabels.length < 5 || observedLabels.length < 3) {
    return [];
  }
  const tvd = totalVariationDistance(
    categoricalDistribution(intendedLabels),
    categoricalDistribution(observedLabels),
  );
  const evidence: BiasEvidence[] = [
    buildEvidence({
      dimension,
      metricKind: 'CATEGORICAL_TOTAL_VARIATION',
      intendedValue: JSON.stringify([...categoricalDistribution(intendedLabels).entries()]),
      observedValue: JSON.stringify([...categoricalDistribution(observedLabels).entries()]),
      magnitude: tvd,
      severity: severityFromMagnitude(tvd, TVD_WARNING_THRESHOLD, TVD_SEVERE_THRESHOLD),
      bucketLabel: null,
      diagnosticNote: 'Total variation distance between categorical distributions.',
    }),
  ];
  const categories = new Set(intendedLabels);
  for (const category of categories) {
    const inBucket = intended.filter((member) => read(member) === category);
    const observedInBucket = inBucket.filter((member) => observedSet.has(member.canonicalEntityId));
    const intendedRate = inBucket.length / intended.length;
    const observedRate = observedInBucket.length / Math.max(1, observedSet.size);
    const delta = observedRate - intendedRate;
    evidence.push(
      buildEvidence({
        dimension,
        metricKind: 'BUCKET_COVERAGE_DELTA',
        intendedValue: intendedRate.toFixed(4),
        observedValue: observedRate.toFixed(4),
        magnitude: delta,
        severity: severityFromMagnitude(
          delta,
          BUCKET_COVERAGE_DELTA_WARNING,
          BUCKET_COVERAGE_DELTA_SEVERE,
        ),
        bucketLabel: category,
        diagnosticNote: 'Usable-universe rate delta within categorical bucket.',
      }),
    );
  }
  return evidence;
}

function assessMissingnessCorrelations(
  intended: readonly UniverseMemberProfile[],
  observedSet: ReadonlySet<string>,
): BiasEvidence[] {
  const evidence: BiasEvidence[] = [];
  const pairs: readonly {
    readonly label: string;
    readonly values: (member: UniverseMemberProfile) => number | null;
  }[] = [
    { label: 'marketCapMinor', values: (m) => (m.marketCapMinor === null ? null : Number(m.marketCapMinor)) },
    { label: 'liquidityScore', values: (m) => m.liquidityScore },
    { label: 'volatilityBps', values: (m) => m.volatilityBps },
  ];
  for (const pair of pairs) {
    const missingIndicators: number[] = [];
    const characteristics: number[] = [];
    for (const member of intended) {
      const value = pair.values(member);
      if (value === null || !Number.isFinite(value)) {
        continue;
      }
      missingIndicators.push(observedSet.has(member.canonicalEntityId) ? 0 : 1);
      characteristics.push(value);
    }
    const correlation = pointBiserialCorrelation(missingIndicators, characteristics);
    if (correlation === null) {
      continue;
    }
    evidence.push(
      buildEvidence({
        dimension: 'MISSINGNESS_CORRELATION',
        metricKind: 'MISSINGNESS_POINT_BISERIAL',
        intendedValue: 'missing=1|usable=0',
        observedValue: String(correlation),
        magnitude: correlation,
        severity: severityFromMagnitude(
          correlation,
          MISSINGNESS_CORR_WARNING_THRESHOLD,
          MISSINGNESS_CORR_SEVERE_THRESHOLD,
        ),
        bucketLabel: pair.label,
        diagnosticNote:
          'Point-biserial correlation between unusable membership and characteristic; not causal.',
      }),
    );
  }
  return evidence;
}

function assessSurvivorshipAndDelisting(
  intended: readonly UniverseMemberProfile[],
  observedSet: ReadonlySet<string>,
): { readonly survivorship: SurvivorshipAssessment; readonly evidence: BiasEvidence[] } {
  const deadOrDelisted = intended.filter(
    (member) => member.delisted || member.delistedBeforeEvaluation,
  );
  const absent = deadOrDelisted.filter((member) => !observedSet.has(member.canonicalEntityId));
  const rate =
    deadOrDelisted.length === 0 ? 0 : absent.length / Math.max(1, deadOrDelisted.length);
  const severity = severityFromMagnitude(
    rate,
    SURVIVORSHIP_ABSENCE_WARNING,
    SURVIVORSHIP_ABSENCE_SEVERE,
  );
  const delistedIds = absent.map((member) => member.canonicalEntityId);
  const evidence: BiasEvidence[] = [];
  if (deadOrDelisted.length > 0) {
    evidence.push(
      buildEvidence({
        dimension: 'SURVIVORSHIP_BIAS',
        metricKind: 'SURVIVORSHIP_ABSENCE_RATE',
        intendedValue: String(deadOrDelisted.length),
        observedValue: String(absent.length),
        magnitude: rate,
        severity,
        bucketLabel: null,
        diagnosticNote:
          'Share of delisted/dead intended entities absent from observed usable universe.',
      }),
    );
  }
  const delistedOnly = intended.filter((member) => member.delistedBeforeEvaluation);
  const delistedAbsent = delistedOnly.filter((member) => !observedSet.has(member.canonicalEntityId));
  const delistingRate =
    delistedOnly.length === 0 ? 0 : delistedAbsent.length / delistedOnly.length;
  if (delistedOnly.length > 0) {
    evidence.push(
      buildEvidence({
        dimension: 'DELISTING_BIAS',
        metricKind: 'DELISTING_OMISSION_RATE',
        intendedValue: String(delistedOnly.length),
        observedValue: String(delistedAbsent.length),
        magnitude: delistingRate,
        severity: severityFromMagnitude(
          delistingRate,
          DELISTING_OMISSION_WARNING,
          DELISTING_OMISSION_SEVERE,
        ),
        bucketLabel: null,
        diagnosticNote: 'Delisted-before-evaluation entities omitted from usable universe.',
      }),
    );
  }
  const corpAction = intended.filter((member) => member.hadCorporateActionInWindow);
  const corpAbsent = corpAction.filter((member) => !observedSet.has(member.canonicalEntityId));
  const corpRate = corpAction.length === 0 ? 0 : corpAbsent.length / corpAction.length;
  if (corpAction.length > 0) {
    evidence.push(
      buildEvidence({
        dimension: 'CORPORATE_ACTION_BIAS',
        metricKind: 'CORPORATE_ACTION_OMISSION_RATE',
        intendedValue: String(corpAction.length),
        observedValue: String(corpAbsent.length),
        magnitude: corpRate,
        severity: severityFromMagnitude(corpRate, DELISTING_OMISSION_WARNING, DELISTING_OMISSION_SEVERE),
        bucketLabel: null,
        diagnosticNote: 'Corporate-action entities disproportionately absent from usable universe.',
      }),
    );
  }
  return {
    survivorship: Object.freeze({
      deadOrDelistedInIntended: deadOrDelisted.length,
      absentFromObserved: absent.length,
      survivorshipAbsenceRate: rate,
      severity,
      delistedEntityIds: Object.freeze(delistedIds),
    }),
    evidence,
  };
}

function assessProviderBias(
  intended: readonly UniverseMemberProfile[],
  observedMembers: readonly UniverseMemberProfile[],
): { readonly providerBias: ProviderBiasAssessment; readonly evidence: BiasEvidence[] } {
  const intendedShares = providerShareDistribution(intended);
  const observedShares = providerShareDistribution(observedMembers);
  const delta = providerConcentrationDelta(intendedShares, observedShares);
  const severity = severityFromMagnitude(
    delta,
    PROVIDER_CONCENTRATION_DELTA_WARNING,
    PROVIDER_CONCENTRATION_DELTA_SEVERE,
  );
  return {
    providerBias: Object.freeze({
      providerSharesIntended: intendedShares,
      providerSharesObserved: observedShares,
      concentrationDelta: delta,
      severity,
    }),
    evidence: [
      buildEvidence({
        dimension: 'PROVIDER_BIAS',
        metricKind: 'PROVIDER_CONCENTRATION_DELTA',
        intendedValue: JSON.stringify(intendedShares),
        observedValue: JSON.stringify(observedShares),
        magnitude: delta,
        severity,
        bucketLabel: null,
        diagnosticNote: 'Provider share divergence between intended and observed universes.',
      }),
    ],
  };
}

function assessTrainHoldoutDrift(
  intended: readonly UniverseMemberProfile[],
  observedSet: ReadonlySet<string>,
  trainIds: readonly string[] | undefined,
  holdoutIds: readonly string[] | undefined,
): BiasEvidence[] {
  if (!trainIds?.length || !holdoutIds?.length) {
    return [];
  }
  const trainSet = new Set(trainIds);
  const holdoutSet = new Set(holdoutIds);
  const trainObserved = intended.filter(
    (member) => trainSet.has(member.canonicalEntityId) && observedSet.has(member.canonicalEntityId),
  ).length;
  const holdoutObserved = intended.filter(
    (member) => holdoutSet.has(member.canonicalEntityId) && observedSet.has(member.canonicalEntityId),
  ).length;
  const trainRate = trainObserved / Math.max(1, trainIds.length);
  const holdoutRate = holdoutObserved / Math.max(1, holdoutIds.length);
  const delta = trainRate - holdoutRate;
  return [
    buildEvidence({
      dimension: 'TRAIN_HOLDOUT_DRIFT',
      metricKind: 'TRAIN_HOLDOUT_DELTA',
      intendedValue: trainRate.toFixed(4),
      observedValue: holdoutRate.toFixed(4),
      magnitude: delta,
      severity: severityFromMagnitude(
        delta,
        TRAIN_HOLDOUT_DELTA_WARNING,
        TRAIN_HOLDOUT_DELTA_SEVERE,
      ),
      bucketLabel: 'usable_coverage_rate',
      diagnosticNote: 'Train vs holdout usable coverage rate difference.',
    }),
  ];
}

export function assessResearchBias(input: BiasAssessmentInput): BiasAssessment {
  const intended = input.intendedEligibleUniverse;
  const observedSet = new Set(input.observedUsableEntityIds);
  const observedMembers = intended.filter((member) => observedSet.has(member.canonicalEntityId));
  const intendedCount = intended.length;
  const observedCount = observedMembers.length;

  const insufficient =
    intendedCount < BIAS_MIN_INTENDED_UNIVERSE || observedCount < BIAS_MIN_OBSERVED_USABLE;

  if (insufficient) {
    return Object.freeze({
      schemaVersion: BIAS_SENTINEL_SCHEMA,
      assessmentId: input.assessmentId,
      strategyGenomeRef: input.strategyGenomeRef ?? null,
      researchDatasetId: input.researchDatasetId,
      pointInTimeManifestId: input.pointInTimeManifestId ?? null,
      coverageTensorDigest: input.coverageTensorDigest ?? null,
      evaluatedAt: input.evaluatedAt,
      intendedUniverse: Object.freeze({
        mode: 'INTENDED_ELIGIBLE_UNIVERSE',
        memberCount: intendedCount,
        memberIds: Object.freeze(intended.map((row) => row.canonicalEntityId)),
      }),
      observedUniverse: Object.freeze({
        mode: 'OBSERVED_USABLE_UNIVERSE',
        memberCount: observedCount,
        memberIds: Object.freeze([...input.observedUsableEntityIds]),
      }),
      severity: 'INSUFFICIENT_DATA',
      findings: Object.freeze([]),
      coverageBias: Object.freeze({
        intendedCount,
        observedCount,
        coverageRate: intendedCount === 0 ? 0 : observedCount / intendedCount,
        severity: 'INSUFFICIENT_DATA',
      }),
      survivorship: Object.freeze({
        deadOrDelistedInIntended: 0,
        absentFromObserved: 0,
        survivorshipAbsenceRate: 0,
        severity: 'INSUFFICIENT_DATA',
        delistedEntityIds: Object.freeze([]),
      }),
      providerBias: Object.freeze({
        providerSharesIntended: Object.freeze({}),
        providerSharesObserved: Object.freeze({}),
        concentrationDelta: 0,
        severity: 'INSUFFICIENT_DATA',
      }),
      missingnessModel: null,
      grantsExecutionAuthority: false,
    });
  }

  const coverageRate = observedCount / intendedCount;
  const coverageGap = 1 - coverageRate;
  const coverageSeverity = severityFromMagnitude(
    coverageGap,
    COVERAGE_GAP_WARNING_THRESHOLD,
    COVERAGE_GAP_SEVERE_THRESHOLD,
  );

  const allEvidence: BiasEvidence[] = [
    buildEvidence({
      dimension: 'COVERAGE_BIAS',
      metricKind: 'COVERAGE_RATE_DELTA',
      intendedValue: '1.0000',
      observedValue: coverageRate.toFixed(4),
      magnitude: coverageGap,
      severity: coverageSeverity,
      bucketLabel: null,
      diagnosticNote: 'Difference between intended eligible and observed usable universes.',
    }),
  ];

  for (const spec of NUMERIC_SPECS) {
    allEvidence.push(...assessNumericField(intended, observedSet, spec));
  }
  for (const spec of CATEGORICAL_SPECS) {
    allEvidence.push(...assessCategoricalField(intended, observedSet, spec.read, spec.dimension));
  }
  allEvidence.push(...assessMissingnessCorrelations(intended, observedSet));
  allEvidence.push(
    ...assessTrainHoldoutDrift(intended, observedSet, input.trainEntityIds, input.holdoutEntityIds),
  );

  const survivorshipBlock = assessSurvivorshipAndDelisting(intended, observedSet);
  allEvidence.push(...survivorshipBlock.evidence);

  const providerBlock = assessProviderBias(intended, observedMembers);
  allEvidence.push(...providerBlock.evidence);

  const missingnessModel = diagnoseMissingnessModel({ intended, observedSet });

  const findings: BiasFinding[] = [];
  const dimensions = new Set(allEvidence.map((row) => row.dimension));
  for (const dimension of dimensions) {
    const dimEvidence = allEvidence.filter((row) => row.dimension === dimension);
    const finding = buildFinding(
      input.assessmentId,
      dimension,
      dimEvidence,
      `Bias sentinel detected ${dimension} divergence between intended and observed universes.`,
    );
    if (finding) {
      findings.push(finding);
    }
  }

  const severities: BiasSeverity[] = [
    coverageSeverity,
    survivorshipBlock.survivorship.severity,
    providerBlock.providerBias.severity,
    ...allEvidence.map((row) => row.severity),
  ];

  const coverageBias: CoverageBiasAssessment = Object.freeze({
    intendedCount,
    observedCount,
    coverageRate,
    severity: coverageSeverity,
  });

  return Object.freeze({
    schemaVersion: BIAS_SENTINEL_SCHEMA,
    assessmentId: input.assessmentId,
    strategyGenomeRef: input.strategyGenomeRef ?? null,
    researchDatasetId: input.researchDatasetId,
    pointInTimeManifestId: input.pointInTimeManifestId ?? null,
    coverageTensorDigest: input.coverageTensorDigest ?? null,
    evaluatedAt: input.evaluatedAt,
    intendedUniverse: Object.freeze({
      mode: 'INTENDED_ELIGIBLE_UNIVERSE',
      memberCount: intendedCount,
      memberIds: Object.freeze(intended.map((row) => row.canonicalEntityId)),
    }),
    observedUniverse: Object.freeze({
      mode: 'OBSERVED_USABLE_UNIVERSE',
      memberCount: observedCount,
      memberIds: Object.freeze(observedMembers.map((row) => row.canonicalEntityId)),
    }),
    severity: combineSeverities(severities),
    findings: Object.freeze(findings),
    coverageBias,
    survivorship: survivorshipBlock.survivorship,
    providerBias: providerBlock.providerBias,
    missingnessModel,
    grantsExecutionAuthority: false,
  });
}
