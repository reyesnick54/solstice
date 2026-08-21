import type { CardAuthorizationRecord } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';
import type { CardDispute } from './dispute.ts';
import type { CardRefundRecord } from './refund.ts';

/**
 * Consumer-visible card transaction lifecycle. Maps authorization,
 * clearing, refund, and dispute records. Not a second ledger.
 */
export const CARD_TRANSACTION_LIFECYCLE = [
  'AUTHORIZATION',
  'APPROVED',
  'DECLINED',
  'PENDING',
  'CAPTURED',
  'REVERSED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'DISPUTED',
] as const;
export type CardTransactionLifecycle = (typeof CARD_TRANSACTION_LIFECYCLE)[number];

export type CardTransactionActivity = {
  readonly id: string;
  readonly cardId: string;
  readonly kind: 'AUTHORIZATION' | 'CAPTURE' | 'REFUND' | 'REVERSAL' | 'DISPUTE';
  readonly lifecycle: CardTransactionLifecycle;
  readonly merchant: string | null;
  readonly merchantCategory: string | null;
  readonly country: string | null;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly holdId: string | null;
  readonly occurredAt: string;
};

export function cardTransactionActivity(input: {
  readonly authorizations: readonly CardAuthorizationRecord[];
  readonly clearings: readonly CardClearingRecord[];
  readonly refunds: readonly CardRefundRecord[];
  readonly disputes?: readonly CardDispute[];
}): readonly CardTransactionActivity[] {
  const refundsByClearing = new Map<string, CardRefundRecord[]>();
  for (const refund of input.refunds) {
    const key = refund.originalClearingId ?? refund.refundId;
    const list = refundsByClearing.get(key) ?? [];
    list.push(refund);
    refundsByClearing.set(key, list);
  }
  const disputedRefs = new Set((input.disputes ?? []).map((row) => row.transactionRef));

  const entries: CardTransactionActivity[] = [];
  for (const auth of input.authorizations) {
    entries.push({
      id: auth.authorizationId,
      cardId: auth.cardId,
      kind: auth.state === 'REVERSED' ? 'REVERSAL' : 'AUTHORIZATION',
      lifecycle: lifecycleForAuthorization(auth),
      merchant: auth.request.merchantRef,
      merchantCategory: auth.request.merchantCategory,
      country: auth.request.country,
      amountMinorUnits: auth.request.amount.minorUnits.toString(),
      currency: auth.request.amount.currency,
      holdId: auth.holdId,
      occurredAt: auth.createdAt,
    });
  }
  for (const clearing of input.clearings) {
    const refunds = refundsByClearing.get(clearing.clearingId) ?? [];
    entries.push({
      id: clearing.clearingId,
      cardId: clearing.cardId,
      kind: 'CAPTURE',
      lifecycle: lifecycleForClearing(clearing, refunds, disputedRefs.has(clearing.clearingId)),
      merchant: null,
      merchantCategory: null,
      country: null,
      amountMinorUnits: clearing.amount.minorUnits.toString(),
      currency: clearing.amount.currency,
      holdId: null,
      occurredAt: clearing.createdAt,
    });
  }
  for (const refund of input.refunds) {
    entries.push({
      id: refund.refundId,
      cardId: refund.cardId,
      kind: 'REFUND',
      lifecycle: refund.state === 'POSTED' ? 'REFUNDED' : 'PENDING',
      merchant: null,
      merchantCategory: null,
      country: null,
      amountMinorUnits: refund.amount.minorUnits.toString(),
      currency: refund.amount.currency,
      holdId: null,
      occurredAt: refund.createdAt,
    });
  }
  for (const dispute of input.disputes ?? []) {
    entries.push({
      id: dispute.disputeId,
      cardId: dispute.cardId,
      kind: 'DISPUTE',
      lifecycle: 'DISPUTED',
      merchant: null,
      merchantCategory: null,
      country: null,
      amountMinorUnits: dispute.amount.minorUnits.toString(),
      currency: dispute.amount.currency,
      holdId: null,
      occurredAt: dispute.createdAt,
    });
  }
  return Object.freeze(
    entries.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0)),
  );
}

function lifecycleForAuthorization(auth: CardAuthorizationRecord): CardTransactionLifecycle {
  switch (auth.state) {
    case 'APPROVED':
      return 'APPROVED';
    case 'DECLINED':
      return 'DECLINED';
    case 'REVERSED':
      return 'REVERSED';
    case 'CLEARED':
      return 'CAPTURED';
    case 'EXPIRED':
      return 'REVERSED';
    case 'PENDING':
      return 'PENDING';
  }
}

function lifecycleForClearing(
  clearing: CardClearingRecord,
  refunds: readonly CardRefundRecord[],
  disputed: boolean,
): CardTransactionLifecycle {
  if (disputed) {
    return 'DISPUTED';
  }
  if (clearing.state === 'REJECTED') {
    return 'DECLINED';
  }
  if (clearing.state !== 'SETTLED') {
    return 'PENDING';
  }
  const posted = refunds.filter((row) => row.state === 'POSTED');
  if (posted.length === 0) {
    return 'CAPTURED';
  }
  const refunded = posted.reduce((sum, row) => sum + row.amount.minorUnits, 0n);
  if (refunded >= clearing.amount.minorUnits) {
    return 'REFUNDED';
  }
  return 'PARTIALLY_REFUNDED';
}
