import type { AccountClass } from "./account-class.ts";
import type { CurrencyCode } from "./money.ts";

export type CustomerId = string & { readonly __brand: "CustomerId" };
export type AccountId = string & { readonly __brand: "AccountId" };

export function customerId(value: string): CustomerId {
  return value as CustomerId;
}

export function accountId(value: string): AccountId {
  return value as AccountId;
}

/**
 * Account identity only. Balance is NEVER stored on this entity —
 * it is always derived by summing ledger postings at read time.
 * Do not add a `balance` field.
 */
export type Account = {
  readonly id: AccountId;
  readonly customerId: CustomerId;
  readonly accountClass: AccountClass;
  readonly currency: CurrencyCode;
};

export function createAccount(input: Account): Account {
  return Object.freeze({ ...input });
}
