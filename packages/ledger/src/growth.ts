import type { Money } from '../../money/src/money.ts';

export type GrowthAttributionEntry = {
  readonly id: string;
  readonly journalId: string;
  readonly reason: 'INTEREST' | 'YIELD' | 'MARK_TO_MARKET';
  readonly amount: Money;
  readonly recordedAt: string;
};

/**
 * Growth Attribution Ledger.
 *
 * Records genuine economic improvement only: interest, yield, or mark-to-market.
 *
 * A principal deposit is inbound customer funds. It increases a customer
 * liability and a simulation source asset by the same amount. That is NOT
 * economic improvement and must not be recorded here.
 *
 * A withdrawal is a principal return, not a loss attribution.
 * An internal transfer moves principal between the same owner's accounts;
 * that is not growth either.
 */
export class GrowthAttributionLedger {
  private readonly entries: GrowthAttributionEntry[] = [];

  record(_entry: GrowthAttributionEntry): never {
    throw new Error(
      'Growth attribution is reserved for economic improvement (interest/yield). ' +
        'A principal deposit, withdrawal, or transfer must not be recorded here.',
    );
  }

  /**
   * Explicit no-op so the decision is visible in call stacks and reviews:
   * principal is not growth.
   */
  skipPrincipalMovement(reason: string): void {
    const allowed = new Set([
      'PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT',
      'PRINCIPAL_WITHDRAWAL_IS_NOT_ECONOMIC_IMPROVEMENT',
      'PRINCIPAL_TRANSFER_IS_NOT_ECONOMIC_IMPROVEMENT',
    ]);
    if (!allowed.has(reason)) {
      throw new Error('growth skip requires an explicit principal-movement reason');
    }
  }

  list(): readonly GrowthAttributionEntry[] {
    return this.entries.slice();
  }

  count(): number {
    return this.entries.length;
  }
}
