import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerId } from "../src/account.ts";
import { balanceOfAccount } from "../src/balances.ts";
import { InMemoryPostingStore } from "../src/ledger.ts";
import { Money } from "../src/money.ts";
import { openAccount, post, usd } from "./fixtures.ts";

describe("balanceOfAccount", () => {
  it("balance of an account with no postings is zero", () => {
    const store = new InMemoryPostingStore();
    const account = openAccount({
      customerId: customerId("cust_empty"),
      accountClass: "deposits",
      currency: "USD",
    });

    const result = balanceOfAccount(store, account);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.minorUnits, 0n);
    assert.equal(result.value.currency, "USD");
    assert.deepEqual(result.value, Money.zero("USD"));
  });

  it("balance after several deposits is correct", () => {
    const store = new InMemoryPostingStore();
    const account = openAccount({
      customerId: customerId("cust_deposits"),
      accountClass: "deposits",
    });
    post(store, account, usd(10_000n));
    post(store, account, usd(25_500n));
    post(store, account, usd(4_500n));

    const result = balanceOfAccount(store, account);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.minorUnits, 40_000n);
    assert.equal(result.value.currency, "USD");
  });

  it("net balance includes withdrawals as negative postings", () => {
    const store = new InMemoryPostingStore();
    const account = openAccount({
      customerId: customerId("cust_net"),
      accountClass: "deposits",
    });
    post(store, account, usd(100_000n));
    post(store, account, usd(-30_000n));

    const result = balanceOfAccount(store, account);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.minorUnits, 70_000n);
  });

  it("does not write to the ledger", () => {
    const store = new InMemoryPostingStore();
    const account = openAccount({
      customerId: customerId("cust_ro"),
      accountClass: "deposits",
    });
    post(store, account, usd(1n));
    const before = store.postingCount;

    balanceOfAccount(store, account);

    assert.equal(store.postingCount, before);
  });

  it("returns a typed mixed-currency error when postings disagree with the account currency", () => {
    const store = new InMemoryPostingStore();
    const account = openAccount({
      customerId: customerId("cust_mix"),
      accountClass: "deposits",
      currency: "USD",
    });
    post(store, account, usd(100n));
    post(store, account, Money.of(50n, "EUR"));

    const result = balanceOfAccount(store, account);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "MixedCurrencyWithoutConversion");
    assert.deepEqual(result.error.currencies, ["EUR", "USD"]);
  });
});
