import type { Account } from '../../../../packages/domain/src/account.ts';
import { ACCOUNT_CLASS_CATALOG } from '../../../../packages/domain/src/account-class.ts';
import type { CustomerId } from '../../../../packages/domain/src/customer.ts';
import { isOk } from '../../../../packages/domain/src/result.ts';
import type { UtcInstant } from '../../../../packages/domain/src/time.ts';
import type { SimulationRuntime } from '../../../accounts/src/runtime.ts';
import { projectBankingPosition } from '../../../accounts/src/available-funds.ts';
import type { ActivityFilter } from '../../../accounts/src/activity.ts';
import type { AccountsReadPort } from './ports.ts';

export function createAccountsReadAdapter(runtime: SimulationRuntime): AccountsReadPort {
  return {
    getCustomer(customerId) {
      return runtime.customers.get(customerId as CustomerId) ?? null;
    },
    listAccounts(customerId) {
      return runtime.accounts
        .list()
        .filter((account) => account.ownerId === customerId)
        .sort((a, b) => a.id.localeCompare(b.id));
    },
    getAccount(accountId) {
      return runtime.accounts.get(accountId as Account['id']) ?? null;
    },
    financialAccount(accountId) {
      return runtime.accountProduct.get(accountId) ?? null;
    },
    listFinancialAccounts(customerId) {
      return runtime.accountProduct.listForCustomer(customerId);
    },
    authorizeRead(accountId, customerId, subjectId) {
      const authorized = runtime.accountProduct.authorizeRead(accountId, customerId, subjectId);
      if (!isOk(authorized)) {
        return { error: authorized.error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'RESOURCE_NOT_OWNED' };
      }
      return authorized.value;
    },
    positionOf(account) {
      const projected = projectBankingPosition(runtime.ledger, account, runtime.holds, runtime.clock.now());
      if (!isOk(projected)) {
        return { unavailable: 'MIXED_CURRENCY' };
      }
      return projected.value;
    },
    wealth(customerId, valuationCurrency) {
      return runtime.accountProduct.wealth(customerId, valuationCurrency);
    },
    activity(customerId, accountId, filter?: ActivityFilter) {
      return runtime.accountProduct.activity(customerId, accountId, filter ?? {});
    },
    statement(accountId, periodStart, periodEnd) {
      const generated = runtime.accountProduct.statement({
        accountId,
        periodStart,
        periodEnd,
      });
      if (!isOk(generated)) {
        return { error: generated.error.message };
      }
      return generated.value;
    },
  };
}

export function consumerAccountTypeOf(account: Account): 'CASH' | 'SAVINGS' | 'INVESTMENT' | 'DIGITAL_ASSET' | 'REWARDS' | 'PENDING' | 'OTHER' {
  const bucket = ACCOUNT_CLASS_CATALOG[account.accountClass].positionBucket;
  if (account.accountClass === 'SAVINGS_DEPOSIT' || account.accountClass === 'TIME_DEPOSIT') {
    return 'SAVINGS';
  }
  switch (bucket) {
    case 'deposits':
      return 'CASH';
    case 'investments':
      return 'INVESTMENT';
    case 'digital_assets':
      return 'DIGITAL_ASSET';
    case 'rewards':
      return 'REWARDS';
    case 'pending':
      return 'PENDING';
    default:
      return 'OTHER';
  }
}

export type { UtcInstant };
