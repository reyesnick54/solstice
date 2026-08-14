import type { AccountClass } from './account-class.ts';
import { type Brand, brandAs } from './brand.ts';
import type { Currency } from './currency.ts';
import type { CustomerId } from './customer.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';
import type { ProductId } from './product.ts';
import { err, ok, type Result } from './result.ts';
import type { UtcInstant } from './time.ts';

export type AccountId = Brand<string, 'AccountId'>;

export function asAccountId(value: string): AccountId {
  if (value.length === 0) {
    throw new TypeError('AccountId must be a non-empty string');
  }
  return brandAs<string, 'AccountId'>(value);
}

export const ACCOUNT_STATUSES = ['OPEN', 'FROZEN', 'CLOSED'] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Customer account bound to one class, product, legal entity, and jurisdiction.
 * Balances are derived from the ledger and are never stored on this entity.
 */
export type Account = {
  readonly id: AccountId;
  readonly ownerId: CustomerId;
  readonly accountClass: AccountClass;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: Currency;
  readonly status: AccountStatus;
  readonly openedAt: UtcInstant;
  readonly version: number;
};

export type OpenAccountInput = {
  readonly id: AccountId;
  readonly ownerId: CustomerId;
  readonly accountClass: AccountClass;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: Currency;
  readonly openedAt: UtcInstant;
};

/**
 * Allowed status moves. Same-status is not a transition. CLOSED is terminal.
 */
const ALLOWED_TRANSITIONS: { readonly [S in AccountStatus]: readonly AccountStatus[] } = {
  OPEN: ['FROZEN', 'CLOSED'],
  FROZEN: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    typeof value === 'string' && (ACCOUNT_STATUSES as readonly string[]).includes(value)
  );
}

function freezeAccount(account: Account): Account {
  return Object.freeze({
    id: account.id,
    ownerId: account.ownerId,
    accountClass: account.accountClass,
    productId: account.productId,
    legalEntityId: account.legalEntityId,
    jurisdiction: account.jurisdiction,
    currency: account.currency,
    status: account.status,
    openedAt: account.openedAt,
    version: account.version,
  });
}

/**
 * Pure constructor for an OPEN account at version 0. This does not authorize
 * opening; services must pass a Kernel Execution Authority before calling it.
 */
export function openAccount(input: OpenAccountInput): Account {
  return freezeAccount({
    id: input.id,
    ownerId: input.ownerId,
    accountClass: input.accountClass,
    productId: input.productId,
    legalEntityId: input.legalEntityId,
    jurisdiction: input.jurisdiction,
    currency: input.currency,
    status: 'OPEN',
    openedAt: input.openedAt,
    version: 0,
  });
}

export function canTransitionAccountStatus(
  from: AccountStatus,
  to: AccountStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type IllegalAccountStatusTransition = {
  readonly code: 'ILLEGAL_ACCOUNT_STATUS_TRANSITION';
  readonly accountId: AccountId;
  readonly from: AccountStatus;
  readonly to: AccountStatus;
};

export type AccountStatusTransition = {
  readonly account: Account;
  readonly occurredAt: UtcInstant;
};

export type AccountStatusTransitionResult = Result<
  AccountStatusTransition,
  IllegalAccountStatusTransition
>;

/**
 * Pure, total status transition. Never throws for an illegal request:
 * those are returned as `ok: false` rejections. `occurredAt` is supplied
 * by the caller (UTC); this function does not read the clock.
 */
export function transitionAccountStatus(
  account: Account,
  requestedStatus: AccountStatus,
  occurredAt: UtcInstant,
): AccountStatusTransitionResult {
  if (!canTransitionAccountStatus(account.status, requestedStatus)) {
    return err(
      Object.freeze({
        code: 'ILLEGAL_ACCOUNT_STATUS_TRANSITION' as const,
        accountId: account.id,
        from: account.status,
        to: requestedStatus,
      }),
    );
  }

  const next = freezeAccount({
    id: account.id,
    ownerId: account.ownerId,
    accountClass: account.accountClass,
    productId: account.productId,
    legalEntityId: account.legalEntityId,
    jurisdiction: account.jurisdiction,
    currency: account.currency,
    status: requestedStatus,
    openedAt: account.openedAt,
    version: account.version + 1,
  });

  return ok(
    Object.freeze({
      account: next,
      occurredAt,
    }),
  );
}
