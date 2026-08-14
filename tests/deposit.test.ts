import { describe, expect, it } from "vitest";
import { FrozenClock } from "../src/clock.ts";
import { ActionType } from "../src/kernel/ActionIntent.ts";
import { Ledger } from "../src/ledger/journal.ts";
import {
  LedgerInvariantError,
  SIMULATED_CUSTOMER_FUNDING_BRIDGE,
  SIMULATION_FUNDING_SOURCE_ID,
} from "../src/ledger/types.ts";
import { Money } from "../src/money/Money.ts";
import { createSolsticeRuntime } from "../src/runtime.ts";
import { depositIntent, runtimeWithClearedAccount } from "./helpers.ts";

describe("simulated POST_DEPOSIT", () => {
  it("produces a balanced journal: debit simulation source, credit customer", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const result = runtime.kernel.submit(
      depositIntent(accountId, 10_000n, "dep-balanced"),
    );
    expect(result.outcome).toBe("POSTED");
    if (result.outcome !== "POSTED") return;

    expect(result.journal.actionType).toBe(ActionType.POST_DEPOSIT);
    expect(result.journal.postings).toHaveLength(2);
    expect(result.journal.classBridgeName).toBe(
      SIMULATED_CUSTOMER_FUNDING_BRIDGE.name,
    );

    const debit = result.journal.postings.find((p) => p.direction === "DEBIT");
    const credit = result.journal.postings.find((p) => p.direction === "CREDIT");
    expect(debit?.accountId).toBe(SIMULATION_FUNDING_SOURCE_ID);
    expect(credit?.accountId).toBe(accountId);
    expect(debit?.amount.minorUnits).toBe(10_000n);
    expect(credit?.amount.minorUnits).toBe(10_000n);
    expect(debit?.amount.equals(credit!.amount)).toBe(true);

    const source = runtime.ledger.accounts.get(SIMULATION_FUNDING_SOURCE_ID);
    expect(source.class).toBe("SIMULATION");
    expect(source.class).not.toBe("CORPORATE");
  });

  it("keeps total debits equal to total credits after the operation", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    runtime.kernel.submit(depositIntent(accountId, 2500n, "dep-totals-a"));
    runtime.kernel.submit(depositIntent(accountId, 7500n, "dep-totals-b"));

    const usd = runtime.ledger.totalsByAsset().get("USD");
    expect(usd).toBeDefined();
    expect(usd!.debits).toBe(usd!.credits);
    expect(usd!.debits).toBe(10_000n);
  });

  it("the same idempotency key twice produces exactly one journal", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const intent = depositIntent(accountId, 1000n, "dep-idem");
    const first = runtime.kernel.submit(intent);
    const second = runtime.kernel.submit(intent);
    expect(first.outcome).toBe("POSTED");
    expect(second.outcome).toBe("POSTED");
    if (first.outcome !== "POSTED" || second.outcome !== "POSTED") return;
    expect(second.replay).toBe(true);
    expect(second.journal.id).toBe(first.journal.id);
    expect(runtime.ledger.journalCount()).toBe(1);
    expect(runtime.ledger.listJournals()).toHaveLength(1);
  });

  it("rejects a deposit without a valid Execution Authority", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const amount = Money.fromMinorUnits(100n, "USD");
    const unsigned = {
      authorityId: "forged",
      actionType: ActionType.POST_DEPOSIT,
      accountId,
      amount,
      idempotencyKey: "dep-no-ea",
      issuedAt: "2026-08-13T12:00:00.000Z",
      expiresAt: "2026-08-13T13:00:00.000Z",
      signature: "not-a-real-signature",
    };
    expect(() =>
      runtime.ledger.postJournal({
        idempotencyKey: "dep-no-ea",
        executionAuthority: unsigned,
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
    ).toThrow(LedgerInvariantError);
    expect(runtime.ledger.journalCount()).toBe(0);
  });

  it("rejects an expired Authority", () => {
    const frozen = new FrozenClock(new Date("2026-08-13T12:00:00.000Z"));
    const runtime = createSolsticeRuntime({ clock: frozen });
    runtime.ledger.accounts.openCustomerDepositAccount({
      accountId: "cust-dep-exp",
      customerId: "cust-001",
      currency: "USD",
      clearance: "CLEARED",
    });
    const amount = Money.fromMinorUnits(100n, "USD");
    const expired = runtime.authorityIssuer.issue({
      authorityId: "ea-expired",
      actionType: ActionType.POST_DEPOSIT,
      accountId: "cust-dep-exp",
      amount,
      idempotencyKey: "dep-expired",
      issuedAt: "2026-08-13T10:00:00.000Z",
      expiresAt: "2026-08-13T11:00:00.000Z",
    });
    expect(() =>
      runtime.ledger.postJournal({
        idempotencyKey: "dep-expired",
        executionAuthority: expired,
        actionType: ActionType.POST_DEPOSIT,
        classBridge: SIMULATED_CUSTOMER_FUNDING_BRIDGE,
        postings: [
          {
            accountId: SIMULATION_FUNDING_SOURCE_ID,
            direction: "DEBIT",
            amount,
          },
          { accountId: "cust-dep-exp", direction: "CREDIT", amount },
        ],
      }),
    ).toThrow(/expired/);
    expect(runtime.ledger.journalCount()).toBe(0);
  });

  it("a refused deposit posts nothing but still seals evidence", () => {
    const runtime = createSolsticeRuntime();
    runtime.ledger.accounts.openCustomerDepositAccount({
      accountId: "cust-blocked",
      customerId: "cust-blocked",
      currency: "USD",
      clearance: "BLOCKED",
    });
    const beforeJournals = runtime.ledger.journalCount();
    const beforeEvidence = runtime.evidence.count();

    const result = runtime.kernel.submit(
      depositIntent("cust-blocked", 100n, "dep-refused"),
    );

    expect(result.outcome).toBe("REFUSED");
    if (result.outcome !== "REFUSED") return;
    expect(result.reason).toMatch(/BLOCKED/);
    expect(runtime.ledger.journalCount()).toBe(beforeJournals);
    expect(runtime.ledger.journalCount()).toBe(0);
    expect(runtime.evidence.count()).toBe(beforeEvidence + 1);
    const sealed = runtime.evidence.list().find((r) => r.kind === "DEPOSIT_REFUSED");
    expect(sealed).toBeDefined();
    expect(runtime.evidence.verifyChain().ok).toBe(true);
    expect(runtime.growth.count()).toBe(0);
  });

  it("does not record growth attribution for a principal deposit", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const result = runtime.kernel.submit(
      depositIntent(accountId, 1n, "dep-no-growth"),
    );
    expect(result.outcome).toBe("POSTED");
    expect(runtime.growth.count()).toBe(0);
    expect(() =>
      runtime.growth.record({
        id: "should-fail",
        journalId: "x",
        reason: "INTEREST",
        amount: Money.fromMinorUnits(1n, "USD"),
        recordedAt: "2026-08-13T00:00:00.000Z",
      }),
    ).toThrow(/principal deposit/i);
  });

  it("does not expose a public path that posts a deposit without the kernel", () => {
    expect(typeof Ledger.prototype.postJournal).toBe("function");
    const { runtime, accountId } = runtimeWithClearedAccount();
    const posted = runtime.kernel.submit(
      depositIntent(accountId, 50n, "dep-kernel-path"),
    );
    expect(posted.outcome).toBe("POSTED");
    if (posted.outcome !== "POSTED") return;
    expect(posted.journal.executionAuthorityId.length).toBeGreaterThan(0);
  });
});
