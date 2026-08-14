import type { AccountClass } from './account-class.ts';
import type { CustomerId } from './customer.ts';
import type { Currency, CurrencyCode } from './currency.ts';
import type { AccountId } from './ids.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';
import type { ProductId } from './product.ts';
import { err, ok, type Result } from './result.ts';
import type { UtcInstant } from './time.ts';

/**
 * Ledger fabric classes used by payments and the Universal Ledger.
 * Distinct from product catalog classes in account-class.ts.
 * PYR uses its own asset class in @solstice/pyr-ledger and is not
 * a fiat deposit, investment, or reward account.
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

export const ACCOUNT_STATUSES = ['OPEN', 'FROZEN', 'CLOSED'] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Customer or house account. Balance is never stored; it is summed
 * from ledger journals at read time.
 *
 * `ownerCustomerId` is the Phase 2/3 ledger owner (`HOUSE` for nostro).
 * `ownerId` is the Phase 1 customer owner. Both are populated so the
 * two call sites stay compatible. They are never a PYR holder class.
 */
export type Account = {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly ownerId: CustomerId | 'HOUSE';
  readonly accountClass: AccountClass | LedgerAccountClass | string;
  readonly currency: CurrencyCode | Currency;
  readonly productId?: ProductId;
  readonly legalEntityId?: LegalEntityId;
  readonly jurisdiction?: Jurisdiction;
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

export function createAccount(input: {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly accountClass: string;
  readonly currency: CurrencyCode | Currency;
  readonly openedAt: UtcInstant;
  readonly version?: number;
}): Account {
  return Object.freeze({
    id: input.id,
    ownerCustomerId: input.ownerCustomerId,
    ownerId: input.ownerCustomerId,
    accountClass: input.accountClass,
    currency: input.currency,
    status: 'OPEN',
    openedAt: input.openedAt,
    version: input.version ?? 0,
  });
}

function freezeAccount(account: Account): Account {
  return Object.freeze({
    id: account.id,
    ownerCustomerId: account.ownerCustomerId,
    ownerId: account.ownerId,
    accountClass: account.accountClass,
    ...(account.productId === undefined ? {} : { productId: account.productId }),
    ...(account.legalEntityId === undefined ? {} : { legalEntityId: account.legalEntityId }),
    ...(account.jurisdiction === undefined ? {} : { jurisdiction: account.jurisdiction }),
    currency: account.currency,
    status: account.status,
    openedAt: account.openedAt,
    version: account.version,
  });
}

/**
 * Pure constructor for an OPEN account at version 0. This does not authorize
 * opening; services must pass Kernel authorization before calling it.
 */
export function openAccount(input: OpenAccountInput): Account {
  return freezeAccount({
    id: input.id,
    ownerCustomerId: input.ownerId,
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
