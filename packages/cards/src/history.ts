import { Money } from '../../money/src/money.ts';
import type { CardAuthorizationRecord } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';
import type { CardRefundRecord } from './refund.ts';

export type CardHistoryEntry = {
  readonly kind: 'AUTHORIZATION' | 'PURCHASE' | 'REFUND' | 'REVERSAL';
  readonly id: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly merchantRef: string | null;
  readonly state: string;
  readonly occurredAt: string;
};

export function cardTransactionHistory(input: {
  readonly authorizations: readonly CardAuthorizationRecord[];
  readonly clearings: readonly CardClearingRecord[];
  readonly refunds: readonly CardRefundRecord[];
}): readonly CardHistoryEntry[] {
  const entries: CardHistoryEntry[] = [];
  for (const auth of input.authorizations) {
    entries.push({
      kind: auth.state === 'REVERSED' ? 'REVERSAL' : 'AUTHORIZATION',
      id: auth.authorizationId,
      amountMinorUnits: auth.request.amount.minorUnits.toString(),
      currency: auth.request.amount.currency,
      merchantRef: auth.request.merchantRef,
      state: auth.state,
      occurredAt: auth.createdAt,
    });
  }
  for (const clearing of input.clearings) {
    entries.push({
      kind: 'PURCHASE',
      id: clearing.clearingId,
      amountMinorUnits: clearing.amount.minorUnits.toString(),
      currency: clearing.amount.currency,
      merchantRef: null,
      state: clearing.state,
      occurredAt: clearing.createdAt,
    });
  }
  for (const refund of input.refunds) {
    entries.push({
      kind: 'REFUND',
      id: refund.refundId,
      amountMinorUnits: refund.amount.minorUnits.toString(),
      currency: refund.amount.currency,
      merchantRef: null,
      state: refund.state,
      occurredAt: refund.createdAt,
    });
  }
  return Object.freeze(
    entries.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0)),
  );
}

export function historyPurchaseTotal(entries: readonly CardHistoryEntry[], currency: string): Money {
  let total = Money.zero(currency);
  for (const entry of entries) {
    if (entry.kind === 'PURCHASE' && entry.state === 'SETTLED' && entry.currency === currency) {
      total = total.plus(Money.fromMinorUnits(BigInt(entry.amountMinorUnits), currency));
    }
    if (entry.kind === 'REFUND' && entry.state === 'POSTED' && entry.currency === currency) {
      total = total.minus(Money.fromMinorUnits(BigInt(entry.amountMinorUnits), currency));
    }
  }
  return total;
}
