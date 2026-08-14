import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { UtcInstant } from './time.ts';

export type ReconciliationItemId = Brand<string, 'ReconciliationItemId'>;

export function asReconciliationItemId(value: string): ReconciliationItemId {
  if (value.length === 0) {
    throw new TypeError('ReconciliationItemId must be a non-empty string');
  }
  return brandAs<string, 'ReconciliationItemId'>(value);
}

export const RECONCILIATION_STATUSES = [
  'MATCHED',
  'PENDING',
  'MISMATCH',
  'INVESTIGATION_REQUIRED',
] as const;

export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

/**
 * Framework for future external banking partners.
 * Differences are recorded. They are never auto-corrected.
 */
export type ReconciliationItem = {
  readonly id: ReconciliationItemId;
  readonly accountId: AccountId;
  readonly currency: CurrencyCode;
  readonly internalMinorUnits: bigint;
  readonly externalMinorUnits: bigint;
  readonly differenceMinorUnits: bigint;
  readonly status: ReconciliationStatus;
  readonly externalStatementRef: string;
  readonly note: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export function freezeReconciliationItem(item: ReconciliationItem): ReconciliationItem {
  if (
    typeof item.internalMinorUnits !== 'bigint' ||
    typeof item.externalMinorUnits !== 'bigint' ||
    typeof item.differenceMinorUnits !== 'bigint'
  ) {
    throw new TypeError('reconciliation amounts must be bigint minor units');
  }
  return Object.freeze({ ...item });
}

export function isReconciliationStatus(value: unknown): value is ReconciliationStatus {
  return typeof value === 'string' && (RECONCILIATION_STATUSES as readonly string[]).includes(value);
}
