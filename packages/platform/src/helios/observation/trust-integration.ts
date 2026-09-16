/**
 * External Data Trust Engine integration — trust informs HELIOS, never authorizes finance.
 */

import type { CanonicalTrustResult } from '../../../../provider-sdk/src/trust/types.ts';
import type { TrustIntegrationRef } from './types.ts';

export function buildTrustRef<T>(trustResult: CanonicalTrustResult<T> | null | undefined): TrustIntegrationRef | null {
  if (!trustResult) return null;
  return Object.freeze({
    trustPolicyProfile: trustResult.trustPolicyProfile,
    trustPolicyVersion: trustResult.trustPolicyVersion,
    status: trustResult.status,
    confidenceBand: trustResult.confidenceBand,
    grantsExecutionAuthority: false,
  });
}

export function trustSuggestsExclusion<T>(trustResult: CanonicalTrustResult<T> | null | undefined): boolean {
  if (!trustResult) return false;
  return (
    trustResult.status === 'UNAVAILABLE' ||
    trustResult.status === 'INSUFFICIENT_DATA' ||
    trustResult.status === 'STALE'
  );
}
