import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import type { CardClearingId, CardId, CardRefundId } from './ids.ts';

export const REFUND_STATES = ['RECEIVED', 'POSTED', 'DUPLICATE'] as const;
export type RefundState = (typeof REFUND_STATES)[number];

export type CardRefundRecord = {
  readonly refundId: CardRefundId;
  readonly cardId: CardId;
  readonly originalClearingId: CardClearingId | null;
  readonly amount: Money;
  readonly processorReference: string;
  readonly journalId: string | null;
  readonly state: RefundState;
  readonly createdAt: UtcInstant;
};

export function freezeRefund(record: CardRefundRecord): CardRefundRecord {
  assertNoSensitiveCardData(record, 'refund');
  if (!(record.amount instanceof Money) || !record.amount.isPositive()) {
    throw new TypeError('refund amount must be a positive Money value');
  }
  return Object.freeze({ ...record });
}
