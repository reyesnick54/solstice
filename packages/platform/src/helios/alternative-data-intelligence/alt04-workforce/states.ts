import type { RemoteStatus } from '@solstice/external-data/wave6';
import type { UtcInstant } from '@solstice/domain';
import type {
  GeographicHiringState,
  HiringDemandState,
  HiringQualityState,
  JobPostingFeatureBundle,
  JobPostingObservation,
  SubsidiaryHiringState,
} from './types.ts';
import {
  HELIOS_ALT04_WORKFORCE_AUTHORITY,
  HELIOS_ALT04_WORKFORCE_SCHEMA,
  type HiringDemandBand,
  type HiringQualityBand,
} from './taxonomy.ts';

function demandBand(features: JobPostingFeatureBundle, adjustedCount: number): HiringDemandBand {
  const growth = features.postingGrowthMoMBps;
  if (adjustedCount >= 25 || (growth != null && growth >= 3_000)) return 'SURGE';
  if (adjustedCount >= 10 || (growth != null && growth >= 1_000)) return 'ELEVATED';
  if (growth != null && growth <= -1_000) return 'CONTRACTING';
  return 'STABLE';
}

function qualityBand(coverageBps: number, duplicateBps: number): HiringQualityBand {
  if (coverageBps < 3_500) return 'LOW_SIGNAL';
  if (duplicateBps > 4_000) return 'MIXED';
  if (coverageBps >= 7_500) return 'HIGH_COVERAGE';
  return 'ACTIONABLE';
}

export function buildHiringDemandState(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerIds: readonly string[];
  readonly features: JobPostingFeatureBundle;
  readonly rawPostingCount: number;
  readonly adjustedPostingCount: number;
}): HiringDemandState {
  const band = demandBand(input.features, input.adjustedPostingCount);
  const note =
    band === 'SURGE' || band === 'ELEVATED'
      ? 'Elevated posting activity does not imply positive operating leverage without motive context.'
      : 'Demand band reflects posting volume and momentum only.';
  return Object.freeze({
    schema: HELIOS_ALT04_WORKFORCE_SCHEMA,
    authority: HELIOS_ALT04_WORKFORCE_AUTHORITY,
    stateId: `hiring_demand:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    canonicalEntityId: null,
    observationTime: input.evaluationTime,
    knowableAt: input.knowableAt,
    providerIds: Object.freeze([...input.providerIds]),
    grantsExecutionAuthority: false,
    band,
    features: input.features,
    rawPostingCount: input.rawPostingCount,
    adjustedPostingCount: input.adjustedPostingCount,
    interpretationNote: note,
  });
}

export function buildGeographicHiringState(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerIds: readonly string[];
  readonly observations: readonly JobPostingObservation[];
}): GeographicHiringState {
  const geographyCounts: Record<string, number> = {};
  const remoteTally: Record<RemoteStatus, number> = {
    ONSITE: 0,
    REMOTE: 0,
    HYBRID: 0,
    UNKNOWN: 0,
  };
  const priorGeographies = new Set<string>();

  for (const obs of input.observations) {
    const geo = obs.sourceJob.location?.trim() || 'unknown';
    geographyCounts[geo] = (geographyCounts[geo] ?? 0) + 1;
    remoteTally[obs.sourceJob.remoteStatus] = (remoteTally[obs.sourceJob.remoteStatus] ?? 0) + 1;
    if (obs.durationDays != null && obs.durationDays < 14) {
      priorGeographies.add(geo);
    }
  }

  const total = input.observations.length;
  const share = (n: number) => (total > 0 ? Math.round((n * 10_000) / total) : 0);

  return Object.freeze({
    schema: HELIOS_ALT04_WORKFORCE_SCHEMA,
    authority: HELIOS_ALT04_WORKFORCE_AUTHORITY,
    stateId: `geo_hiring:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    canonicalEntityId: null,
    observationTime: input.evaluationTime,
    knowableAt: input.knowableAt,
    providerIds: Object.freeze([...input.providerIds]),
    grantsExecutionAuthority: false,
    geographyCounts: Object.freeze({ ...geographyCounts }),
    remoteShareBps: share(remoteTally.REMOTE),
    hybridShareBps: share(remoteTally.HYBRID),
    onsiteShareBps: share(remoteTally.ONSITE),
    expandingGeographies: Object.freeze(
      Object.entries(geographyCounts)
        .filter(([geo]) => !priorGeographies.has(geo))
        .map(([geo]) => geo),
    ),
  });
}

export function buildSubsidiaryHiringState(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerIds: readonly string[];
  readonly observations: readonly JobPostingObservation[];
}): SubsidiaryHiringState {
  const subsidiaryCounts: Record<string, number> = {};
  for (const obs of input.observations) {
    const label = obs.subsidiaryLabel ?? obs.sourceJob.employer ?? 'parent';
    subsidiaryCounts[label] = (subsidiaryCounts[label] ?? 0) + 1;
  }
  const total = input.observations.length;
  const parent = subsidiaryCounts[input.firmKey] ?? subsidiaryCounts['parent'] ?? 0;
  const parentConcentrationBps = total > 0 ? Math.round((parent * 10_000) / total) : 10_000;

  return Object.freeze({
    schema: HELIOS_ALT04_WORKFORCE_SCHEMA,
    authority: HELIOS_ALT04_WORKFORCE_AUTHORITY,
    stateId: `subsidiary_hiring:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    canonicalEntityId: null,
    observationTime: input.evaluationTime,
    knowableAt: input.knowableAt,
    providerIds: Object.freeze([...input.providerIds]),
    grantsExecutionAuthority: false,
    subsidiaryCounts: Object.freeze({ ...subsidiaryCounts }),
    parentConcentrationBps,
  });
}

export function buildHiringQualityState(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerIds: readonly string[];
  readonly observations: readonly JobPostingObservation[];
  readonly providerCoverageScoreBps: number;
  readonly representativenessScoreBps: number;
}): HiringQualityState {
  let duplicates = 0;
  const seen = new Set<string>();
  for (const obs of input.observations) {
    const key = `${obs.sourceJob.title}|${obs.sourceJob.location}`;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  const duplicateRateBps =
    input.observations.length > 0 ? Math.round((duplicates * 10_000) / input.observations.length) : 0;
  const band = qualityBand(input.providerCoverageScoreBps, duplicateRateBps);

  return Object.freeze({
    schema: HELIOS_ALT04_WORKFORCE_SCHEMA,
    authority: HELIOS_ALT04_WORKFORCE_AUTHORITY,
    stateId: `hiring_quality:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    canonicalEntityId: null,
    observationTime: input.evaluationTime,
    knowableAt: input.knowableAt,
    providerIds: Object.freeze([...input.providerIds]),
    grantsExecutionAuthority: false,
    band,
    providerCoverageScoreBps: input.providerCoverageScoreBps,
    representativenessScoreBps: input.representativenessScoreBps,
    duplicateRateBps,
  });
}
