/**
 * Missingness classification — nulls are never collapsed into a single bucket.
 */

import type { FeatureEntitlementState, FeatureQualityState } from '../types.ts';
import type { MissingnessReason } from './types.ts';

export type CoverageProbeSignal = {
  readonly published: boolean;
  readonly providerAvailable: boolean;
  readonly providerCoversInstrument: boolean;
  readonly entitlementState: FeatureEntitlementState;
  readonly entityResolved: boolean;
  readonly applicable: boolean;
  readonly qualityState: FeatureQualityState;
  readonly historicalGap: boolean;
  readonly knowableAtEvaluationTime: boolean;
  readonly valuePresent: boolean;
};

export function classifyMissingness(signal: CoverageProbeSignal): MissingnessReason | null {
  if (signal.valuePresent && signal.knowableAtEvaluationTime && signal.entityResolved) {
    if (signal.entitlementState === 'RESTRICTED' || signal.entitlementState === 'UNAVAILABLE') {
      return 'ENTITLEMENT_RESTRICTED';
    }
    if (signal.qualityState === 'UNAVAILABLE' || signal.qualityState === 'DEGRADED_CONTRADICTORY') {
      return 'QUALITY_REJECTED';
    }
    if (
      signal.qualityState === 'DEGRADED_STALE' ||
      signal.qualityState === 'DEGRADED_GAP' ||
      signal.qualityState === 'DEGRADED_OUTLIER' ||
      signal.qualityState === 'DEGRADED_SEQUENCE'
    ) {
      return 'SOURCE_STALE';
    }
    if (!signal.applicable) {
      return 'NOT_APPLICABLE';
    }
    return null;
  }

  if (!signal.applicable) {
    return 'NOT_APPLICABLE';
  }
  if (!signal.entityResolved) {
    return 'ENTITY_UNRESOLVED';
  }
  if (!signal.knowableAtEvaluationTime) {
    return 'NOT_YET_PUBLISHED';
  }
  if (!signal.providerAvailable) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (!signal.providerCoversInstrument) {
    return 'NOT_COVERED_BY_PROVIDER';
  }
  if (signal.entitlementState === 'RESTRICTED' || signal.entitlementState === 'UNAVAILABLE') {
    return 'ENTITLEMENT_RESTRICTED';
  }
  if (signal.historicalGap) {
    return 'HISTORICAL_GAP';
  }
  if (signal.qualityState === 'UNAVAILABLE' || signal.qualityState === 'DEGRADED_CONTRADICTORY') {
    return 'QUALITY_REJECTED';
  }
  if (!signal.published) {
    return 'NOT_YET_PUBLISHED';
  }
  return 'UNKNOWN';
}

export function dispositionFromMissingness(reason: MissingnessReason | null): 'USABLE' | 'MISSING' {
  return reason === null ? 'USABLE' : 'MISSING';
}

/** Entitlement failure is missingness, not a numeric zero. */
export function entitlementFailureIsMissingNotZero(entitlementState: FeatureEntitlementState): boolean {
  return entitlementState === 'RESTRICTED' || entitlementState === 'UNAVAILABLE';
}
