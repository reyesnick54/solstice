/**
 * Deterministic Bank / BaaS simulation adapter.
 * Implements the same BankAdapter contract a real vendor will implement.
 * No network. No live credentials. No Ledger posts.
 */

import { asCurrencyCode } from '../../../domain/src/currency.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';
import { secretRef } from '../../../security/src/secrets.ts';
import { adapterErr, adapterOk, type AdapterHealth, type AdapterResult } from '../types.ts';
import { sealAccountIdentifier } from './identifiers.ts';
import type {
  BankAccountRecord,
  BankAccountStatus,
  BankAdapter,
  BankAdapterCapabilities,
  BankBalanceSnapshot,
  BankCustomerProfile,
  BankStatementRecord,
  BankTransactionRecord,
  CreateBankAccountInput,
  CreateBankCustomerInput,
  RestrictBankAccountInput,
  UpdateBankCustomerInput,
} from './port.ts';

const CAPABILITIES: BankAdapterCapabilities = Object.freeze({
  createCustomer: true,
  updateCustomer: true,
  createAccount: true,
  getAccount: true,
  getBalance: true,
  getTransactions: true,
  getStatement: true,
  closeOrRestrict: true,
  getAccountStatus: true,
});

export class SimulatedBankAdapter implements BankAdapter {
  readonly providerId = 'SIMULATED_BANK_BAAS';
  readonly domain = 'BANK_BAAS' as const;
  readonly lifecycle = 'SIMULATED' as const;
  readonly capabilities = CAPABILITIES;
  readonly credentialRef: SecretReference;
  readonly canPostLedger = false as const;
  readonly canIssueExecutionAuthority = false as const;
  private readonly customers = new Map<string, BankCustomerProfile>();
  private readonly accounts = new Map<string, BankAccountRecord>();
  private readonly balances = new Map<string, BankBalanceSnapshot>();
  private readonly transactions = new Map<string, BankTransactionRecord[]>();

  constructor(credentialRef: SecretReference = secretRef('simulation', 'bank/simulated-baas')) {
    this.credentialRef = credentialRef;
  }

  createCustomerProfile(input: CreateBankCustomerInput): AdapterResult<BankCustomerProfile> {
    const existing = [...this.customers.values()].find((row) => row.sunreyCustomerId === input.sunreyCustomerId);
    if (existing) {
      return adapterOk(existing);
    }
    const profile = Object.freeze({
      providerCustomerId: `sim_bcust_${input.sunreyCustomerId}`,
      sunreyCustomerId: input.sunreyCustomerId,
      jurisdiction: input.jurisdiction,
      status: 'ACTIVE' as const,
    });
    this.customers.set(profile.providerCustomerId, profile);
    return adapterOk(profile);
  }

  updateCustomerProfile(input: UpdateBankCustomerInput): AdapterResult<BankCustomerProfile> {
    const existing = this.customers.get(input.providerCustomerId);
    if (!existing) {
      return adapterErr('BANK_CUSTOMER_NOT_FOUND', 'simulated bank customer does not exist');
    }
    const next = Object.freeze({
      ...existing,
      jurisdiction: input.jurisdiction ?? existing.jurisdiction,
      status: input.status ?? existing.status,
    });
    this.customers.set(next.providerCustomerId, next);
    return adapterOk(next);
  }

  createAccount(input: CreateBankAccountInput): AdapterResult<BankAccountRecord> {
    if (!this.customers.has(input.providerCustomerId)) {
      return adapterErr('BANK_CUSTOMER_NOT_FOUND', 'cannot open account without provider customer');
    }
    const now = nowUtc();
    const providerAccountId = `sim_bacc_${input.providerCustomerId}_${input.currency}`;
    const existing = this.accounts.get(providerAccountId);
    if (existing) {
      return adapterOk(existing);
    }
    const record: BankAccountRecord = Object.freeze({
      providerAccountId,
      providerCustomerId: input.providerCustomerId,
      currency: input.currency,
      jurisdiction: input.jurisdiction,
      status: 'OPEN',
      coordinate: sealAccountIdentifier({
        kind: 'LOCAL',
        countryCode: input.jurisdiction,
        localIdentifier: `SIM${providerAccountId.slice(-8)}`,
      }),
      createdAt: now,
      providerBalanceIsLedgerAuthority: false,
    });
    this.accounts.set(providerAccountId, record);
    this.balances.set(
      providerAccountId,
      Object.freeze({
        providerAccountId,
        currency: input.currency,
        available: Money.fromMinorUnits(0n, input.currency),
        current: Money.fromMinorUnits(0n, input.currency),
        asOf: now,
        isCustomerLedgerBalance: false,
      }),
    );
    this.transactions.set(providerAccountId, []);
    return adapterOk(record);
  }

