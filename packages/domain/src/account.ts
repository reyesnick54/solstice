import type { AccountClass } from './account-class.ts';
import type { Currency, CurrencyCode } from './currency.ts';
import type { CustomerId } from './customer.ts';
import type { AccountId } from './ids.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';
import type { ProductId } from './product.ts';
import { err, ok, type Result } from './result.ts';
import type { UtcInstant } from './time.ts';

/**
 * Ledger posting classes used by the payments fabric (Phase 2–3).
 * Distinct from legal product classes in account-class.ts.
 */
export const LEDGER_ACCOUNT_CLASSES = [
  'deposits',
  'investments',
  'digital_assets',
  'rewards',
  'pending',
  'house_nostro',
  'house_fx',
  'settlement_clearing',
  'rail_clearing',
] as const;

export type LedgerAccountClass = (typeof LEDGER_ACCOUNT_CLASSES)[number];

export type LedgerAccount = {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly accountClass: LedgerAccountClass;
  readonly currency: CurrencyCode;
  readonly openedAt: UtcInstant;
  readonly version: number;
};

/**
 * Pure ledger-account constructor. Callers must already hold Kernel
 * authorization; this function does not authorize. The executionAuthority
 * argument is required at the call site so CI can see the gate.
 */
export function createAccount(
  input: Omit<LedgerAccount, 'version'> & { version?: number },
  executionAuthority?: { readonly signature?: string; readonly permitHash?: string },
): LedgerAccount {
  void executionAuthority;
  return Object.freeze({
    id: input.id,
    ownerCustomerId: input.ownerCustomerId,
    accountClass: input.accountClass,
    currency: input.currency,
    openedAt: input.openedAt,
    version: input.version ?? 0,
  });
}

export const ACCOUNT_STATUSES = ['OPEN', 'FROZEN', 'CLOSED'] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Customer account bound to one legal class, product, legal entity, and
 * jurisdiction. Balances are derived from the ledger and are never stored
 * on this entity.
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
 * opening. Services must pass a Kernel Execution Authority before calling it.
 */
export function openAccount(
  input: OpenAccountInput,
  executionAuthority?: { readonly signature?: string; readonly authorityId?: string },
): Account {
  void executionAuthority;
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
