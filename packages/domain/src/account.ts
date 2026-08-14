import type { AccountClass as ProductAccountClass } from './account-class.ts';
import { type Brand, brandAs } from './brand.ts';
import type { Currency, CurrencyCode } from './currency.ts';
import type { CustomerId } from './customer.ts';
import type { AccountId as IdAccountId } from './ids.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';
import type { ProductId } from './product.ts';
import { err, ok, type Result } from './result.ts';
import type { UtcInstant } from './time.ts';

export type AccountId = IdAccountId & Brand<string, 'AccountId'>;

export function asAccountId(value: string): AccountId {
  if (value.length === 0) {
    throw new TypeError('AccountId must be a non-empty string');
  }
  return brandAs<string, 'AccountId'>(value);
}

export const BANKING_ACCOUNT_CLASSES = [
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

export type BankingAccountClass = (typeof BANKING_ACCOUNT_CLASSES)[number];

export const ACCOUNT_STATUSES = ['OPEN', 'FROZEN', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Customer or house account. Balances are never stored here.
 * Phase 1 fields (ownerId, product, status) and Phase 2/3 fields
 * (ownerCustomerId, banking class) coexist on one frozen record.
 */
export type Account = {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly ownerId: CustomerId | 'HOUSE';
  readonly accountClass: ProductAccountClass | BankingAccountClass | string;
  readonly currency: CurrencyCode;
  readonly openedAt: UtcInstant;
  readonly version: number;
  readonly productId?: ProductId;
  readonly legalEntityId?: LegalEntityId;
  readonly jurisdiction?: Jurisdiction;
  readonly status: AccountStatus;
};

export function createAccount(input: {
  readonly id: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly accountClass: string;
  readonly currency: CurrencyCode | string;
  readonly openedAt: UtcInstant;
  readonly version?: number;
}): Account {
  return Object.freeze({
    id: input.id,
    ownerCustomerId: input.ownerCustomerId,
    ownerId: input.ownerCustomerId,
    accountClass: input.accountClass,
    currency: input.currency as CurrencyCode,
    openedAt: input.openedAt,
    version: input.version ?? 0,
    status: 'OPEN',
  });
}

export type OpenAccountInput = {
  readonly id: AccountId;
  readonly ownerId: CustomerId;
  readonly accountClass: ProductAccountClass;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: Currency;
  readonly openedAt: UtcInstant;
};

export function openAccount(input: OpenAccountInput): Account {
  return Object.freeze({
    id: input.id,
    ownerCustomerId: input.ownerId,
    ownerId: input.ownerId,
    accountClass: input.accountClass,
    currency: input.currency,
    openedAt: input.openedAt,
    version: 0,
    productId: input.productId,
    legalEntityId: input.legalEntityId,
    jurisdiction: input.jurisdiction,
    status: 'OPEN',
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
  const next = Object.freeze({
    ...account,
    status: requestedStatus,
    version: account.version + 1,
  });
  return ok(Object.freeze({ account: next, occurredAt }));
}
