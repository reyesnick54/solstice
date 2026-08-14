import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { CustomerId } from './customer.ts';
import type { UtcInstant } from './time.ts';

export const TRANSACTION_HISTORY_STATUSES = [
  'PENDING',
  'COMPLETED',
  'RETURNED',
  'REVERSED',
  'FAILED',
] as const;

export type TransactionHistoryStatus = (typeof TRANSACTION_HISTORY_STATUSES)[number];

/**
 * Customer-facing normalized history. Not authoritative financial state.
 */
export type TransactionHistoryItem = {
  readonly reference: string;
  readonly accountId: AccountId;
  readonly customerId: CustomerId;
  readonly status: TransactionHistoryStatus;
  readonly direction: 'CREDIT' | 'DEBIT' | 'HOLD';
  readonly amountMinorUnits: bigint;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly journalId: string | null;
  readonly holdId: string | null;
  readonly occurredAt: UtcInstant;
};

export function freezeHistoryItem(item: TransactionHistoryItem): TransactionHistoryItem {
  return Object.freeze({ ...item });
}
