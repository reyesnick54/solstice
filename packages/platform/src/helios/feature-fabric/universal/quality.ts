/**
 * Feature quality — degrades when upstream observations are stale or contradictory.
 */

import type { QualityState, SourceIndependence } from '../../observation/types.ts';
import type { FeatureContributionInput, FeatureObservation, FeatureQuality, FeatureQualityState } from './types.ts';

const STALE_QUALITY: ReadonlySet<QualityState> = new Set([
  'DEGRADED_STALE',
  'DEGRADED_GAP',
  'DEGRADED_OUTLIER',
  'DEGRADED_SEQUENCE',
]);

export function deriveFeatureQuality(
  contributions: readonly FeatureContributionInput[],
  sourceIndependence: SourceIndependence,
): FeatureQualityState {
  if (contributions.length === 0) {
    return 'DEGRADED_MISSING_INPUT';
  }
  for (const contribution of contributions) {
    if (contribution.qualityState === 'UNAVAILABLE') {
      return 'UNAVAILABLE';
    }
    if (contribution.qualityState === 'DEGRADED_CONTRADICTORY') {
      return 'DEGRADED_CONTRADICTORY';
    }
    if (contribution.qualityState === 'DEGRADED_ENTITLEMENT') {
      return 'DEGRADED_ENTITLEMENT';
    }
  }
  for (const contribution of contributions) {
    if (STALE_QUALITY.has(contribution.qualityState)) {
      return 'DEGRADED_STALE';
    }
  }
  if (sourceIndependence === 'DUPLICATE') {
    return 'DEGRADED_CONTRADICTORY';
  }
  return 'VALID';
}

export function deriveFeatureQualityFromInputs(inputs: readonly FeatureObservation[]): FeatureQualityState {
  if (inputs.length === 0) {
    return 'DEGRADED_MISSING_INPUT';
  }
  for (const row of inputs) {
    if (row.qualityState === 'UNAVAILABLE') {
      return 'UNAVAILABLE';
    }
    if (row.qualityState === 'DEGRADED_CONTRADICTORY') {
      return 'DEGRADED_CONTRADICTORY';
    }
    if (row.qualityState === 'DEGRADED_ENTITLEMENT') {
      return 'DEGRADED_ENTITLEMENT';
    }
  }
  for (const row of inputs) {
    if (row.qualityState === 'DEGRADED_STALE') {
      return 'DEGRADED_STALE';
    }
  }
  return 'VALID';
}

export function featureQualityRecord(state: FeatureQualityState): FeatureQuality {
  const degradedReason =
    state === 'VALID'
      ? null
      : state === 'DEGRADED_STALE'
        ? 'upstream_stale'
        : state === 'DEGRADED_ENTITLEMENT'
          ? 'upstream_entitlement'
          : state;
  return Object.freeze({ state, degradedReason });
}

export function deriveSourceIndependence(
  contributions: readonly FeatureContributionInput[],
): SourceIndependence {
  if (contributions.length === 0) {
    return 'UNKNOWN';
  }
  let result: SourceIndependence = contributions[0]!.sourceIndependence;
  for (let i = 1; i < contributions.length; i += 1) {
    const next = contributions[i]!.sourceIndependence;
    if (result === 'UNKNOWN') {
      result = next;
      continue;
    }
    if (next === 'UNKNOWN') {
      continue;
    }
    if (result !== next) {
      return 'UNKNOWN';
    }
  }
  return result;
}

export function availabilityAt(
  evaluationTime: string,
  knowableAt: string,
  quality: FeatureQualityState,
  entitlementState: string,
): 'AVAILABLE' | 'RESTRICTED' | 'NOT_YET_KNOWABLE' | 'UNAVAILABLE' {
  if (Date.parse(evaluationTime) < Date.parse(knowableAt)) {
    return 'NOT_YET_KNOWABLE';
  }
  if (quality === 'UNAVAILABLE' || entitlementState === 'UNAVAILABLE') {
    return 'UNAVAILABLE';
  }
  if (entitlementState === 'RESTRICTED' || entitlementState === 'UNKNOWN') {
    return 'RESTRICTED';
  }
  return 'AVAILABLE';
}
