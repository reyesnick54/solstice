/**
 * ACCESS Wave 2 — Safe provider fallback behavior.
 *
 * Discovery may fallback when semantically safe. Booking must not blindly
 * attempt a second provider when the first booking state is unknown.
 */

import type { AccessProviderId } from '../types.ts';
import type { ProviderSelectionResult } from './selection.ts';

export const FALLBACK_SAFE_OPERATIONS = ['CATALOG_SEARCH', 'AVAILABILITY', 'REALTIME_PRICING'] as const;
export type FallbackSafeOperation = (typeof FALLBACK_SAFE_OPERATIONS)[number];

export const FALLBACK_UNSAFE_OPERATIONS = ['RESERVE', 'BOOK', 'CANCEL', 'REFUND'] as const;
export type FallbackUnsafeOperation = (typeof FALLBACK_UNSAFE_OPERATIONS)[number];

export type FallbackDecision = {
  readonly allowed: boolean;
  readonly nextProviderId: AccessProviderId | null;
  readonly reason: string;
};

export function decideDiscoveryFallback(
  selection: ProviderSelectionResult,
  failedProviderId: AccessProviderId,
  attemptIndex: number,
): FallbackDecision {
  if (selection.ranked.length === 0) {
    return Object.freeze({
      allowed: false,
      nextProviderId: null,
      reason: 'no ranked discovery providers',
    });
  }

  const currentIndex = selection.ranked.findIndex((row) => row.providerId === failedProviderId);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : attemptIndex;

  if (nextIndex >= selection.ranked.length) {
    return Object.freeze({
      allowed: false,
      nextProviderId: null,
      reason: 'exhausted discovery fallback chain',
    });
  }

  const next = selection.ranked[nextIndex];
  if (!next) {
    return Object.freeze({
      allowed: false,
      nextProviderId: null,
      reason: 'no further discovery fallback providers',
    });
  }

  return Object.freeze({
    allowed: true,
    nextProviderId: next.providerId,
    reason: `discovery fallback from ${failedProviderId} to ${next.providerId}`,
  });
}

export function decideBookingFallback(
  bookingState: 'CONFIRMED' | 'CANCELLED' | 'FAILED' | 'UNKNOWN',
  failedProviderId: AccessProviderId,
): FallbackDecision {
  if (bookingState === 'UNKNOWN') {
    return Object.freeze({
      allowed: false,
      nextProviderId: null,
      reason: `booking state unknown for ${failedProviderId}; reconciliation required before fallback`,
    });
  }
  if (bookingState === 'CONFIRMED') {
    return Object.freeze({
      allowed: false,
      nextProviderId: null,
      reason: `booking already confirmed with ${failedProviderId}`,
    });
  }
  return Object.freeze({
    allowed: false,
    nextProviderId: null,
    reason: 'booking fallback not permitted; use reconciliation for ambiguous states',
  });
}

export function isFallbackSafeOperation(operation: string): operation is FallbackSafeOperation {
  return (FALLBACK_SAFE_OPERATIONS as readonly string[]).includes(operation);
}
