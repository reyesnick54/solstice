import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { UtcInstant } from './time.ts';

export type PendingSettlementId = Brand<string, 'PendingSettlementId'>;

export function asPendingSettlementId(value: string): PendingSettlementId {
  if (value.length === 0) {
    throw new TypeError('PendingSettlementId must be a non-empty string');
  }
  return brandAs<string, 'PendingSettlementId'>(value);
}

export const PENDING_SETTLEMENT_STATES = [
  'INITIATED',
  'PENDING',
  'SETTLED',
  'RETURNED',
  'REVERSED',
] as const;

export type PendingSettlementState = (typeof PENDING_SETTLEMENT_STATES)[number];

/**
 * Metadata for a PENDING_SETTLEMENT flow. Funds live on a PENDING_SETTLEMENT
 * account class. They are not mixed into settled demand-deposit balance.
 */
export type PendingSettlementRecord = {
  readonly id: PendingSettlementId;
  readonly sourceAccountId: AccountId;
  readonly pendingAccountId: AccountId;
  readonly currency: CurrencyCode;
  readonly amountMinorUnits: bigint;
  readonly state: PendingSettlementState;
  readonly initiateJournalId: string | null;
  readonly settleJournalId: string | null;
  readonly returnJournalId: string | null;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export function freezePendingSettlement(
  record: PendingSettlementRecord,
): PendingSettlementRecord {
  if (typeof record.amountMinorUnits !== 'bigint' || record.amountMinorUnits <= 0n) {
    throw new TypeError('pending settlement amount must be a positive bigint');
  }
  return Object.freeze({ ...record });
}
