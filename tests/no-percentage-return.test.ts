import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerId } from "../src/account.ts";
import {
  projectCustomerPosition,
  type CustomerPosition,
  type CustomerPositionHasNoReturnMetrics,
  type ForbiddenReturnMetricKeys,
} from "../src/balances.ts";
import { InMemoryPostingStore } from "../src/ledger.ts";
import { openAccount, post, usd } from "./fixtures.ts";

const FORBIDDEN: readonly ForbiddenReturnMetricKeys[] = [
  "percentageReturn",
  "percentReturn",
  "yield",
  "apy",
  "apr",
  "growthRate",
  "returnRate",
  "blendedYield",
  "rateOfReturn",
];

describe("no percentage-return property", () => {
  it("the returned type exposes no percentage-return property", () => {
    const _typeLock: CustomerPositionHasNoReturnMetrics = true;
    assert.equal(_typeLock, true);

    const store = new InMemoryPostingStore();
    const owner = customerId("cust_no_yield");
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

    const position: CustomerPosition = result.value;
    const ownKeys = [
      ...Object.keys(position),
      ...Object.getOwnPropertyNames(position),
      ...Object.keys(Object.getPrototypeOf(position) as object),
    ];
    const breakdownKeys = Object.keys(position.breakdown);
    const classTotalKeys = Object.values(position.breakdown).flatMap((row) =>
      Object.keys(row),
    );

    for (const key of FORBIDDEN) {
      assert.equal(
        ownKeys.includes(key),
        false,
        `CustomerPosition must not expose ${key}`,
      );
      assert.equal(
        breakdownKeys.includes(key),
        false,
        `breakdown must not expose ${key}`,
      );
      assert.equal(
        classTotalKeys.includes(key),
        false,
        `class total must not expose ${key}`,
      );
      assert.equal(key in position, false);
      assert.equal(key in position.breakdown, false);
    }

    assert.equal("percentageReturn" in position, false);
    assert.equal("yield" in position, false);
    assert.equal("growthRate" in position, false);
  });
});
