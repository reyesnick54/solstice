import { accountId, createAccount, customerId } from "../src/account.ts";
import type { AccountClass } from "../src/account-class.ts";
import { InMemoryPostingStore, postingId } from "../src/ledger.ts";
import { Money, type CurrencyCode, type FxConversion } from "../src/money.ts";

let seq = 0;

export function resetIds(): void {
  seq = 0;
}

export function usd(minorUnits: bigint): Money {
  return Money.of(minorUnits, "USD");
}

export function eur(minorUnits: bigint): Money {
  return Money.of(minorUnits, "EUR");
}

export function openAccount(input: {
  customerId: ReturnType<typeof customerId>;
  accountClass: AccountClass;
  currency?: CurrencyCode;
}): ReturnType<typeof createAccount> {
  seq += 1;
  return createAccount({
    id: accountId(`acct_${seq}`),
    customerId: input.customerId,
    accountClass: input.accountClass,
    currency: input.currency ?? "USD",
  });
}

export function post(
  store: InMemoryPostingStore,
  account: ReturnType<typeof createAccount>,
  amount: Money,
  at: Date = new Date("2026-08-13T12:00:00.000Z"),
): void {
  seq += 1;
  store.record({
    id: postingId(`post_${seq}`),
    accountId: account.id,
    customerId: account.customerId,
    amount,
    postedAt: at,
  });
}

export function fx(input: {
  from: CurrencyCode;
  to: CurrencyCode;
  numerator: bigint;
  denominator: bigint;
  timestamp?: Date;
}): FxConversion {
  return {
    from: input.from,
    to: input.to,
    rate: { numerator: input.numerator, denominator: input.denominator },
    timestamp: input.timestamp ?? new Date("2026-08-13T15:00:00.000Z"),
  };
}
