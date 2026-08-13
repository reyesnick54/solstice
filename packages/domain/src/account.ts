import type { AccountClass } from './account-class.ts';
import { type Brand, brandAs } from './brand.ts';
import type { CurrencyCode } from './currency.ts';
import type { CustomerId } from './customer.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';
import type { ProductId } from './product.ts';
import { err, ok, type Result } from './result.ts';
import type { UtcInstant } from './time.ts';
import {
  isVerifiedExecutionAuthority,
  type VerifiedExecutionAuthority,
} from '../../permissions/src/execution-authority.ts';

export type AccountId = Brand<string, 'AccountId'>;

export function asAccountId(value: string): AccountId {
  if (value.length === 0) {
    throw new TypeError('AccountId must be a non-empty string');
  }
  return brandAs<string, 'AccountId'>(value);
}

export const ACCOUNT_STATUSES = ['PENDING_OPEN', 'OPEN', 'FROZEN', 'CLOSED'] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Customer-facing account identity. There is deliberately no `balance`
 * field. Balances are derived only by summing ledger postings at read time.
 * Do not add a cached or authoritative balance here.
 */
export type Account = {
  readonly id: AccountId;
  readonly ownerId: CustomerId;
  readonly accountClass: AccountClass;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: CurrencyCode;
  readonly status: AccountStatus;
  readonly openedAt: UtcInstant;
  readonly version: number;
};

export type OpenAccountFields = {
  readonly id: AccountId;
  readonly ownerId: CustomerId;
  readonly accountClass: AccountClass;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: CurrencyCode;
  readonly openedAt: UtcInstant;
};

export type AccountOpenRejection = {
  readonly code: 'ACCOUNT_OPEN_REQUIRES_VERIFIED_AUTHORITY' | 'ACCOUNT_OPEN_AUTHORITY_SCOPE_MISMATCH';
  readonly message: string;
};

/**
 * Allowed status moves. Same-status is not a transition. CLOSED is terminal.
 */
const ALLOWED_TRANSITIONS: { readonly [S in AccountStatus]: readonly AccountStatus[] } = {
  PENDING_OPEN: ['OPEN', 'CLOSED'],
  OPEN: ['FROZEN', 'CLOSED'],
  FROZEN: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === 'string' && (ACCOUNT_STATUSES as readonly string[]).includes(value);
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
 * The only construction path for a new Account.
 *
 * Authority-free creation is structurally impossible: the first argument
 * must be a VerifiedExecutionAuthority, a type that can only be produced
 * by AuthorityIssuer.verify() (module-private symbol seal). A raw issued
 * authority, an object literal, or a missing argument will not type-check
 * and will fail the runtime seal check.
 */
export function openAccount(
  authority: VerifiedExecutionAuthority,
  fields: OpenAccountFields,
): Result<Account, AccountOpenRejection> {
  if (!isVerifiedExecutionAuthority(authority)) {
    return err(
      Object.freeze({
        code: 'ACCOUNT_OPEN_REQUIRES_VERIFIED_AUTHORITY' as const,
        message: 'Account.open requires a verified Execution Authority',
      }),
    );
  }
  if (authority.actionType !== 'OPEN_ACCOUNT') {
    return err(
      Object.freeze({
        code: 'ACCOUNT_OPEN_AUTHORITY_SCOPE_MISMATCH' as const,
        message: 'Execution Authority is not scoped to OPEN_ACCOUNT',
      }),
    );
  }
  if (authority.accountId !== fields.id) {
    return err(
      Object.freeze({
        code: 'ACCOUNT_OPEN_AUTHORITY_SCOPE_MISMATCH' as const,
        message: 'Execution Authority is scoped to a different account',
      }),
    );
  }

  return ok(
    freezeAccount({
      id: fields.id,
      ownerId: fields.ownerId,
      accountClass: fields.accountClass,
      productId: fields.productId,
      legalEntityId: fields.legalEntityId,
      jurisdiction: fields.jurisdiction,
      currency: fields.currency,
      status: 'OPEN',
      openedAt: fields.openedAt,
      version: 0,
    }),
  );
}

export function canTransitionAccountStatus(from: AccountStatus, to: AccountStatus): boolean {
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
