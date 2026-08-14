import {
  SIMULATION_FUNDING_SOURCE_ID,
  type Account,
  type CustomerClearance,
} from "./types.ts";

export class AccountRegister {
  private readonly accounts = new Map<string, Account>();

  constructor() {
    this.put(
      Object.freeze({
        id: SIMULATION_FUNDING_SOURCE_ID,
        name: "Simulated Funding Source (simulation only; not corporate; not real money)",
        class: "SIMULATION",
        normalBalance: "DEBIT",
        asset: "USD",
      }),
    );
  }

  get(accountId: string): Account {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Unknown account: ${accountId}`);
    }
    return account;
  }

  has(accountId: string): boolean {
    return this.accounts.has(accountId);
  }

  list(): readonly Account[] {
    return [...this.accounts.values()];
  }

  openCustomerDepositAccount(input: {
    accountId: string;
    customerId: string;
    currency: string;
    clearance: CustomerClearance;
  }): Account {
    if (this.accounts.has(input.accountId)) {
      throw new Error(`Account already exists: ${input.accountId}`);
    }
    if (input.accountId === SIMULATION_FUNDING_SOURCE_ID) {
      throw new Error("Cannot overwrite the simulated funding source");
    }
    const account: Account = Object.freeze({
      id: input.accountId,
      name: `Customer deposit ${input.accountId}`,
      class: "CUSTOMER",
      normalBalance: "CREDIT",
      asset: input.currency,
      customerId: input.customerId,
      clearance: input.clearance,
    });
    this.put(account);
    return account;
  }

  /**
   * Test/demo helper for a corporate account. Used only to prove the
   * no-commingling invariant rejects CUSTOMER + CORPORATE journals.
   */
  openCorporateAccount(input: {
    accountId: string;
    currency: string;
  }): Account {
    if (this.accounts.has(input.accountId)) {
      throw new Error(`Account already exists: ${input.accountId}`);
    }
    const account: Account = Object.freeze({
      id: input.accountId,
      name: `Corporate ${input.accountId}`,
      class: "CORPORATE",
      normalBalance: "DEBIT",
      asset: input.currency,
    });
    this.put(account);
    return account;
  }

  private put(account: Account): void {
    this.accounts.set(account.id, account);
  }
}
