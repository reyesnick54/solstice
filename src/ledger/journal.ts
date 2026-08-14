import { randomUUID } from "node:crypto";
import type { AuthorityIssuer } from "../authority/ExecutionAuthority.ts";
import type { Clock } from "../clock.ts";
import { AccountRegister } from "./accounts.ts";
import {
  assertBalanced,
  assertClassBridge,
  assertIdempotencyKey,
  assertNoCommingling,
  assertNoFloatAmounts,
  assertPostingsNonEmpty,
  existingJournalFingerprint,
  freezeJournal,
  journalFingerprint,
} from "./invariants.ts";
import {
  LedgerInvariantError,
  type Account,
  type Journal,
  type Posting,
  type PostJournalRequest,
} from "./types.ts";

/**
 * Exact journal-posting API
 * ========================
 *
 *   Ledger.postJournal(request: PostJournalRequest): Journal
 *   file: src/ledger/journal.ts
 *
 * Request (src/ledger/types.ts — PostJournalRequest):
 *   idempotencyKey        required; replay of the same key + same postings
 *                         returns the original journal; a conflicting payload
 *                         is an IDEMPOTENCY invariant failure
 *   executionAuthority    required when any posting touches CUSTOMER;
 *                         verified (signature + expiry + binding) before insert
 *   actionType            recorded on the journal
 *   postings[]            each { accountId, direction: DEBIT|CREDIT, amount: Money }
 *   classBridge           required when postings span more than one AccountClass
 *   memo                  optional
 *
 * Six invariants enforced here, none waivable:
 *   BALANCE         sum(DEBIT) == sum(CREDIT) per asset
 *   IMMUTABILITY    append-only; no update/delete API exists
 *   AUTHORITY       customer-touching journals need a valid signed EA
 *   CLASS_BRIDGE    named disclosed bridge to cross classes
 *   NO_COMMINGLING  CUSTOMER and CORPORATE never share a journal
 *   IDEMPOTENCY     one journal per key
 *
 * There is no edit, update, or delete of a posting. Corrections are a new
 * compensating journal (not implemented on the deposit path).
 */
export class Ledger {
  private readonly journals: Journal[] = [];
  private readonly byIdempotency = new Map<string, Journal>();
  readonly accounts: AccountRegister;

  constructor(
    private readonly authorityIssuer: AuthorityIssuer,
    private readonly clock: Clock,
    accounts?: AccountRegister,
  ) {
    this.accounts = accounts ?? new AccountRegister();
  }

  postJournal(request: PostJournalRequest & { readonly executionAuthority: import("./types.ts").ExecutionAuthorityView }): Journal {
    assertIdempotencyKey(request.idempotencyKey);
    assertPostingsNonEmpty(request.postings);
    assertNoFloatAmounts(request.postings);

    const existing = this.byIdempotency.get(request.idempotencyKey);
    if (existing) {
      const next = journalFingerprint(request);
      const prev = existingJournalFingerprint(existing);
      if (next !== prev) {
        throw new LedgerInvariantError(
          "IDEMPOTENCY",
          "idempotency key already bound to a different journal",
        );
      }
      return existing;
    }

    const resolved: Account[] = request.postings.map((p) =>
      this.accounts.get(p.accountId),
    );
    for (let i = 0; i < resolved.length; i += 1) {
      const account = resolved[i]!;
      const posting = request.postings[i]!;
      if (account.asset !== posting.amount.currency) {
        throw new LedgerInvariantError(
          "BALANCE",
          `account ${account.id} is ${account.asset}, posting is ${posting.amount.currency}`,
        );
      }
    }

    assertNoCommingling(resolved);
    const { asset } = assertBalanced(request.postings);
    const classBridgeName = assertClassBridge(resolved, request.classBridge);

    const touchesCustomer = resolved.some((a) => a.class === "CUSTOMER");
    if (touchesCustomer) {
      if (!request.executionAuthority) {
        throw new LedgerInvariantError(
          "AUTHORITY",
          "customer-touching journal requires a signed Execution Authority",
        );
      }
      this.authorityIssuer.verify(request.executionAuthority, this.clock);
      this.assertAuthorityBinds(request);
    }

    const journalId = randomUUID();
    const postings: Posting[] = request.postings.map((p) =>
      Object.freeze({
        id: randomUUID(),
        accountId: p.accountId,
        direction: p.direction,
        amount: p.amount,
      }),
    );

    const journal = freezeJournal({
      id: journalId,
      idempotencyKey: request.idempotencyKey,
      executionAuthorityId: request.executionAuthority.authorityId,
      actionType: request.actionType,
      asset,
      postings,
      ...(classBridgeName !== undefined ? { classBridgeName } : {}),
      ...(request.memo !== undefined ? { memo: request.memo } : {}),
      createdAt: this.clock.now().toISOString(),
    });

    this.journals.push(journal);
    this.byIdempotency.set(request.idempotencyKey, journal);
    return journal;
  }

  getJournal(id: string): Journal | undefined {
    return this.journals.find((j) => j.id === id);
  }

  getJournalByIdempotencyKey(key: string): Journal | undefined {
    return this.byIdempotency.get(key);
  }

  listJournals(): readonly Journal[] {
    return this.journals.slice();
  }

  journalCount(): number {
    return this.journals.length;
  }

  /**
   * Totals across all journals. Used by tests to assert books still balance
   * after an operation. Computed from the append-only log; never stored as
   * a mutable running balance that could drift.
   */
  totalsByAsset(): ReadonlyMap<string, { debits: bigint; credits: bigint }> {
    const totals = new Map<string, { debits: bigint; credits: bigint }>();
    for (const journal of this.journals) {
      for (const posting of journal.postings) {
        const row = totals.get(posting.amount.currency) ?? {
          debits: 0n,
          credits: 0n,
        };
        if (posting.direction === "DEBIT") {
          row.debits += posting.amount.minorUnits;
        } else {
          row.credits += posting.amount.minorUnits;
        }
        totals.set(posting.amount.currency, row);
      }
    }
    return totals;
  }

  /**
   * IMMUTABILITY: there is no update or delete. These methods exist so a
   * mistaken call fails as an invariant, not as a silent no-op.
   */
  updateJournal(_id: string): never {
    throw new LedgerInvariantError(
      "IMMUTABILITY",
      "journals are append-only; corrections are compensating entries",
    );
  }

  deleteJournal(_id: string): never {
    throw new LedgerInvariantError(
      "IMMUTABILITY",
      "journals are append-only; corrections are compensating entries",
    );
  }

  updatePosting(_id: string): never {
    throw new LedgerInvariantError(
      "IMMUTABILITY",
      "postings are append-only; corrections are compensating entries",
    );
  }

  deletePosting(_id: string): never {
    throw new LedgerInvariantError(
      "IMMUTABILITY",
      "postings are append-only; corrections are compensating entries",
    );
  }

  private assertAuthorityBinds(request: PostJournalRequest): void {
    const ea = request.executionAuthority;
    if (ea.actionType !== request.actionType) {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "Execution Authority actionType does not bind this journal",
      );
    }
    if (ea.idempotencyKey !== request.idempotencyKey) {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "Execution Authority idempotency key does not bind this journal",
      );
    }
    const customerPosting = request.postings.find((p) => {
      return this.accounts.get(p.accountId).class === "CUSTOMER";
    });
    if (!customerPosting) {
      return;
    }
    if (ea.accountId !== customerPosting.accountId) {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "Execution Authority accountId does not bind the customer posting",
      );
    }
    if (!ea.amount.equals(customerPosting.amount)) {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "Execution Authority amount does not bind the customer posting",
      );
    }
  }
}
