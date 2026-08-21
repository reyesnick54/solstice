import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { UtcInstant } from './time.ts';

export type AccountRestrictionId = Brand<string, 'AccountRestrictionId'>;

export function asAccountRestrictionId(value: string): AccountRestrictionId {
  if (value.length === 0) {
    throw new TypeError('AccountRestrictionId must be a non-empty string');
  }
  return brandAs<string, 'AccountRestrictionId'>(value);
}

/**
 * Server-side account restrictions. These are not UI flags.
 * Money-movement services must consult them; a frontend cannot lift them.
 */
export const ACCOUNT_RESTRICTION_CODES = [
  'DEBIT_BLOCKED',
  'CREDIT_BLOCKED',
  'WITHDRAWAL_BLOCKED',
  'TRANSFER_BLOCKED',
  'TRADING_BLOCKED',
  'CARD_BLOCKED',
  'COMPLIANCE_REVIEW',
] as const;

export type AccountRestrictionCode = (typeof ACCOUNT_RESTRICTION_CODES)[number];

export const ACCOUNT_RESTRICTION_STATES = ['ACTIVE', 'RELEASED'] as const;
export type AccountRestrictionState = (typeof ACCOUNT_RESTRICTION_STATES)[number];

export type AccountRestriction = {
  readonly id: AccountRestrictionId;
  readonly accountId: AccountId;
  readonly code: AccountRestrictionCode;
  readonly state: AccountRestrictionState;
  readonly reason: string;
  readonly appliedAt: UtcInstant;
  readonly releasedAt: UtcInstant | null;
  readonly appliedByActorId: string;
};

export function isAccountRestrictionCode(value: unknown): value is AccountRestrictionCode {
  return typeof value === 'string' && (ACCOUNT_RESTRICTION_CODES as readonly string[]).includes(value);
}

export function freezeAccountRestriction(restriction: AccountRestriction): AccountRestriction {
  return Object.freeze({ ...restriction });
}
