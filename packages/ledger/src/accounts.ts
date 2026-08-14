import type { Account } from '../../domain/src/account.ts';
import { CANONICAL_SIMULATION_CURRENCIES } from '../../domain/src/currency.ts';
import {
  SIMULATION_FUNDING_SOURCE_ID,
  simulationFeeCollectorId,
  simulationFundingSourceId,
  simulationInterestSourceId,
  type LedgerAccount,
} from './types.ts';

export class AccountRegister {
  private readonly accounts = new Map<string, LedgerAccount>();

  constructor() {
    this.put(
      Object.freeze({
        id: SIMULATION_FUNDING_SOURCE_ID,
        name: 'Simulated Funding Source (simulation only; not corporate; not real money)',
        accountClass: 'SIMULATED_FUNDING_SOURCE',
        currency: 'USD',
      }),
    );
    this.put(
      Object.freeze({
        id: 'CORPORATE.OPERATING',
        name: 'Corporate operating (never commingled with customer funds)',
        accountClass: 'CORPORATE_OPERATING',
        currency: 'USD',
      }),
    );
    for (const currency of CANONICAL_SIMULATION_CURRENCIES) {
      const fundingId = simulationFundingSourceId(currency);
      if (!this.accounts.has(fundingId)) {
        this.put(
          Object.freeze({
            id: fundingId,
            name: `Simulated ${currency} funding source (simulation only; not corporate)`,
            accountClass: 'SIMULATED_FUNDING_SOURCE',
            currency,
          }),
        );
      }
      this.put(
        Object.freeze({
          id: simulationFeeCollectorId(currency),
          name: `Simulated ${currency} fee collector (simulation only; not corporate)`,
          accountClass: 'SIMULATED_FUNDING_SOURCE',
          currency,
        }),
      );
      this.put(
        Object.freeze({
          id: simulationInterestSourceId(currency),
          name: `Simulated ${currency} interest source (simulation only; not a promised rate)`,
          accountClass: 'SIMULATED_FUNDING_SOURCE',
          currency,
        }),
      );
    }
  }

  get(accountId: string): LedgerAccount {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Unknown ledger account: ${accountId}`);
    }
    return account;
  }

  has(accountId: string): boolean {
    return this.accounts.has(accountId);
  }

  list(): readonly LedgerAccount[] {
    return [...this.accounts.values()];
  }

  /**
   * Register a customer account that was opened under a verified Execution
   * Authority. The domain Account is the proof it already went through
   * openAccount(authority, ...).
   */
  registerSystemAccount(account: LedgerAccount): LedgerAccount {
    if (this.accounts.has(account.id)) {
      return this.get(account.id);
    }
    const frozen = Object.freeze({ ...account });
    this.put(frozen);
    return frozen;
  }

  registerOpenedAccount(account: Account): LedgerAccount {
    if (this.accounts.has(account.id)) {
      return this.get(account.id);
    }
    if (account.id === SIMULATION_FUNDING_SOURCE_ID) {
      throw new Error('Cannot overwrite the simulated funding source');
    }
    const ledgerAccount: LedgerAccount = Object.freeze({
      id: account.id,
      name: `Customer ${account.accountClass} ${account.id}`,
      accountClass: account.accountClass,
      currency: account.currency,
      ownerId: account.ownerId,
    });
    this.put(ledgerAccount);
    return ledgerAccount;
  }

  private put(account: LedgerAccount): void {
    this.accounts.set(account.id, account);
  }
}
