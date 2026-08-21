import { CANONICAL_SIMULATION_CURRENCIES } from '../../domain/src/currency.ts';
import type { AccountRegister } from '../../ledger/src/accounts.ts';
import type { LedgerAccount } from '../../ledger/src/types.ts';

/**
 * Simulation treasury / FX books. SYSTEM or SIMULATION ownership only.
 * Never commingled with customer funds in a journal that also posts CORPORATE
 * against CUSTOMER.
 */
export const TREASURY_ACCOUNT_IDS = {
  pendingUsd: 'SIMULATION.PENDING_SETTLEMENT.USD',
  pendingSar: 'SIMULATION.PENDING_SETTLEMENT.SAR',
  treasuryUsd: 'SIMULATION.TREASURY.USD',
  treasurySar: 'SIMULATION.TREASURY.SAR',
  fxClearingUsd: 'SIMULATION.FX_CLEARING.USD',
  fxClearingSar: 'SIMULATION.FX_CLEARING.SAR',
  settlementUsd: 'SIMULATION.SETTLEMENT.USD',
  settlementSar: 'SIMULATION.SETTLEMENT.SAR',
  feeClearingUsd: 'SIMULATION.FEE_CLEARING.USD',
  feeClearingSar: 'SIMULATION.FEE_CLEARING.SAR',
  feeIncomeUsd: 'CORPORATE.FEE_INCOME.USD',
  feeIncomeSar: 'CORPORATE.FEE_INCOME.SAR',
  fxDifferenceUsd: 'SIMULATION.FX_DIFFERENCE.USD',
  beneficiaryPayableUsd: 'SIMULATION.BENEFICIARY_PAYABLE.USD',
  beneficiaryPayableSar: 'SIMULATION.BENEFICIARY_PAYABLE.SAR',
} as const;

export function registerPaymentTreasuryBooks(register: AccountRegister): void {
  const books: LedgerAccount[] = [];
  for (const currency of CANONICAL_SIMULATION_CURRENCIES) {
    books.push(
      sys(pendingAccountId(currency), `Pending settlement ${currency}`, 'PENDING_SETTLEMENT', currency),
      sys(treasuryAccountId(currency), `Simulation ${currency} funding treasury`, 'SIMULATED_FUNDING_SOURCE', currency),
      sys(fxClearingAccountId(currency), `Simulation FX clearing ${currency}`, 'SIMULATED_FUNDING_SOURCE', currency),
      sys(settlementAccountId(currency), `Simulation ${currency} settlement`, 'SIMULATED_FUNDING_SOURCE', currency),
      sys(feeClearingAccountId(currency), `Simulation ${currency} fee clearing`, 'SIMULATED_FUNDING_SOURCE', currency),
      sys(feeIncomeAccountId(currency), `Corporate ${currency} fee income`, 'CORPORATE_OPERATING', currency),
      sys(beneficiaryPayableAccountId(currency), `Simulation ${currency} beneficiary payable`, 'SIMULATED_FUNDING_SOURCE', currency),
    );
  }
  books.push(sys(TREASURY_ACCOUNT_IDS.fxDifferenceUsd, 'Simulation FX difference USD', 'SIMULATED_FUNDING_SOURCE', 'USD'));
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

export function pendingAccountId(currency: string): string {
  return `SIMULATION.PENDING_SETTLEMENT.${currency}`;
}

export function treasuryAccountId(currency: string): string {
  return `SIMULATION.TREASURY.${currency}`;
}

export function fxClearingAccountId(currency: string): string {
  return `SIMULATION.FX_CLEARING.${currency}`;
}

export function settlementAccountId(currency: string): string {
  return `SIMULATION.SETTLEMENT.${currency}`;
}

export function feeClearingAccountId(currency: string): string {
  return `SIMULATION.FEE_CLEARING.${currency}`;
}

export function feeIncomeAccountId(currency: string): string {
  return `CORPORATE.FEE_INCOME.${currency}`;
}

export function beneficiaryPayableAccountId(currency: string): string {
  return `SIMULATION.BENEFICIARY_PAYABLE.${currency}`;
}
