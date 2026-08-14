import { ActionType, type PostDepositIntent } from "../src/kernel/ActionIntent.ts";
import { Money } from "../src/money/Money.ts";
import { createSolsticeRuntime, type SolsticeRuntime } from "../src/runtime.ts";

export function runtimeWithClearedAccount(
  accountId = "cust-dep-001",
): { runtime: SolsticeRuntime; accountId: string } {
  const runtime = createSolsticeRuntime();
  runtime.ledger.accounts.openCustomerDepositAccount({
    accountId,
    customerId: "cust-001",
    currency: "USD",
    clearance: "CLEARED",
  });
  return { runtime, accountId };
}

export function depositIntent(
  accountId: string,
  minorUnits: bigint,
  idempotencyKey: string,
  memo?: string,
): PostDepositIntent {
  return {
    actionType: ActionType.POST_DEPOSIT,
    payload: {
      customerAccountId: accountId,
      amount: Money.fromMinorUnits(minorUnits, "USD"),
      ...(memo !== undefined ? { memo } : {}),
    },
    idempotencyKey,
    actorId: "test",
    requestedAt: new Date("2026-08-13T00:00:00.000Z").toISOString(),
  };
}
