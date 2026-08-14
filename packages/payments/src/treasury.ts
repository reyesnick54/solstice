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
  const books: readonly LedgerAccount[] = [
    sys(TREASURY_ACCOUNT_IDS.pendingUsd, 'Pending settlement USD', 'PENDING_SETTLEMENT', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.pendingSar, 'Pending settlement SAR', 'PENDING_SETTLEMENT', 'SAR'),
    sys(TREASURY_ACCOUNT_IDS.treasuryUsd, 'Simulation USD funding treasury', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.treasurySar, 'Simulation SAR funding treasury', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
    sys(TREASURY_ACCOUNT_IDS.fxClearingUsd, 'Simulation FX clearing USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.fxClearingSar, 'Simulation FX clearing SAR', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
    sys(TREASURY_ACCOUNT_IDS.settlementUsd, 'Simulation USD settlement', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.settlementSar, 'Simulation SAR settlement', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
    sys(TREASURY_ACCOUNT_IDS.feeClearingUsd, 'Simulation USD fee clearing', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.feeClearingSar, 'Simulation SAR fee clearing', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
    sys(TREASURY_ACCOUNT_IDS.feeIncomeUsd, 'Corporate USD fee income', 'CORPORATE_OPERATING', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.feeIncomeSar, 'Corporate SAR fee income', 'CORPORATE_OPERATING', 'SAR'),
    sys(TREASURY_ACCOUNT_IDS.fxDifferenceUsd, 'Simulation FX difference USD', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.beneficiaryPayableUsd, 'Simulation USD beneficiary payable', 'SIMULATED_FUNDING_SOURCE', 'USD'),
    sys(TREASURY_ACCOUNT_IDS.beneficiaryPayableSar, 'Simulation SAR beneficiary payable', 'SIMULATED_FUNDING_SOURCE', 'SAR'),
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

export function pendingAccountId(currency: string): string {
  return currency === 'SAR' ? TREASURY_ACCOUNT_IDS.pendingSar : TREASURY_ACCOUNT_IDS.pendingUsd;
}

export function treasuryAccountId(currency: string): string {
  return currency === 'SAR' ? TREASURY_ACCOUNT_IDS.treasurySar : TREASURY_ACCOUNT_IDS.treasuryUsd;
}

export function fxClearingAccountId(currency: string): string {
  return currency === 'SAR' ? TREASURY_ACCOUNT_IDS.fxClearingSar : TREASURY_ACCOUNT_IDS.fxClearingUsd;
}

export function settlementAccountId(currency: string): string {
  return currency === 'SAR' ? TREASURY_ACCOUNT_IDS.settlementSar : TREASURY_ACCOUNT_IDS.settlementUsd;
}

export function feeClearingAccountId(currency: string): string {
  return currency === 'SAR' ? TREASURY_ACCOUNT_IDS.feeClearingSar : TREASURY_ACCOUNT_IDS.feeClearingUsd;
}

export function feeIncomeAccountId(currency: string): string {
  return currency === 'SAR' ? TREASURY_ACCOUNT_IDS.feeIncomeSar : TREASURY_ACCOUNT_IDS.feeIncomeUsd;
}

export function beneficiaryPayableAccountId(currency: string): string {
  return currency === 'SAR'
    ? TREASURY_ACCOUNT_IDS.beneficiaryPayableSar
    : TREASURY_ACCOUNT_IDS.beneficiaryPayableUsd;
}
