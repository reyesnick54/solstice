import type { Account } from '../../../../packages/domain/src/account.ts';
import { ACCOUNT_CLASS_CATALOG } from '../../../../packages/domain/src/account-class.ts';
import type { CustomerId } from '../../../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { isOk } from '../../../../packages/domain/src/result.ts';
import type { SimulationRuntime } from '../../../accounts/src/runtime.ts';
import {
  projectCurrencyIndexedPosition,
  projectCustomerPosition,
} from '../../../accounts/src/balances.ts';
import { projectBankingPosition } from '../../../accounts/src/available-funds.ts';
import { projectTransactionHistory } from '../../../accounts/src/transaction-history.ts';
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
    positionOf(account) {
      const projected = projectBankingPosition(runtime.ledger, account, runtime.holds, runtime.clock.now());
      if (!isOk(projected)) {
        return { unavailable: 'MIXED_CURRENCY' };
      }
      return projected.value;
    },
    customerPosition(customerId) {
      const owned = runtime.accounts.list().filter((account) => account.ownerId === customerId);
      const blended = projectCustomerPosition(runtime.ledger, customerId as CustomerId, owned);
      if (isOk(blended)) {
        return { kind: 'POSITION', position: blended.value };
      }
      const indexed = projectCurrencyIndexedPosition(runtime.ledger, customerId as CustomerId, owned);
      if (isOk(indexed) && indexed.value.currencies.length > 0) {
        return { kind: 'CURRENCY_INDEXED', currencies: indexed.value.currencies };
      }
      return { kind: 'UNAVAILABLE', reason: blended.error.message };
    },
    activity(customerId, accountId) {
      const owned = runtime.accounts.list().filter((account) => account.ownerId === customerId);
      const items = projectTransactionHistory({
        ledger: runtime.ledger,
        customerId: customerId as CustomerId,
        accounts: owned,
        holds: owned.flatMap((account) => runtime.holds.listByAccount(account.id)),
        pending: [],
        now: asUtcInstant(runtime.clock.now()),
      });
      const filtered = accountId ? items.filter((item) => item.accountId === accountId) : items;
      return [...filtered].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
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
