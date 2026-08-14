import type { Money } from "../money/Money.ts";

export interface GrowthAttributionEntry {
  readonly id: string;
  readonly journalId: string;
  readonly reason: "INTEREST" | "YIELD" | "MARK_TO_MARKET";
  readonly amount: Money;
  readonly recordedAt: string;
}

/**
 * Growth Attribution Ledger.
 *
 * Records economic improvement only: interest, yield, or mark-to-market gain.
 *
 * A principal deposit (POST_DEPOSIT) is inbound customer funds. It increases
 * a customer liability and a simulation source asset by the same amount. That
 * is not economic improvement. The deposit path must not call record().
 */
export class GrowthAttributionLedger {
  private readonly entries: GrowthAttributionEntry[] = [];

  /**
   * POST_DEPOSIT is a principal movement, not interest.
   * Do not record growth attribution for a principal deposit.
   */
  record(_entry: GrowthAttributionEntry): never {
    throw new Error(
      "Growth attribution is reserved for economic improvement (interest/yield). " +
        "A principal deposit must not be recorded here.",
    );
  }

  /**
   * Explicit no-op used by the deposit path so the decision is visible in
   * call stacks and reviews: principal is not growth.
   */
  skipPrincipalDeposit(reason: string): void {
    if (reason !== "PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT") {
      throw new Error("growth skip requires an explicit principal-deposit reason");
    }
    // Intentionally empty. No entry is appended.
  }

  list(): readonly GrowthAttributionEntry[] {
    return this.entries.slice();
  }

  count(): number {
    return this.entries.length;
  }
}
