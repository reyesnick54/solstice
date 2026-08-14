import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerId } from "../src/account.ts";
import {
  balanceOfAccount,
  projectCustomerPosition,
} from "../src/balances.ts";
import { InMemoryPostingStore } from "../src/ledger.ts";
import { eur, fx, openAccount, post, usd } from "./fixtures.ts";

describe("mixed currencies", () => {
  it("mixed currencies without a rate returns a typed error", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_fx_err");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
      currency: "USD",
    });
    const investments = openAccount({
      customerId: owner,
      accountClass: "investments",
      currency: "EUR",
    });
    post(store, deposits, usd(100_00n));
    post(store, investments, eur(50_00n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits, investments],
      homeCurrency: "USD",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "MixedCurrencyWithoutConversion");
    assert.deepEqual(result.error.currencies, ["EUR", "USD"]);
    assert.match(result.error.message, /rate and timestamp/);
  });

  it("mixed currencies convert when an explicit rate and timestamp are supplied", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_fx_ok");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
      currency: "USD",
    });
    const investments = openAccount({
      customerId: owner,
      accountClass: "investments",
      currency: "EUR",
    });
    post(store, deposits, usd(100_00n));
    post(store, investments, eur(50_00n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits, investments],
      homeCurrency: "USD",
      conversion: fx({
        from: "EUR",
        to: "USD",
        numerator: 11n,
        denominator: 10n,
        timestamp: new Date("2026-08-13T15:00:00.000Z"),
      }),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    // Class totals stay in native currency. Only the grand total is converted:
    // 50.00 EUR * 11/10 = 55.00 USD; plus 100.00 USD = 155.00 USD.
    assert.equal(result.value.breakdown.deposits.total.currency, "USD");
    assert.equal(result.value.breakdown.deposits.total.minorUnits, 100_00n);
    assert.equal(result.value.breakdown.investments.total.currency, "EUR");
    assert.equal(result.value.breakdown.investments.total.minorUnits, 50_00n);
    assert.equal(result.value.grandTotal.currency, "USD");
    assert.equal(result.value.grandTotal.minorUnits, 155_00n);
  });

  it("incomplete conversion coverage still returns MixedCurrencyWithoutConversion", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_fx_incomplete");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
      currency: "USD",
    });
    const investments = openAccount({
      customerId: owner,
      accountClass: "investments",
      currency: "EUR",
    });
    post(store, deposits, usd(10n));
    post(store, investments, eur(10n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits, investments],
      homeCurrency: "USD",
      conversion: fx({
        from: "GBP",
        to: "USD",
        numerator: 1n,
        denominator: 1n,
      }),
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "MixedCurrencyWithoutConversion");
  });

  it("single-account mixed postings without a rate return the same typed error", () => {
    const store = new InMemoryPostingStore();
    const account = openAccount({
      customerId: customerId("cust_acct_mix"),
      accountClass: "deposits",
      currency: "USD",
    });
    post(store, account, usd(10n));
    post(store, account, eur(5n));

    const result = balanceOfAccount(store, account);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "MixedCurrencyWithoutConversion");
  });
});
