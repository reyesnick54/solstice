import type { AccountRegister } from '../../../ledger/src/accounts.ts';
import type { LedgerAccount } from '../../../ledger/src/types.ts';

/**
 * Explicit acquiring / SoftPOS books. SYSTEM / SIMULATION ownership only.
 * Separate from issuing card settlement books. No unexplained plug account.
 */
export const ACCEPTANCE_TREASURY_ACCOUNT_IDS = {
  acquiringClearingUsd: 'SIMULATION.ACQUIRING_CLEARING.USD',
  acquiringProviderUsd: 'SIMULATION.ACQUIRING_PROVIDER.USD',
  acquiringFeeIncomeUsd: 'CORPORATE.ACQUIRING_FEE_INCOME.USD',
} as const;

export function registerAcceptanceTreasuryBooks(register: AccountRegister): void {
  const books: readonly LedgerAccount[] = [
    sys(ACCEPTANCE_TREASURY_ACCOUNT_IDS.acquiringClearingUsd, 'Acquiring clearing USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(ACCEPTANCE_TREASURY_ACCOUNT_IDS.acquiringProviderUsd, 'SoftPOS provider settlement USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(ACCEPTANCE_TREASURY_ACCOUNT_IDS.acquiringFeeIncomeUsd, 'Corporate acquiring fee income USD', 'CORPORATE_OPERATING', 'USD'),
  ];
  for (const book of books) {
    register.registerSystemAccount(book);
  }
}

function sys(
  id: string,
  name: string,
  accountClass: LedgerAccount['accountClass'],
  currency: string,
): LedgerAccount {
  return Object.freeze({ id, name, accountClass, currency });
}

export function acquiringClearingAccountId(currency: string): string {
  return `SIMULATION.ACQUIRING_CLEARING.${currency}`;
}

export function acquiringProviderAccountId(currency: string): string {
  return `SIMULATION.ACQUIRING_PROVIDER.${currency}`;
}

export function acquiringFeeIncomeAccountId(currency: string): string {
  return `CORPORATE.ACQUIRING_FEE_INCOME.${currency}`;
}
