import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { CustomerId } from './customer.ts';
import type { UtcInstant } from './time.ts';

export type CustomerActivityId = Brand<string, 'CustomerActivityId'>;

export function asCustomerActivityId(value: string): CustomerActivityId {
  if (value.length === 0) {
    throw new TypeError('CustomerActivityId must be a non-empty string');
  }
  return brandAs<string, 'CustomerActivityId'>(value);
}

/**
 * Normalized consumer activity statuses. Domain statuses map onto these.
 * Failed or pending states are never rewritten as completed for UI convenience.
 */
export const CONSUMER_ACTIVITY_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REVERSED',
  'CANCELLED',
  'ACTION_REQUIRED',
] as const;

export type ConsumerActivityStatus = (typeof CONSUMER_ACTIVITY_STATUSES)[number];

export const CONSUMER_ACTIVITY_TYPES = [
  'INTERNAL_TRANSFER',
  'BANK_PAYMENT',
  'FX',
  'CARD',
  'FEE',
  'INVESTMENT',
  'EXCHANGE',
  'CUSTODY',
  'DEPOSIT',
  'WITHDRAWAL',
  'HOLD',
  'INTEREST',
  'REVERSAL',
  'OTHER',
] as const;

export type ConsumerActivityType = (typeof CONSUMER_ACTIVITY_TYPES)[number];

export const CONSUMER_ACTIVITY_DIRECTIONS = ['IN', 'OUT', 'HOLD'] as const;
export type ConsumerActivityDirection = (typeof CONSUMER_ACTIVITY_DIRECTIONS)[number];

export const CONSUMER_ACTIVITY_CATEGORIES = [
  'TRANSFER',
  'PAYMENT',
  'FUNDING',
  'FEE',
  'INVESTMENT',
  'EXCHANGE',
  'CARD',
  'COMPLIANCE',
  'OTHER',
] as const;

export type ConsumerActivityCategory = (typeof CONSUMER_ACTIVITY_CATEGORIES)[number];

/**
 * Customer-facing activity resource. Ledger journal ids stay internal.
 */
export type CustomerActivityItem = {
  readonly activityId: CustomerActivityId;
  readonly accountId: AccountId;
  readonly customerId: CustomerId;
  readonly type: ConsumerActivityType;
  readonly direction: ConsumerActivityDirection;
  readonly amountMinorUnits: bigint;
  readonly currency: CurrencyCode;
  readonly status: ConsumerActivityStatus;
  readonly counterpartyDisplay: string | null;
  readonly description: string;
  readonly occurredAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly feeMinorUnits: bigint | null;
  readonly feeCurrency: CurrencyCode | null;
  readonly reference: string;
  readonly category: ConsumerActivityCategory;
  readonly relatedActionId: string | null;
  readonly journalId: string | null;
};

export function isConsumerActivityStatus(value: unknown): value is ConsumerActivityStatus {
  return typeof value === 'string' && (CONSUMER_ACTIVITY_STATUSES as readonly string[]).includes(value);
}

export function isConsumerActivityType(value: unknown): value is ConsumerActivityType {
  return typeof value === 'string' && (CONSUMER_ACTIVITY_TYPES as readonly string[]).includes(value);
}

export function freezeCustomerActivityItem(item: CustomerActivityItem): CustomerActivityItem {
  return Object.freeze({ ...item });
}
