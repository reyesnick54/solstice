/**
 * Trust metadata for Financial Agent evidence — quality only, no execution authority.
 */

import type { CanonicalTrustResult, TrustEvidenceMetadata } from './types.ts';
import type { ExternalObservationEvidenceRef } from '../agent-evidence.ts';

export type TrustAugmentedEvidenceRef = ExternalObservationEvidenceRef & {
  readonly trustMetadata?: TrustEvidenceMetadata | null;
};

export function augmentEvidenceWithTrust(
  ref: ExternalObservationEvidenceRef,
  trust: CanonicalTrustResult<unknown> | null,
): TrustAugmentedEvidenceRef {
  if (!trust) {
    return Object.freeze({ ...ref, trustMetadata: null });
  }
  return Object.freeze({
    ...ref,
    trustMetadata: Object.freeze({
      sourceCount: trust.inputObservationIds.length,
      corroborationCount: trust.corroborationCount,
      confidenceBand: trust.confidenceBand,
      confidenceScore: trust.confidenceScore,
      freshness: trust.freshness,
      status: trust.status,
      hasConflicts: trust.conflictingObservationIds.length > 0 || trust.status === 'CONFLICTED',
      authorityDominant: trust.authoritySummary.dominantClass,
      trustPolicyVersion: trust.trustPolicyVersion,
      grantsExecutionAuthority: false,
    }),
  });
}

export type WorldQualitySnapshot = {
  readonly status: 'LIVE' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE';
  readonly quality: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly sources: number;
  readonly updatedAt: string;
  readonly referenceOnly: true;
  readonly grantsExecutionAuthority: false;
};

export function toWorldQualitySnapshot(trust: CanonicalTrustResult<unknown>): WorldQualitySnapshot {
  const statusMap: Record<string, WorldQualitySnapshot['status']> = {
    TRUSTED: 'LIVE',
    SUPPORTED: 'LIVE',
    LOW_CONFIDENCE: 'DEGRADED',
    CONFLICTED: 'DEGRADED',
    STALE: 'STALE',
    INSUFFICIENT_DATA: 'UNAVAILABLE',
    UNAVAILABLE: 'UNAVAILABLE',
  };
  return Object.freeze({
    status: statusMap[trust.status] ?? 'UNAVAILABLE',
    quality: trust.confidenceBand,
    sources: trust.corroborationCount,
    updatedAt: trust.generatedAt,
    referenceOnly: true,
    grantsExecutionAuthority: false,
  });
}