  getAccount(providerAccountId: string): AdapterResult<BankAccountRecord> {
    const account = this.accounts.get(providerAccountId);
    return account
      ? adapterOk(account)
      : adapterErr('BANK_ACCOUNT_NOT_FOUND', 'simulated bank account does not exist');
  }

  getBalance(providerAccountId: string): AdapterResult<BankBalanceSnapshot> {
    const balance = this.balances.get(providerAccountId);
    return balance
      ? adapterOk(balance)
      : adapterErr('BANK_ACCOUNT_NOT_FOUND', 'simulated bank account does not exist');
  }

  getTransactions(providerAccountId: string): AdapterResult<readonly BankTransactionRecord[]> {
    const rows = this.transactions.get(providerAccountId);
    return rows
      ? adapterOk(Object.freeze([...rows]))
      : adapterErr('BANK_ACCOUNT_NOT_FOUND', 'simulated bank account does not exist');
  }

  getStatement(
    providerAccountId: string,
    periodStart: UtcInstant,
    periodEnd: UtcInstant,
  ): AdapterResult<BankStatementRecord> {
    const account = this.accounts.get(providerAccountId);
    const balance = this.balances.get(providerAccountId);
    if (!account || !balance) {
      return adapterErr('BANK_ACCOUNT_NOT_FOUND', 'simulated bank account does not exist');
    }
    return adapterOk(
      Object.freeze({
        statementRef: `sim_stmt_${providerAccountId}_${periodEnd}`,
        providerAccountId,
        periodStart,
        periodEnd,
        opening: Money.fromMinorUnits(0n, account.currency),
        closing: balance.current,
        present: true,
      }),
    );
  }

  closeOrRestrictAccount(input: RestrictBankAccountInput): AdapterResult<BankAccountRecord> {
    const existing = this.accounts.get(input.providerAccountId);
    if (!existing) {
      return adapterErr('BANK_ACCOUNT_NOT_FOUND', 'simulated bank account does not exist');
    }
    const status: BankAccountStatus =
      input.reason === 'CLOSE' ? 'CLOSED' : input.reason === 'FREEZE' ? 'FROZEN' : 'RESTRICTED';
    const next = Object.freeze({ ...existing, status });
    this.accounts.set(next.providerAccountId, next);
    return adapterOk(next);
  }

  getAccountStatus(providerAccountId: string): AdapterResult<BankAccountStatus> {
    const account = this.accounts.get(providerAccountId);
    return account
      ? adapterOk(account.status)
      : adapterErr('BANK_ACCOUNT_NOT_FOUND', 'simulated bank account does not exist');
  }

  health(): AdapterHealth {
    return Object.freeze({
      providerId: this.providerId,
      domain: this.domain,
      lifecycle: this.lifecycle,
      healthy: true,
      connectivity: 'SIMULATION',
      checkedAt: nowUtc(),
      live: false,
    });
  }

  recordSimulatedTransaction(providerAccountId: string, amount: Money, direction: 'CREDIT' | 'DEBIT'): void {
    const rows = this.transactions.get(providerAccountId);
    const balance = this.balances.get(providerAccountId);
    if (!rows || !balance) {
      return;
    }
    const now = nowUtc();
    rows.push(
      Object.freeze({
        providerTransactionId: `sim_btx_${providerAccountId}_${String(rows.length + 1)}`,
        providerAccountId,
        amount,
        direction,
        postedAt: now,
        description: 'SIMULATED_TRANSACTION',
        providerStatus: 'POSTED',
      }),
    );
    const signed = direction === 'CREDIT' ? amount.minorUnits : -amount.minorUnits;
    const nextMinor = balance.current.minorUnits + signed;
    const next = Money.fromMinorUnits(nextMinor < 0n ? 0n : nextMinor, asCurrencyCode(balance.currency));
    this.balances.set(
      providerAccountId,
      Object.freeze({
        ...balance,
        available: next,
        current: next,
        asOf: now,
      }),
    );
  }
}

function nowUtc(): UtcInstant {
  return asUtcInstant(new Date().toISOString());
}
