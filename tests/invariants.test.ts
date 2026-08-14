import { describe, expect, it } from "vitest";
import { FrozenClock } from "../src/clock.ts";
import { ActionType } from "../src/kernel/ActionIntent.ts";
import {
  LedgerInvariantError,
  SIMULATED_CUSTOMER_FUNDING_BRIDGE,
  SIMULATION_FUNDING_SOURCE_ID,
} from "../src/ledger/types.ts";
import { Money } from "../src/money/Money.ts";
import { depositIntent, runtimeWithClearedAccount } from "./helpers.ts";

const clock = new FrozenClock(new Date("2026-08-13T12:00:00.000Z"));

function authorityFor(
  runtime: ReturnType<typeof runtimeWithClearedAccount>["runtime"],
  accountId: string,
  amount: Money,
  key: string,
  expiresAt = "2026-08-13T13:00:00.000Z",
) {
  return runtime.authorityIssuer.issue({
    authorityId: "ea-test",
    actionType: ActionType.POST_DEPOSIT,
    accountId,
    amount,
    idempotencyKey: key,
    issuedAt: "2026-08-13T12:00:00.000Z",
    expiresAt,
  });
}

describe("ledger invariants", () => {
  it("BALANCE: rejects an unbalanced journal", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const amount = Money.fromMinorUnits(100n, "USD");
    const ea = authorityFor(runtime, accountId, amount, "unbalanced");
    expect(() =>
      runtime.ledger.postJournal({
        idempotencyKey: "unbalanced",
        executionAuthority: ea,
        actionType: ActionType.POST_DEPOSIT,
        classBridge: SIMULATED_CUSTOMER_FUNDING_BRIDGE,
        postings: [
          {
            accountId: SIMULATION_FUNDING_SOURCE_ID,
            direction: "DEBIT",
            amount,
          },
          {
            accountId,
            direction: "CREDIT",
            amount: Money.fromMinorUnits(99n, "USD"),
          },
        ],
      }),
    ).toThrow(LedgerInvariantError);
  });

  it("IMMUTABILITY: update and delete are rejected", () => {
    const { runtime } = runtimeWithClearedAccount();
    expect(() => runtime.ledger.updateJournal("x")).toThrow(/IMMUTABILITY/);
    expect(() => runtime.ledger.deleteJournal("x")).toThrow(/IMMUTABILITY/);
    expect(() => runtime.ledger.updatePosting("x")).toThrow(/IMMUTABILITY/);
    expect(() => runtime.ledger.deletePosting("x")).toThrow(/IMMUTABILITY/);
  });

  it("AUTHORITY: customer journal without a valid signature is rejected", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const amount = Money.fromMinorUnits(100n, "USD");
    const ea = authorityFor(runtime, accountId, amount, "bad-sig");
    const forged = { ...ea, signature: "00".repeat(32) };
    expect(() =>
      runtime.ledger.postJournal({
        idempotencyKey: "bad-sig",
        executionAuthority: forged,
        actionType: ActionType.POST_DEPOSIT,
        classBridge: SIMULATED_CUSTOMER_FUNDING_BRIDGE,
        postings: [
          {
            accountId: SIMULATION_FUNDING_SOURCE_ID,
            direction: "DEBIT",
            amount,
          },
          { accountId, direction: "CREDIT", amount },
        ],
      }),
    ).toThrow(/AUTHORITY/);
  });

  it("CLASS_BRIDGE: crossing classes without a named bridge is rejected", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const amount = Money.fromMinorUnits(100n, "USD");
    const ea = authorityFor(runtime, accountId, amount, "no-bridge");
    expect(() =>
      runtime.ledger.postJournal({
        idempotencyKey: "no-bridge",
        executionAuthority: ea,
        actionType: ActionType.POST_DEPOSIT,
        postings: [
          {
            accountId: SIMULATION_FUNDING_SOURCE_ID,
            direction: "DEBIT",
            amount,
          },
          { accountId, direction: "CREDIT", amount },
        ],
      }),
    ).toThrow(/CLASS_BRIDGE/);
  });

  it("NO_COMMINGLING: customer and corporate cannot share a journal", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    runtime.ledger.accounts.openCorporateAccount({
      accountId: "corp-cash",
      currency: "USD",
    });
    const amount = Money.fromMinorUnits(100n, "USD");
    const ea = authorityFor(runtime, accountId, amount, "commingle");
    expect(() =>
      runtime.ledger.postJournal({
        idempotencyKey: "commingle",
        executionAuthority: ea,
        actionType: ActionType.POST_DEPOSIT,
        classBridge: {
          name: "ILLEGAL_CUSTOMER_CORPORATE",
          fromClass: "CUSTOMER",
          toClass: "CORPORATE",
          disclosed: true,
          purpose: "must still be rejected",
        },
        postings: [
          { accountId: "corp-cash", direction: "DEBIT", amount },
          { accountId, direction: "CREDIT", amount },
        ],
      }),
    ).toThrow(/NO_COMMINGLING/);
  });

  it("IDEMPOTENCY: a key is required", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const amount = Money.fromMinorUnits(100n, "USD");
    const ea = authorityFor(runtime, accountId, amount, "   ");
    expect(() =>
      runtime.ledger.postJournal({
        idempotencyKey: "   ",
        executionAuthority: ea,
        actionType: ActionType.POST_DEPOSIT,
        classBridge: SIMULATED_CUSTOMER_FUNDING_BRIDGE,
        postings: [
          {
            accountId: SIMULATION_FUNDING_SOURCE_ID,
            direction: "DEBIT",
            amount,
          },
          { accountId, direction: "CREDIT", amount },
        ],
      }),
    ).toThrow(/IDEMPOTENCY/);
  });

  it("frozen clock is available for authority expiry tests", () => {
    expect(clock.now().toISOString()).toBe("2026-08-13T12:00:00.000Z");
  });
});

describe("kernel is the deposit entry point", () => {
  it("POST_DEPOSIT is accepted only as an ActionIntent", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const result = runtime.kernel.submit(
      depositIntent(accountId, 500n, "kernel-only"),
    );
    expect(result.outcome).toBe("POSTED");
  });
});
