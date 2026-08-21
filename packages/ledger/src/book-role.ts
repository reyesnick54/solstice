import { catalogFor, type AccountClass } from '../../domain/src/account-class.ts';
import type { LedgerAccount } from './types.ts';

/**
 * Internal general-ledger book roles. These are not customer-facing account
 * products and are not a second AccountClass taxonomy.
 *
 * Customer products stay DEMAND_DEPOSIT / SAVINGS_DEPOSIT / … .
 * This overlay only classifies ledger books for treasury, fees, settlement,
 * and other internal uses.
 */
export const LEDGER_BOOK_ROLES = [
  'CUSTOMER_LIABILITY',
  'CUSTOMER_ASSET',
  'TREASURY',
  'SETTLEMENT',
  'CLEARING',
  'FEES',
  'REVENUE',
  'EXPENSE',
  'SUSPENSE',
  'FX',
  'CARD',
  'INVESTMENT',
  'CUSTODY_BRIDGE',
  'CORPORATE',
  'SIMULATION_FUNDING',
] as const;

export type LedgerBookRole = (typeof LEDGER_BOOK_ROLES)[number];

const CLASS_TO_ROLE: { readonly [C in AccountClass]: LedgerBookRole } = {
  DEMAND_DEPOSIT: 'CUSTOMER_LIABILITY',
  SAVINGS_DEPOSIT: 'CUSTOMER_LIABILITY',
  TIME_DEPOSIT: 'CUSTOMER_LIABILITY',
  BROKERAGE_CASH: 'INVESTMENT',
  SECURITIES: 'INVESTMENT',
  RETIREMENT: 'INVESTMENT',
  DIGITAL_ASSET_CUSTODY: 'CUSTODY_BRIDGE',
  STABLECOIN_CUSTODY: 'CUSTODY_BRIDGE',
  REWARDS: 'CUSTOMER_LIABILITY',
  PENDING_SETTLEMENT: 'SETTLEMENT',
  CLASS_BRIDGE: 'SUSPENSE',
  SIMULATED_FUNDING_SOURCE: 'SIMULATION_FUNDING',
  CORPORATE_OPERATING: 'CORPORATE',
};

export function bookRoleForAccountClass(accountClass: AccountClass): LedgerBookRole {
  return CLASS_TO_ROLE[accountClass];
}

export function bookRoleForLedgerAccount(account: LedgerAccount): LedgerBookRole {
  if (account.id.startsWith('SIMULATION.FEE_COLLECTOR.')) {
    return 'FEES';
  }
  if (account.id.startsWith('SIMULATION.INTEREST_SOURCE.')) {
    return 'EXPENSE';
  }
  if (account.id.includes('TREASURY')) {
    return 'TREASURY';
  }
  if (account.id.includes('.FX.') || account.id.includes('FX_')) {
    return 'FX';
  }
  if (account.id.includes('CARD')) {
    return 'CARD';
  }
  if (account.id.includes('CLEARING')) {
    return 'CLEARING';
  }
  if (account.id.includes('REVENUE')) {
    return 'REVENUE';
  }
  return bookRoleForAccountClass(account.accountClass);
}

export function isCustomerFacingBook(account: LedgerAccount): boolean {
  return catalogFor(account.accountClass).fundOwnership === 'CUSTOMER';
}
