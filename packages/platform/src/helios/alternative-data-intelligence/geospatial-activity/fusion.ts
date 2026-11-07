/**
 * Multi-sensor robust fusion for asset-level physical activity (facility scale only).
 */

import type { UtcInstant } from '@solstice/domain';

import { FUSION_ALGORITHM_VERSION } from '../taxonomy.ts';
import type { DerivedObservationKind, PhysicalActivityBand } from '../taxonomy.ts';
import { calibratedNighttimeActivityIndexBps } from './calibration.ts';
import type {
  GeoObservation,
  PhysicalActivityEstimate,
  SourceContribution,
  VersionedDerivedMetric,
} from './types.ts';

function metricToActivityBps(metric: VersionedDerivedMetric): number {
  if (metric.kind === 'nighttimeLight') {
    return calibratedNighttimeActivityIndexBps({
      rawIndexMinor: metric.valueMinor,
      calibration: metric.calibration,
    }).indexBps;
  }
  if (metric.quality.dataGap) {
    return 0;
  }
  const cloudPenalty =
    metric.quality.cloudCoverRatioBps !== null
      ? Math.max(0, 1 - metric.quality.cloudCoverRatioBps / 10_000)
      : 1;
  const raw = Number(metric.valueMinor);
  const scaled = Math.floor((raw / 100) * cloudPenalty);
  return Math.min(10_000, Math.max(0, scaled));
}

function qualityWeight(metric: VersionedDerivedMetric): number {
  let weight = 10_000;
  if (metric.quality.dataGap) {
    return 0;
  }
  if (metric.quality.cloudCoverRatioBps !== null && metric.quality.cloudCoverRatioBps > 6_000) {
    weight = Math.floor(weight * 0.4);
  }
  if (metric.quality.resolutionMeters !== null && metric.quality.resolutionMeters > 500) {
    weight = Math.floor(weight * 0.7);
  }
  return weight;
}

function bandForIndex(indexBps: number): PhysicalActivityBand {
  if (indexBps <= 500) return 'IDLE';
  if (indexBps <= 2_500) return 'LOW';
  if (indexBps <= 5_500) return 'MODERATE';
  if (indexBps <= 8_500) return 'ELEVATED';
  return 'UNKNOWN';
}

function robustFusedIndex(contributions: readonly SourceContribution[]): number {
  if (contributions.length === 0) {
    return 0;
  }
  const weighted = contributions.map((row) => row.activityIndexBps * row.weightBps);
  const totalWeight = contributions.reduce((sum, row) => sum + row.weightBps, 0);
  if (totalWeight === 0) {
    return 0;
  }
  const mean = weighted.reduce((a, b) => a + b, 0) / totalWeight;
  const sorted = contributions.map((row) => row.activityIndexBps).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? mean;
  return Math.floor(0.4 * median + 0.6 * mean);
}

function dispersionUncertainty(contributions: readonly SourceContribution[], fused: number): number {
  if (contributions.length < 2) {
    return 2_500;
  }
  const variance =
    contributions.reduce((sum, row) => sum + (row.activityIndexBps - fused) ** 2, 0) / contributions.length;
  return Math.min(10_000, Math.floor(Math.sqrt(variance)));
}

export function fusePhysicalActivityEstimate(input: {
  readonly geoAssetId: string;
  readonly evaluationTime: UtcInstant;
  readonly observations: readonly GeoObservation[];
}): PhysicalActivityEstimate {
  const byKind = new Map<DerivedObservationKind, GeoObservation>();
  for (const obs of input.observations) {
    if (obs.geoAssetId !== input.geoAssetId) continue;
    const existing = byKind.get(obs.derived.kind);
    if (!existing || obs.knowableAt > existing.knowableAt) {
      byKind.set(obs.derived.kind, obs);
    }
  }

  const contributions: SourceContribution[] = [];
  let calibrationApplied = false;
  for (const obs of byKind.values()) {
    const weightBps = qualityWeight(obs.derived);
    if (weightBps === 0) continue;
    const activityIndexBps = metricToActivityBps(obs.derived);
    if (obs.derived.kind === 'nighttimeLight' && obs.derived.calibration) {
      calibrationApplied = true;
    }
    contributions.push(
      Object.freeze({
        observationId: obs.observationId,
        kind: obs.derived.kind,
        weightBps,
        activityIndexBps,
      }),
    );
  }

  const activityIndexBps = robustFusedIndex(contributions);
  const uncertaintyBps = dispersionUncertainty(contributions, activityIndexBps);

  return Object.freeze({
    estimateId: `pae:${input.geoAssetId}:${input.evaluationTime}:${FUSION_ALGORITHM_VERSION}`,
    geoAssetId: input.geoAssetId,
    evaluationTime: input.evaluationTime,
    activityIndexBps,
    uncertaintyBps,
    sourceContributions: Object.freeze(contributions),
    calibrationApplied,
    luminosityIsNotProduction: true,
    grantsExecutionAuthority: false,
  });
}

export function physicalActivityBand(estimate: PhysicalActivityEstimate): PhysicalActivityBand {
  return bandForIndex(estimate.activityIndexBps);
}
