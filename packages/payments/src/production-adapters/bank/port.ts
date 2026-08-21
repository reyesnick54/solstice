/**
 * Canonical Bank / BaaS / account-provider adapter contract.
 *
 * Adapters must not post journals, issue Execution Authority, or treat a
 * provider balance as customer Ledger authority.
 */

import type { CurrencyCode } from '../../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { Money } from '../../../../money/src/money.ts';
import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { AdapterHealth, AdapterResult, ProviderLifecycleState } from '../types.ts';
import type { BankAccountCoordinate } from './identifiers.ts';

export const BANK_ACCOUNT_STATUSES = [
  'PENDING',
  'OPEN',
  'RESTRICTED',
  'FROZEN',
  'CLOSED',
  'UNKNOWN',
] as const;
export type BankAccountStatus = (typeof BANK_ACCOUNT_STATUSES)[number];

export type BankCustomerProfile = {
  readonly providerCustomerId: string;
  readonly sunreyCustomerId: string;
  readonly jurisdiction: string;
  readonly status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'CLOSED';
};

export type BankAccountRecord = {
  readonly providerAccountId: string;
  readonly providerCustomerId: string;
  readonly currency: CurrencyCode;
  readonly jurisdiction: string;
  readonly status: BankAccountStatus;
  readonly coordinate: BankAccountCoordinate | null;
  readonly createdAt: UtcInstant;
  readonly providerBalanceIsLedgerAuthority: false;
};

export type BankBalanceSnapshot = {
  readonly providerAccountId: string;
  readonly currency: CurrencyCode;
  readonly available: Money;
  readonly current: Money;
  readonly asOf: UtcInstant;
  readonly isCustomerLedgerBalance: false;
};

export type BankTransactionRecord = {
  readonly providerTransactionId: string;
  readonly providerAccountId: string;
  readonly amount: Money;
  readonly direction: 'CREDIT' | 'DEBIT';
  readonly postedAt: UtcInstant;
  readonly description: string;
  readonly providerStatus: string;
};

export type BankStatementRecord = {
  readonly statementRef: string;
  readonly providerAccountId: string;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly opening: Money;
  readonly closing: Money;
  readonly present: boolean;
};

export type CreateBankCustomerInput = {
  readonly sunreyCustomerId: string;
  readonly jurisdiction: string;
};

export type UpdateBankCustomerInput = {
  readonly providerCustomerId: string;
  readonly jurisdiction?: string;
  readonly status?: BankCustomerProfile['status'];
};

export type CreateBankAccountInput = {
  readonly providerCustomerId: string;
  readonly currency: CurrencyCode;
  readonly jurisdiction: string;
};

export type RestrictBankAccountInput = {
  readonly providerAccountId: string;
  readonly reason: 'CLOSE' | 'RESTRICT' | 'FREEZE';
};

export type BankAdapterCapabilities = {
  readonly createCustomer: boolean;
  readonly updateCustomer: boolean;
  readonly createAccount: boolean;
  readonly getAccount: boolean;
  readonly getBalance: boolean;
  readonly getTransactions: boolean;
  readonly getStatement: boolean;
  readonly closeOrRestrict: boolean;
  readonly getAccountStatus: boolean;
};

export type BankAdapter = {
  readonly providerId: string;
  readonly domain: 'BANK_BAAS' | 'ACCOUNT_PROVIDER';
  readonly lifecycle: ProviderLifecycleState;
  readonly capabilities: BankAdapterCapabilities;
  readonly credentialRef: SecretReference | null;
  readonly canPostLedger: false;
  readonly canIssueExecutionAuthority: false;
  createCustomerProfile(input: CreateBankCustomerInput): AdapterResult<BankCustomerProfile>;
  updateCustomerProfile(input: UpdateBankCustomerInput): AdapterResult<BankCustomerProfile>;
  createAccount(input: CreateBankAccountInput): AdapterResult<BankAccountRecord>;
  getAccount(providerAccountId: string): AdapterResult<BankAccountRecord>;
  getBalance(providerAccountId: string): AdapterResult<BankBalanceSnapshot>;
  getTransactions(providerAccountId: string): AdapterResult<readonly BankTransactionRecord[]>;
  getStatement(providerAccountId: string, periodStart: UtcInstant, periodEnd: UtcInstant): AdapterResult<BankStatementRecord>;
  closeOrRestrictAccount(input: RestrictBankAccountInput): AdapterResult<BankAccountRecord>;
  getAccountStatus(providerAccountId: string): AdapterResult<BankAccountStatus>;
  health(): AdapterHealth;
};
