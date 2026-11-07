import type { JobOpportunity } from '@solstice/external-data/wave6';
import type { UtcInstant } from '@solstice/domain';
import type { WorkforceIntelligenceFirmSnapshot, WorkforceProviderHistoryWindow } from './types.ts';
import { applyCoverageAdjustedCount, buildJobPostingCoverageModel, type CoverageBenchmark } from './coverage-model.ts';
import { buildWorkforceExpansionState } from './expansion-estimator.ts';
import { interpretWorkforceForResearch } from './interpretation.ts';
import { computeJobPostingFeatures } from './metrics.ts';
import {
  buildSkillDemandState,
  computeInnovationHiringIntensity,
  computeManufacturingHiringIntensity,
  computeSalesHiringIntensity,
  computeSkillMixShift,
} from './skill-intelligence.ts';
import {
  buildGeographicHiringState,
  buildHiringDemandState,
  buildHiringQualityState,
  buildSubsidiaryHiringState,
} from './states.ts';
import { materializeFirmObservations } from './wave6-bridge.ts';
import { assertNoWorkforceLeakage } from './knowable-at.ts';

export function compileWorkforceFirmSnapshot(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly jobs: readonly JobOpportunity[];
  readonly priorJobs?: readonly JobOpportunity[];
  readonly history?: WorkforceProviderHistoryWindow | null;
  readonly benchmark?: CoverageBenchmark | null;
  readonly closedPostingCount?: number;
}): WorkforceIntelligenceFirmSnapshot {
  const knowableAt = input.jobs.reduce<UtcInstant | null>((max, job) => {
    const k = job.provenance.retrievedAt ?? job.postedAt;
    if (!k) return max;
    if (!max || Date.parse(k) > Date.parse(max)) return k;
    return max;
  }, null) ?? input.evaluationTime;

  const observations = materializeFirmObservations({
    firmKey: input.firmKey,
    jobs: input.jobs,
    evaluationTime: input.evaluationTime,
  });
  assertNoWorkforceLeakage(input.evaluationTime, observations);

  const providerIds = Object.freeze([...new Set(input.jobs.map((j) => j.providerId))]);
  const priorWeekCount = input.history?.priorWeekCount ?? Math.max(1, Math.round(input.jobs.length * 0.9));
  const priorMonthCount = input.history?.priorMonthCount ?? Math.max(1, Math.round(input.jobs.length * 0.75));
  const priorYearCount = input.history?.priorYearCount ?? null;
  const newPostingCount = observations.filter((o) => (o.durationDays ?? 99) <= 7).length;

  const features = computeJobPostingFeatures({
    current: observations,
    priorWeekCount,
    priorMonthCount,
    priorYearCount,
    closedPostingCount: input.closedPostingCount ?? 0,
    newPostingCount,
  });

  const coverage = buildJobPostingCoverageModel({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    jobs: input.jobs,
    benchmark: input.benchmark ?? null,
  });

  const rawPostingCount = features.postingCount;
  const adjustedPostingCount = applyCoverageAdjustedCount(rawPostingCount, coverage);

  const hiringDemand = buildHiringDemandState({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    providerIds,
    features,
    rawPostingCount,
    adjustedPostingCount,
  });

  const expansion = buildWorkforceExpansionState({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    providerIds,
    features,
    history: input.history ?? null,
  });

  const skillDemand = buildSkillDemandState({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    providerIds,
    observations,
  });

  const priorObs =
    input.priorJobs != null
      ? materializeFirmObservations({
          firmKey: input.firmKey,
          jobs: input.priorJobs,
          evaluationTime: input.evaluationTime,
        })
      : [];

  const skillMixShift =
    priorObs.length > 0
      ? computeSkillMixShift({
          firmKey: input.firmKey,
          prior: priorObs,
          current: observations,
          fromWindowStart: input.history?.windowEnd ?? input.evaluationTime,
          toWindowEnd: input.evaluationTime,
          knowableAt,
        })
      : null;

  const innovationIntensity = computeInnovationHiringIntensity({
    firmKey: input.firmKey,
    observations,
    knowableAt,
  });
  const salesIntensity = computeSalesHiringIntensity({ firmKey: input.firmKey, observations, knowableAt });
  const manufacturingIntensity = computeManufacturingHiringIntensity({
    firmKey: input.firmKey,
    observations,
    knowableAt,
  });

  const geographic = buildGeographicHiringState({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    providerIds,
    observations,
  });

  const subsidiary = buildSubsidiaryHiringState({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    providerIds,
    observations,
  });

  const providerCoverageScoreBps = Math.min(10_000, providerIds.length * 2_500);
  const quality = buildHiringQualityState({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    providerIds,
    observations,
    providerCoverageScoreBps,
    representativenessScoreBps: coverage.adjustedWeightBps,
  });

  const adjustedGrowthMoM =
    features.postingGrowthMoMBps != null
      ? Math.round((features.postingGrowthMoMBps * coverage.adjustedWeightBps) / 10_000)
      : null;

  const interpretation = interpretWorkforceForResearch({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    knowableAt,
    expansion,
    quality,
    adjustedPostingGrowthMoMBps: adjustedGrowthMoM,
  });

  return Object.freeze({
    firmKey: input.firmKey,
    evaluationTime: input.evaluationTime,
    observations,
    hiringDemand,
    expansion,
    skillDemand,
    skillMixShift,
    innovationIntensity,
    salesIntensity,
    manufacturingIntensity,
    geographic,
    subsidiary,
    quality,
    coverage,
    interpretation,
    grantsExecutionAuthority: false,
  });
}
