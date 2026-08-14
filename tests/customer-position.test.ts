import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerId } from "../src/account.ts";
import { ACCOUNT_CLASSES } from "../src/account-class.ts";
import {
  CustomerPosition,
  projectCustomerPosition,
} from "../src/balances.ts";
import { InMemoryPostingStore } from "../src/ledger.ts";
import { eur, openAccount, post, usd } from "./fixtures.ts";

describe("projectCustomerPosition", () => {
  it("per-class breakdown separates classes correctly", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_classes");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
    });
    const investments = openAccount({
      customerId: owner,
      accountClass: "investments",
    });
    const digital = openAccount({
      customerId: owner,
      accountClass: "digital_assets",
    });
    const rewards = openAccount({
      customerId: owner,
      accountClass: "rewards",
    });
    const pending = openAccount({
      customerId: owner,
      accountClass: "pending",
    });

    post(store, deposits, usd(150_000n));
    post(store, deposits, usd(50_000n));
    post(store, investments, usd(80_000n));
    post(store, digital, usd(12_000n));
    post(store, rewards, usd(3_000n));
    post(store, pending, usd(7_500n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits, investments, digital, rewards, pending],
      homeCurrency: "USD",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const { breakdown, grandTotal } = result.value;
    assert.equal(breakdown.deposits.total.minorUnits, 200_000n);
    assert.equal(breakdown.investments.total.minorUnits, 80_000n);
    assert.equal(breakdown.digital_assets.total.minorUnits, 12_000n);
    assert.equal(breakdown.rewards.total.minorUnits, 3_000n);
    assert.equal(breakdown.pending.total.minorUnits, 7_500n);

    assert.equal(breakdown.deposits.accountClass, "deposits");
    assert.equal(breakdown.investments.accountClass, "investments");
    assert.equal(breakdown.digital_assets.accountClass, "digital_assets");
    assert.equal(breakdown.rewards.accountClass, "rewards");
    assert.equal(breakdown.pending.accountClass, "pending");

    assert.equal(breakdown.deposits.classification.insurance, "insured");
    assert.equal(breakdown.investments.classification.insurance, "at_risk");
    assert.equal(breakdown.digital_assets.classification.insurance, "at_risk");
    assert.equal(breakdown.rewards.classification.insurance, "at_risk");
    assert.equal(breakdown.pending.classification.insurance, "at_risk");
    assert.equal(breakdown.pending.classification.realization, "pending");

    assert.equal(grandTotal.minorUnits, 302_500n);
    assert.equal(grandTotal.currency, "USD");

    assert.ok(result.value instanceof CustomerPosition);
    assert.equal(result.value.customerId, owner);
    assert.ok("breakdown" in result.value);
    assert.ok("grandTotal" in result.value);

    for (const accountClass of ACCOUNT_CLASSES) {
      assert.equal(breakdown[accountClass].accountClass, accountClass);
      assert.equal(
        breakdown[accountClass].classification.accountClass,
        accountClass,
      );
    }
  });

  it("grand total is not available without the accompanying breakdown", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_wealth");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
    });
    post(store, deposits, usd(1_000n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits],
      homeCurrency: "USD",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const keys = Object.keys(result.value);
    assert.ok(keys.includes("breakdown"));
    assert.ok(keys.includes("grandTotal"));
    assert.equal(typeof result.value.grandTotal, "object");
    assert.equal(typeof result.value.breakdown, "object");
  });

  it("empty classes are zero in the home currency and do not leak into other classes", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_sparse");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
    });
    post(store, deposits, usd(42n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits],
      homeCurrency: "USD",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.breakdown.deposits.total.minorUnits, 42n);
    assert.equal(result.value.breakdown.investments.total.minorUnits, 0n);
    assert.equal(result.value.breakdown.digital_assets.total.minorUnits, 0n);
    assert.equal(result.value.breakdown.rewards.total.minorUnits, 0n);
    assert.equal(result.value.breakdown.pending.total.minorUnits, 0n);
    assert.equal(result.value.grandTotal.minorUnits, 42n);
  });

  it("does not write to the ledger", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_ro_pos");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
    });
    post(store, deposits, usd(9n));
    const before = store.postingCount;

    projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits],
      homeCurrency: "USD",
    });

    assert.equal(store.postingCount, before);
  });

  it("ignores accounts that belong to a different customer", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_a");
    const other = customerId("cust_b");
    const mine = openAccount({ customerId: owner, accountClass: "deposits" });
    const theirs = openAccount({
      customerId: other,
      accountClass: "deposits",
    });
    post(store, mine, usd(10n));
    post(store, theirs, usd(999n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [mine, theirs],
      homeCurrency: "USD",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.breakdown.deposits.total.minorUnits, 10n);
  });

  it("does not mix a zero foreign-currency class into a same-currency total", () => {
    const store = new InMemoryPostingStore();
    const owner = customerId("cust_zero_fx");
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
    post(store, deposits, usd(100n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits, investments],
      homeCurrency: "USD",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.breakdown.deposits.total.minorUnits, 100n);
    assert.equal(result.value.breakdown.investments.total.minorUnits, 0n);
    assert.equal(result.value.breakdown.investments.total.currency, "EUR");
    assert.equal(result.value.grandTotal.minorUnits, 100n);
    assert.equal(result.value.grandTotal.currency, "USD");
  });

  it("Account type exposes no balance field", () => {
    const account = openAccount({
      customerId: customerId("cust_shape"),
      accountClass: "deposits",
    });
    assert.equal("balance" in account, false);
    assert.deepEqual(Object.keys(account).sort(), [
      "accountClass",
      "currency",
      "customerId",
      "id",
    ]);
  });
});

describe("CustomerPosition construction", () => {
  it("cannot be constructed as a bare total — only via assemble with a breakdown", () => {
    assert.equal(typeof CustomerPosition.assemble, "function");
    assert.throws(() => {
      // private constructor — a bare number is not a CustomerPosition
      new (CustomerPosition as unknown as { new (): CustomerPosition })();
    });
  });
});
