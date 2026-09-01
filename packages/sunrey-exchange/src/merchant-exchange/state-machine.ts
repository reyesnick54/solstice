import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { PurchaseIntentStatus } from './taxonomy.ts';

export type IllegalIntentTransition = {
  readonly code: 'ILLEGAL_INTENT_TRANSITION';
  readonly intentId: string;
  readonly from: PurchaseIntentStatus;
  readonly to: PurchaseIntentStatus;
};

/** Allowed purchase intent state transitions. */
export const ALLOWED_INTENT_TRANSITIONS: {
  readonly [S in PurchaseIntentStatus]: readonly PurchaseIntentStatus[];
} = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['VERIFIED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  VERIFIED: ['MATCHING', 'CANCELLED', 'EXPIRED'],
  MATCHING: ['OPEN_FOR_OFFERS', 'FAILED', 'CANCELLED', 'EXPIRED'],
  OPEN_FOR_OFFERS: ['OFFER_SELECTION', 'CANCELLED', 'EXPIRED'],
  OFFER_SELECTION: ['AUTHORIZED', 'OPEN_FOR_OFFERS', 'CANCELLED', 'EXPIRED', 'FAILED'],
  AUTHORIZED: ['FULFILLMENT', 'FAILED', 'CANCELLED'],
  FULFILLMENT: ['SETTLED', 'FAILED', 'CANCELLED'],
  SETTLED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
};

export function canTransitionIntent(from: PurchaseIntentStatus, to: PurchaseIntentStatus): boolean {
  return ALLOWED_INTENT_TRANSITIONS[from].includes(to);
}

export function assertIntentTransition(
  intentId: string,
  from: PurchaseIntentStatus,
  to: PurchaseIntentStatus,
): Result<true, IllegalIntentTransition> {
  if (!canTransitionIntent(from, to)) {
    return err(Object.freeze({ code: 'ILLEGAL_INTENT_TRANSITION' as const, intentId, from, to }));
  }
  return ok(true);
}

export function isTerminalIntentStatus(status: PurchaseIntentStatus): boolean {
  return status === 'SETTLED' || status === 'CANCELLED' || status === 'EXPIRED' || status === 'FAILED';
}

export function intentAcceptsOffers(status: PurchaseIntentStatus): boolean {
  return status === 'OPEN_FOR_OFFERS';
}

export function intentAcceptsSelection(status: PurchaseIntentStatus): boolean {
  return status === 'OFFER_SELECTION' || status === 'OPEN_FOR_OFFERS';
}
