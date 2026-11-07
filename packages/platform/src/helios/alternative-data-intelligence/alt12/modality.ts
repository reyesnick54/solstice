/**
 * HELIOS ALT12 — per-modality state and reliability.
 */

import type { Alt12RoutingContext, ModalityAvailability, ModalityReliability, ModalityState } from './types.ts';
import type { AltMissingReason, AltModalityId } from '../taxonomy.ts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function computeModalityReliability(input: {
  readonly modality: AltModalityId;
  readonly trustScore: number;
  readonly coverageScore: number;
  readonly latencyScore: number;
  readonly calibrationScore: number;
  readonly routingContext?: Alt12RoutingContext;
}): ModalityReliability {
  const degradationNotes: string[] = [];
  let trust = clamp01(input.trustScore);
  let coverage = clamp01(input.coverageScore);
  const latency = clamp01(input.latencyScore);
  const calibration = clamp01(input.calibrationScore);

  const ctx = input.routingContext ?? {};
  if (input.modality === 'satellite_geospatial' && ctx.satelliteCloudObscured) {
    trust *= 0.2;
    degradationNotes.push('cloud_obscured');
  }
  if (input.modality === 'digital_demand' && ctx.digitalDemandReliabilityDegraded) {
    trust *= 0.35;
    degradationNotes.push('search_reliability_degraded');
  }
  if (input.modality === 'workforce' && ctx.workforceGeographicCoverageLost) {
    coverage = 0;
    trust = 0;
    degradationNotes.push('geographic_coverage_lost');
  }

  const effectiveTrust = clamp01(trust * 0.4 + coverage * 0.25 + latency * 0.15 + calibration * 0.2);

  return Object.freeze({
    modality: input.modality,
    trustScore: trust,
    coverageScore: coverage,
    latencyScore: latency,
    calibrationScore: calibration,
    effectiveTrust,
    degradationNotes: Object.freeze(degradationNotes),
  });
}

export function buildModalityState(input: {
  readonly modality: AltModalityId;
  readonly availability: ModalityAvailability;
  readonly missingReason: AltMissingReason | null;
  readonly featureValue: number | null;
  readonly featureUncertainty: number | null;
  readonly evaluatedAt: import('@solstice/domain').UtcInstant | null;
  readonly providerId: string | null;
  readonly trustScore: number;
  readonly coverageScore: number;
  readonly latencyScore: number;
  readonly calibrationScore: number;
  readonly routingContext?: Alt12RoutingContext;
}): ModalityState {
  let availability = input.availability;
  const reliability = computeModalityReliability({
    modality: input.modality,
    trustScore: input.trustScore,
    coverageScore: input.coverageScore,
    latencyScore: input.latencyScore,
    calibrationScore: input.calibrationScore,
    routingContext: input.routingContext,
  });

  if (input.modality === 'workforce' && (input.routingContext?.workforceGeographicCoverageLost ?? false)) {
    availability = 'BLOCKED';
  }

  return Object.freeze({
    modality: input.modality,
    availability,
    missingReason: input.missingReason,
    featureValue: availability === 'PRESENT' ? input.featureValue : null,
    featureUncertainty: availability === 'PRESENT' ? input.featureUncertainty : null,
    evaluatedAt: input.evaluatedAt,
    providerId: input.providerId,
    reliability,
  });
}
