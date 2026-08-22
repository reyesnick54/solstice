/**
 * Provider-status normalization for payment rails.
 *
 * Unknown vendor statuses map to UNKNOWN / REQUIRES_RECONCILIATION.
 * They never become SETTLED or COMPLETED.
 */

import { normalizeProviderStatus, type CanonicalRailStatus } from '../../rail-types.ts';
import type { NormalizedPaymentStatus } from '../types.ts';

export type NormalizedPaymentState = {
  readonly canonical: NormalizedPaymentStatus;
  readonly railStatus: CanonicalRailStatus;
  readonly originalProviderStatus: string;
  readonly requiresReconciliation: boolean;
};

const COMPLETED_ALIASES = new Set([
  'COMPLETED',
  'COMPLETE',
  'SUCCESS',
  'SUCCEEDED',
  'SETTLED',
  'POSTED',
  'DONE',
]);

export function normalizePaymentProviderStatus(providerStatus: string): NormalizedPaymentState {
  const key = providerStatus.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (key === '' || key === 'UNKNOWN' || key === 'UNRECOGNIZED' || key === 'OTHER') {
    return state('REQUIRES_RECONCILIATION', 'UNKNOWN', providerStatus, true);
  }
  const rail = normalizeProviderStatus(providerStatus);
  if (rail === 'UNKNOWN') {
    return state('REQUIRES_RECONCILIATION', 'UNKNOWN', providerStatus, true);
  }
  if (rail === 'SETTLED' && !COMPLETED_ALIASES.has(key) && key !== 'SETTLED') {
    return state('REQUIRES_RECONCILIATION', 'UNKNOWN', providerStatus, true);
  }
  return state(rail, rail, providerStatus, rail === 'SUBMISSION_UNKNOWN');
}

export function neverPromoteUnknownToSettled(state: NormalizedPaymentState): boolean {
  if (state.requiresReconciliation && state.canonical === 'SETTLED') {
    throw new Error('unknown provider status must not map to SETTLED');
  }
  return true;
}

function state(
  canonical: NormalizedPaymentStatus,
  railStatus: CanonicalRailStatus,
  originalProviderStatus: string,
  requiresReconciliation: boolean,
): NormalizedPaymentState {
  return Object.freeze({
    canonical,
    railStatus,
    originalProviderStatus,
    requiresReconciliation,
  });
}
