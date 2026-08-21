import type { Account, AccountStatus } from '../../../packages/domain/src/account.ts';
import type { AccountClass } from '../../../packages/domain/src/account-class.ts';
import type { AccountRestriction } from '../../../packages/domain/src/account-restriction.ts';
import type { CurrencyCode } from '../../../packages/domain/src/currency.ts';
import type { CustomerId } from '../../../packages/domain/src/customer.ts';
import type { Jurisdiction } from '../../../packages/domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../packages/domain/src/time.ts';

/**
 * Customer-facing product types. These are product labels, not a licensed
 * bank-account claim and not a second account-class taxonomy.
 */
export const FINANCIAL_PRODUCT_TYPES = [
  'CASH_ACCOUNT',
  'CHECKING_PAYMENT',
  'SAVINGS',
  'MULTI_CURRENCY',
  'INVESTMENT_CASH',
  'EXCHANGE_CASH',
] as const;

export type FinancialProductType = (typeof FINANCIAL_PRODUCT_TYPES)[number];

/**
 * Server-controlled customer lifecycle. Domain AccountStatus remains the
 * ledger identity status. This overlay is derived, then persisted when
 * CLOSING or when closedAt is set.
 */
export const FINANCIAL_ACCOUNT_LIFECYCLES = [
  'PENDING',
  'ACTIVE',
  'RESTRICTED',
  'FROZEN',
  'CLOSING',
  'CLOSED',
] as const;

export type FinancialAccountLifecycle = (typeof FINANCIAL_ACCOUNT_LIFECYCLES)[number];

export type FinancialAccountProviderLink = {
  readonly providerId: string;
  readonly externalRef: string;
  readonly status: 'RESERVED' | 'UNBOUND';
};

export type FinancialAccountOverlay = {
  readonly accountId: Account['id'];
  readonly lifecycle: FinancialAccountLifecycle | null;
  readonly closedAt: UtcInstant | null;
  readonly providerLink: FinancialAccountProviderLink | null;
  readonly metadata: Readonly<Record<string, string>>;
};

export type CustomerFinancialAccount = {
  readonly accountId: Account['id'];
  readonly owner: {
    readonly customerId: CustomerId;
    readonly ownershipKind: 'INDIVIDUAL';
  };
  readonly productType: FinancialProductType;
  readonly productId: string;
  readonly accountClass: AccountClass;
  readonly currency: CurrencyCode;
  readonly status: FinancialAccountLifecycle;
  readonly domainStatus: AccountStatus;
  readonly openedAt: UtcInstant;
  readonly closedAt: UtcInstant | null;
  readonly jurisdiction: Jurisdiction;
  readonly providerLink: FinancialAccountProviderLink | null;
  readonly ledgerAccountReferences: readonly string[];
  readonly restrictions: readonly AccountRestriction[];
  readonly metadata: Readonly<Record<string, string>>;
  readonly productConfiguration: {
    readonly licensingClaim: 'NOT_A_LICENSED_BANK_ACCOUNT';
    readonly environment: 'simulation';
    readonly liveBanking: false;
  };
};

export function productTypeOf(accountClass: AccountClass): FinancialProductType {
  switch (accountClass) {
    case 'DEMAND_DEPOSIT':
      return 'CHECKING_PAYMENT';
    case 'SAVINGS_DEPOSIT':
    case 'TIME_DEPOSIT':
      return 'SAVINGS';
    case 'BROKERAGE_CASH':
      return 'INVESTMENT_CASH';
    case 'DIGITAL_ASSET_CUSTODY':
    case 'STABLECOIN_CUSTODY':
      return 'EXCHANGE_CASH';
    default:
      return 'CASH_ACCOUNT';
  }
}

export function deriveLifecycle(
  domainStatus: AccountStatus,
  restrictions: readonly AccountRestriction[],
  overlay: FinancialAccountOverlay | null,
): FinancialAccountLifecycle {
  if (overlay?.lifecycle === 'CLOSING' && domainStatus !== 'CLOSED') {
    return 'CLOSING';
  }
  if (domainStatus === 'PENDING_OPEN') {
    return 'PENDING';
  }
  if (domainStatus === 'FROZEN') {
    return 'FROZEN';
  }
  if (domainStatus === 'CLOSED') {
    return 'CLOSED';
  }
  if (restrictions.some((restriction) => restriction.state === 'ACTIVE')) {
    return 'RESTRICTED';
  }
  return 'ACTIVE';
}

export function freezeFinancialAccount(account: CustomerFinancialAccount): CustomerFinancialAccount {
  return Object.freeze({
    ...account,
    owner: Object.freeze({ ...account.owner }),
    ledgerAccountReferences: Object.freeze([...account.ledgerAccountReferences]),
    restrictions: Object.freeze([...account.restrictions]),
    metadata: Object.freeze({ ...account.metadata }),
    productConfiguration: Object.freeze({ ...account.productConfiguration }),
    providerLink: account.providerLink ? Object.freeze({ ...account.providerLink }) : null,
  });
}

export function assembleFinancialAccount(
  account: Account,
  restrictions: readonly AccountRestriction[],
  overlay: FinancialAccountOverlay | null,
): CustomerFinancialAccount {
  return freezeFinancialAccount({
    accountId: account.id,
    owner: {
      customerId: account.ownerId,
      ownershipKind: 'INDIVIDUAL',
    },
    productType: productTypeOf(account.accountClass),
    productId: account.productId,
    accountClass: account.accountClass,
    currency: account.currency,
    status: deriveLifecycle(account.status, restrictions, overlay),
    domainStatus: account.status,
    openedAt: account.openedAt,
    closedAt: overlay?.closedAt ?? null,
    jurisdiction: account.jurisdiction,
    providerLink: overlay?.providerLink ?? null,
    ledgerAccountReferences: Object.freeze([account.id]),
    restrictions: restrictions.filter((row) => row.accountId === account.id),
    metadata: overlay?.metadata ?? Object.freeze({}),
    productConfiguration: {
      licensingClaim: 'NOT_A_LICENSED_BANK_ACCOUNT',
      environment: 'simulation',
      liveBanking: false,
    },
  });
}
