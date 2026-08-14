import type { AccountId, CustomerId } from "./account.ts";
import type { Money } from "./money.ts";

export type PostingId = string & { readonly __brand: "PostingId" };

export function postingId(value: string): PostingId {
  return value as PostingId;
}

/**
 * An immutable ledger posting. Signed `amount` increases (positive) or
 * decreases (negative) the account. Postings are the sole source of truth
 * for balances — nothing else may be treated as authoritative.
 */
export type LedgerPosting = {
  readonly id: PostingId;
  readonly accountId: AccountId;
  readonly customerId: CustomerId;
  readonly amount: Money;
  readonly postedAt: Date;
};

/**
 * Read-only posting query interface. The balance projection uses only these
 * methods and never records postings.
 *
 * Query paths:
 * - `listByAccount(accountId)` — all postings for one account, for summing
 *   that account's balance.
 * - `listByCustomer(customerId)` — all postings for a customer, available
 *   for diagnostics; the position projection walks accounts then uses
 *   `listByAccount` so zero-posting accounts still appear.
 */
export interface PostingQuery {
  listByAccount(accountId: AccountId): ReadonlyArray<LedgerPosting>;
  listByCustomer(customerId: CustomerId): ReadonlyArray<LedgerPosting>;
}

/**
 * In-memory posting store for tests and the demo. Stores postings only —
 * never a derived balance. `record` is fixture infrastructure; the
 * balance read model never calls it.
 */
export class InMemoryPostingStore implements PostingQuery {
  readonly #postings: LedgerPosting[] = [];

  record(posting: LedgerPosting): void {
    this.#postings.push(
      Object.freeze({
        ...posting,
        amount: posting.amount,
        postedAt: posting.postedAt,
      }),
    );
  }

  get postingCount(): number {
    return this.#postings.length;
  }

  listByAccount(accountId: AccountId): ReadonlyArray<LedgerPosting> {
    return this.#postings.filter((posting) => posting.accountId === accountId);
  }

  listByCustomer(customerId: CustomerId): ReadonlyArray<LedgerPosting> {
    return this.#postings.filter(
      (posting) => posting.customerId === customerId,
    );
  }
}
