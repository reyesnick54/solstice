import type { Money } from '../../money/src/money.ts';

export type GrowthAttributionEntry = {
  readonly id: string;
  readonly journalId: string;
  readonly reason: 'INTEREST' | 'YIELD' | 'MARK_TO_MARKET';
  readonly amount: Money;
  readonly recordedAt: string;
};

/**
 * Banking Growth Attribution Ledger — principal-movement guard.
 *
 * Records genuine economic improvement only: interest, yield, or mark-to-market.
 * Principal deposit, withdrawal, and transfer must not write here.
 *
 * Measurable economic-benefit attribution (fee avoided, subscription
 * eliminated, realized vs projected) is owned by the Personal Economic
 * Value Engine in `packages/platform/src/value`. That PEVE ledger is not
 * a financial journal and cannot move principal.
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
