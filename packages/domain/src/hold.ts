import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import type { CurrencyCode } from './currency.ts';
import type { UtcInstant } from './time.ts';

export type HoldId = Brand<string, 'HoldId'>;

export function asHoldId(value: string): HoldId {
  if (value.length === 0) {
    throw new TypeError('HoldId must be a non-empty string');
  }
  return brandAs<string, 'HoldId'>(value);
}

/**
 * Why funds are reserved. CARD_AUTHORIZATION and FX_RESERVATION are tags
 * for later chunks. This chunk does not execute cards or FX.
 */
export const HOLD_PURPOSES = [
  'OUTGOING_TRANSFER',
  'CARD_AUTHORIZATION',
  'COMPLIANCE',
  'WITHDRAWAL',
  'FX_RESERVATION',
] as const;

export type HoldPurpose = (typeof HOLD_PURPOSES)[number];

export const HOLD_STATES = ['ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED', 'CANCELLED'] as const;

export type HoldState = (typeof HOLD_STATES)[number];

export type FundsHold = {
  readonly id: HoldId;
  readonly accountId: AccountId;
  readonly currency: CurrencyCode;
  readonly amountMinorUnits: bigint;
  readonly purpose: HoldPurpose;
  readonly state: HoldState;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly captureJournalId: string | null;
  readonly epoch: number;
};

export function freezeHold(hold: FundsHold): FundsHold {
  if (typeof hold.amountMinorUnits !== 'bigint') {
    throw new TypeError('hold amount must be bigint minor units');
  }
  if (hold.amountMinorUnits <= 0n) {
    throw new TypeError('hold amount must be a positive integer of minor units');
  }
  return Object.freeze({ ...hold });
}

export function isHoldState(value: unknown): value is HoldState {
  return typeof value === 'string' && (HOLD_STATES as readonly string[]).includes(value);
}

export function isHoldPurpose(value: unknown): value is HoldPurpose {
  return typeof value === 'string' && (HOLD_PURPOSES as readonly string[]).includes(value);
}

export function isActiveHold(hold: FundsHold, now: UtcInstant): boolean {
  if (hold.state !== 'ACTIVE') {
    return false;
  }
  if (hold.expiresAt !== null && hold.expiresAt <= now) {
    return false;
  }
  return true;
}

const TERMINAL: ReadonlySet<HoldState> = new Set(['CAPTURED', 'RELEASED', 'EXPIRED', 'CANCELLED']);

export function canTransitionHold(from: HoldState, to: HoldState): boolean {
  if (from === to) {
    return false;
  }
  if (from !== 'ACTIVE') {
    return false;
  }
  return TERMINAL.has(to);
}
