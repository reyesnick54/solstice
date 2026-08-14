import type { AccountId, CustomerId } from '@solstice/domain';
import { Money } from '@solstice/domain';
import type { LedgerBooks } from '@solstice/ledger';

/**
 * Simulated PYR custody interface (Phase 8-shaped).
 * Positions are derived from ledger postings. No stored balance.
 * No real chain, venue, or custodian is contacted.
 */
export class SimulatedPyrCustody {
  readonly #books: LedgerBooks;
  readonly #accountFor: (customerId: CustomerId | 'HOUSE', asset: string) => AccountId | undefined;
  /**
   * Shadow offset used only to demonstrate reconciliation halt.
   * Never written back onto the ledger. Never auto-cleared.
   */
  readonly #uncorrectedOffset = new Map<string, bigint>();

  constructor(
    books: LedgerBooks,
    accountFor: (customerId: CustomerId | 'HOUSE', asset: string) => AccountId | undefined,
  ) {
    this.#books = books;
    this.#accountFor = accountFor;
  }

  position(customerId: CustomerId | 'HOUSE', asset: string): bigint {
    const accountId = this.#accountFor(customerId, asset);
    if (!accountId) return 0n;
    const derived = this.#books.positionForAccount(accountId);
    const ledgerQty = derived.ok ? derived.value.minorUnits : 0n;
    const offset = this.#uncorrectedOffset.get(`${customerId}:${asset}`) ?? 0n;
    return ledgerQty + offset;
  }

  ledgerPosition(customerId: CustomerId | 'HOUSE', asset: string): bigint {
    const accountId = this.#accountFor(customerId, asset);
    if (!accountId) return 0n;
    const derived = this.#books.positionForAccount(accountId);
    return derived.ok ? derived.value.minorUnits : 0n;
  }

  money(customerId: CustomerId | 'HOUSE', asset: string): Money {
    return Money.of(this.ledgerPosition(customerId, asset), asset);
  }

  /**
   * Test/demo hook: inject a custody/ledger disagreement.
   * Does not post a journal. Does not correct anything.
   */
  injectUncorrectedDivergence(customerId: CustomerId, asset: string, offset: bigint): void {
    this.#uncorrectedOffset.set(`${customerId}:${asset}`, offset);
  }

  hasInjectedDivergence(): boolean {
    return [...this.#uncorrectedOffset.values()].some((value) => value !== 0n);
  }
}
