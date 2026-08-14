import { ActionType } from "./kernel/ActionIntent.ts";
import { SIMULATION_FUNDING_SOURCE_ID } from "./ledger/types.ts";
import { Money } from "./money/Money.ts";
import { createSolsticeRuntime } from "./runtime.ts";

function main(): void {
  const runtime = createSolsticeRuntime();

  console.log("=== Solstice simulated deposit demo ===");
  console.log("REAL_MONEY_ENABLED =", runtime.capabilities.REAL_MONEY_ENABLED);
  if (runtime.capabilities.REAL_MONEY_ENABLED !== false) {
    throw new Error("demo aborted: REAL_MONEY_ENABLED must be false");
  }

  const account = runtime.ledger.accounts.openCustomerDepositAccount({
    accountId: "cust-dep-001",
    customerId: "cust-001",
    currency: "USD",
    clearance: "CLEARED",
  });

  const amount = Money.fromMinorUnits(10_000n, "USD");
  const intent = {
    actionType: ActionType.POST_DEPOSIT,
    payload: {
      customerAccountId: account.id,
      amount,
      memo: "simulated inbound principal",
    },
    idempotencyKey: "demo-deposit-001",
    actorId: "demo",
    requestedAt: runtime.clock.now().toISOString(),
  };

  const first = runtime.kernel.submit(intent);
  const replay = runtime.kernel.submit(intent);

  if (first.outcome !== "POSTED" || replay.outcome !== "POSTED") {
    throw new Error("demo expected POSTED outcomes");
  }
  if (first.journal.id !== replay.journal.id) {
    throw new Error("idempotent replay produced a second journal");
  }
  if (runtime.ledger.journalCount() !== 1) {
    throw new Error(`expected 1 journal, got ${runtime.ledger.journalCount()}`);
  }

  console.log("\n--- Journal ---");
  console.log("id:", first.journal.id);
  console.log("actionType:", first.journal.actionType);
  console.log("idempotencyKey:", first.journal.idempotencyKey);
  console.log("executionAuthorityId:", first.journal.executionAuthorityId);
  console.log("classBridge:", first.journal.classBridgeName);
  console.log("asset:", first.journal.asset);
  for (const posting of first.journal.postings) {
    console.log(
      `  ${posting.direction.padEnd(6)} ${posting.accountId}  ${posting.amount.minorUnits.toString()} ${posting.amount.currency}`,
    );
  }

  const totals = runtime.ledger.totalsByAsset().get("USD");
  console.log("\n--- Totals ---");
  console.log("debits :", totals?.debits.toString());
  console.log("credits:", totals?.credits.toString());
  if (!totals || totals.debits !== totals.credits) {
    throw new Error("books do not balance");
  }

  console.log("\n--- Contra ---");
  console.log(
    "funding source:",
    SIMULATION_FUNDING_SOURCE_ID,
    "(simulation; not corporate)",
  );

  console.log("\n--- Growth attribution ---");
  console.log(
    "entries:",
    runtime.growth.count(),
    "(principal deposit is not economic improvement)",
  );

  const chain = runtime.evidence.verifyChain();
  console.log("\n--- Evidence chain ---");
  console.log("verified:", chain.ok, "records:", chain.length);
  for (const record of runtime.evidence.list()) {
    console.log(
      `  seq=${record.seq} kind=${record.kind} sha256=${record.recordSha256.slice(0, 12)}…`,
    );
  }

  console.log("\n--- Domain events ---");
  for (const event of runtime.events.list()) {
    console.log(" ", event.type);
  }

  console.log("\nDemo complete. Simulation only. Flags unchanged.");
}

main();
