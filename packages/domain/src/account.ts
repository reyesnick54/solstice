import type { AccountClass as SegregatedAccountClass } from './account-class.ts';
import type { CustomerId } from './customer.ts';
import type { Currency, CurrencyCode } from './currency.ts';
import type { AccountId } from './ids.ts';
import { asAccountId } from './ids.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';
import type { ProductId } from './product.ts';
import { err, ok, type Result } from './result.ts';
import type { UtcInstant } from './time.ts';

/**
 * Ledger account classes used by the simulated bank and Pyramid Exchange.
 * Segregated Phase-1 class names live in account-class.ts.
 */
export const LEDGER_ACCOUNT_CLASSES = [
  'deposits',
  'investments',
  'digital_assets',
  'rewards',
  'pending',
  'house_nostro',
  'house_fx',
  'house_fee',
  'settlement_clearing',
  'rail_clearing',
] as const;

export type LedgerAccountClass = (typeof LEDGER_ACCOUNT_CLASSES)[number];

export type AccountClass = LedgerAccountClass | SegregatedAccountClass | string;

export const ACCOUNT_STATUSES = ['OPEN', 'FROZEN', 'CLOSED'] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Customer or house account. Balances are derived from the ledger and are
 * never stored on this entity.
 */
export type Account = {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly ownerId: CustomerId | 'HOUSE';
  readonly accountClass: AccountClass;
  readonly currency: CurrencyCode;
  readonly openedAt: UtcInstant;
  readonly version: number;
  readonly status: AccountStatus;
  readonly productId?: ProductId;
  readonly legalEntityId?: LegalEntityId;
  readonly jurisdiction?: Jurisdiction;
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

export type CreateLedgerAccountInput = {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly accountClass: AccountClass;
  readonly currency: CurrencyCode;
  readonly openedAt: UtcInstant;
  readonly version?: number;
};

function freezeAccount(account: Account): Account {
  return Object.freeze({
    id: account.id,
    ownerCustomerId: account.ownerCustomerId,
    ownerId: account.ownerId,
    accountClass: account.accountClass,
    currency: account.currency,
    openedAt: account.openedAt,
    version: account.version,
    status: account.status,
    ...(account.productId === undefined ? {} : { productId: account.productId }),
    ...(account.legalEntityId === undefined ? {} : { legalEntityId: account.legalEntityId }),
    ...(account.jurisdiction === undefined ? {} : { jurisdiction: account.jurisdiction }),
  });
}

/**
 * Ledger-path constructor used by payments and the exchange.
 * Does not authorize opening; callers must pass Kernel authorization first.
 */
export function createAccount(
  input: CreateLedgerAccountInput,
  executionAuthority?: unknown,
): Account {
  void executionAuthority;
  return freezeAccount({
    id: input.id,
    ownerCustomerId: input.ownerCustomerId,
    ownerId: input.ownerCustomerId,
    accountClass: input.accountClass,
    currency: input.currency,
    openedAt: input.openedAt,
    version: input.version ?? 0,
    status: 'OPEN',
  });
}

/**
 * Pure constructor for an OPEN account at version 0 (Phase 1 path).
 * This does not authorize opening; services must pass Execution Authority first.
 */
export function openAccount(input: OpenAccountInput): Account {
  return freezeAccount({
    id: input.id,
    ownerCustomerId: input.ownerId,
    ownerId: input.ownerId,
    accountClass: input.accountClass,
    currency: input.currency,
    openedAt: input.openedAt,
    version: 0,
    status: 'OPEN',
    productId: input.productId,
    legalEntityId: input.legalEntityId,
    jurisdiction: input.jurisdiction,
  });
}

const ALLOWED_TRANSITIONS: { readonly [S in AccountStatus]: readonly AccountStatus[] } = {
  OPEN: ['FROZEN', 'CLOSED'],
  FROZEN: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === 'string' && (ACCOUNT_STATUSES as readonly string[]).includes(value);
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
    ...account,
    status: requestedStatus,
    version: account.version + 1,
  });

  return ok(
    Object.freeze({
      account: next,
      occurredAt,
    }),
  );
}

export { asAccountId };
