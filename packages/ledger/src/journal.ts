import { randomUUID } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import type { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { catalogFor } from '../../domain/src/account-class.ts';
import { isOk } from '../../domain/src/result.ts';
import { AccountRegister } from './accounts.ts';
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
} from './invariants.ts';
import {
  LedgerInvariantError,
  type Journal,
  type LedgerAccount,
  type Posting,
  type PostJournalRequest,
} from './types.ts';
import type { ExecutionAuthority } from '../../permissions/src/execution-authority.ts';

/**
 * Optional durable sink. PostgreSQL implements this; in-memory tests omit it.
 * The sink is invoked only after invariants pass. It must not mutate the journal.
 */
export type JournalPersistSink = {
  queueAcceptedJournal(journal: Journal, executionAuthority: ExecutionAuthority): void;
};

/**
 * Exact journal-posting API
 *
 *   Ledger.postJournal(request: PostJournalRequest): Journal
 *
 * This is the only write path. executionAuthority is required. There is no
 * update or delete. Corrections are compensating entries (a new journal).
 *
 * Six invariants, none waivable:
 *   BALANCE         sum(DEBIT) == sum(CREDIT) per asset
 *   IMMUTABILITY    append-only
 *   AUTHORITY       every journal needs a valid signed EA bound to this action
 *   CLASS_BRIDGE    named disclosed bridge to cross classes
 *   NO_COMMINGLING  CUSTOMER and CORPORATE never share a journal
 *   IDEMPOTENCY     one journal per key
 */
export class Ledger {
  private readonly journals: Journal[] = [];
  private readonly byIdempotency = new Map<string, Journal>();
  readonly accounts: AccountRegister;
  private readonly authorityIssuer: AuthorityIssuer;
  private readonly clock: Clock;
  private readonly persist: JournalPersistSink | undefined;

  constructor(
    authorityIssuer: AuthorityIssuer,
    clock: Clock,
    accounts?: AccountRegister,
    persist?: JournalPersistSink,
  ) {
    this.authorityIssuer = authorityIssuer;
    this.clock = clock;
    this.accounts = accounts ?? new AccountRegister();
    this.persist = persist;
  }

  /**
   * Reconstruct journals from durable storage after process restart.
   * Does not re-issue authority and does not write. Empty-ledger only.
   */
  hydrateFromPersisted(journals: readonly Journal[]): void {
    if (this.journals.length !== 0 || this.byIdempotency.size !== 0) {
      throw new LedgerInvariantError(
        'IMMUTABILITY',
        'cannot hydrate a ledger that already has journals',
      );
    }
    this.replacePersistedJournals(journals);
  }

  /**
   * Replace in-memory journals from durable rows under a concurrency lock.
   * Used so concurrent money movement sees committed books before NSF checks.
   * Does not write and does not re-issue authority.
   */
  reloadFromPersisted(journals: readonly Journal[]): void {
    this.journals.length = 0;
    this.byIdempotency.clear();
    this.replacePersistedJournals(journals);
  }

  private replacePersistedJournals(journals: readonly Journal[]): void {
    for (const journal of journals) {
      const frozen = freezeJournal(journal);
      this.journals.push(frozen);
      this.byIdempotency.set(frozen.idempotencyKey, frozen);
    }
  }

  postJournal(request: PostJournalRequest): Journal {
    assertIdempotencyKey(request.idempotencyKey);
    assertPostingsNonEmpty(request.postings);
    assertNoFloatAmounts(request.postings);

    const existing = this.byIdempotency.get(request.idempotencyKey);
    if (existing) {
      const next = journalFingerprint(request);
      const prev = existingJournalFingerprint(existing);
      if (next !== prev) {
        throw new LedgerInvariantError(
          'IDEMPOTENCY',
          'idempotency key already bound to a different journal',
        );
      }
      return existing;
    }

    if (!request.executionAuthority) {
      throw new LedgerInvariantError(
        'AUTHORITY',
        'every journal requires a signed Execution Authority',
      );
    }

    const resolved: LedgerAccount[] = request.postings.map((p) =>
      this.accounts.get(p.accountId),
    );
    for (let i = 0; i < resolved.length; i += 1) {
      const account = resolved[i]!;
      const posting = request.postings[i]!;
      if (account.currency !== posting.amount.currency) {
        throw new LedgerInvariantError(
          'BALANCE',
          `account ${account.id} is ${account.currency}, posting is ${posting.amount.currency}`,
        );
      }
    }

    assertNoCommingling(resolved);
    const { asset } = assertBalanced(request.postings);
    const classBridgeName = assertClassBridge(resolved, request.classBridge);

    this.assertAuthority(request);

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
      createdAt: this.clock.now(),
    });

    this.journals.push(journal);
    this.byIdempotency.set(request.idempotencyKey, journal);
    this.persist?.queueAcceptedJournal(journal, request.executionAuthority);
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

  listPostingsForAccount(accountId: string): readonly Posting[] {
    const out: Posting[] = [];
    for (const journal of this.journals) {
      for (const posting of journal.postings) {
        if (posting.accountId === accountId) {
          out.push(posting);
        }
      }
    }
    return out;
  }

  totalsByAsset(): ReadonlyMap<string, { debits: bigint; credits: bigint }> {
    const totals = new Map<string, { debits: bigint; credits: bigint }>();
    for (const journal of this.journals) {
      for (const posting of journal.postings) {
        const row = totals.get(posting.amount.currency) ?? {
          debits: 0n,
          credits: 0n,
        };
        if (posting.direction === 'DEBIT') {
          row.debits += posting.amount.minorUnits;
        } else {
          row.credits += posting.amount.minorUnits;
        }
        totals.set(posting.amount.currency, row);
      }
    }
    return totals;
  }

  updateJournal(_id: string): never {
    throw new LedgerInvariantError(
      'IMMUTABILITY',
      'journals are append-only; corrections are compensating entries',
    );
  }

  deleteJournal(_id: string): never {
    throw new LedgerInvariantError(
      'IMMUTABILITY',
      'journals are append-only; corrections are compensating entries',
    );
  }

  updatePosting(_id: string): never {
    throw new LedgerInvariantError(
      'IMMUTABILITY',
      'postings are append-only; corrections are compensating entries',
    );
  }

  deletePosting(_id: string): never {
    throw new LedgerInvariantError(
      'IMMUTABILITY',
      'postings are append-only; corrections are compensating entries',
    );
  }

  private assertAuthority(request: PostJournalRequest): void {
    const ea = request.executionAuthority;
    const scopedAccount = request.postings[0]!.accountId;
    const customerPosting = request.postings.find((p) => {
      const account = this.accounts.get(p.accountId);
      return account.ownerId !== undefined;
    });
    const accountId = customerPosting?.accountId ?? scopedAccount;
    const verified = this.authorityIssuer.verify(
      ea,
      {
        actionType: request.actionType,
        accountId: ea.accountId,
        intentId: ea.intentId,
      },
      this.clock,
    );
    if (!isOk(verified)) {
      throw new LedgerInvariantError('AUTHORITY', verified.error.message);
    }
    if (ea.actionType !== request.actionType) {
      throw new LedgerInvariantError(
        'AUTHORITY',
        'Execution Authority actionType does not bind this journal',
      );
    }
    if (!paymentIdempotencyMatches(ea.idempotencyKey, request.idempotencyKey)) {
      throw new LedgerInvariantError(
        'AUTHORITY',
        'Execution Authority idempotency key does not bind this journal',
      );
    }
    if (customerPosting && ea.accountId !== accountId && ea.accountId !== customerPosting.accountId) {
      throw new LedgerInvariantError(
        'AUTHORITY',
        'Execution Authority accountId does not bind a posting on this journal',
      );
    }
    const bound = request.postings.some((p) => p.accountId === ea.accountId);
    if (!bound) {
      const systemBookAction =
        request.actionType === 'INITIATE_PAYMENT' ||
        request.actionType === 'CANCEL_PAYMENT' ||
        request.actionType === 'ACCEPT_INBOUND_PAYMENT' ||
        request.actionType === 'CLEAR_CARD_TRANSACTION' ||
        request.actionType === 'REFUND_CARD_TRANSACTION' ||
        request.actionType === 'ASSESS_CARD_FEE' ||
        request.actionType === 'DECIDE_CARD_DISPUTE' ||
        request.actionType === 'SETTLE_ACCEPTANCE_PAYMENT' ||
        request.actionType === 'EXECUTE_TREASURY_REBALANCE';
      const journalAccounts = request.postings.map((p) => this.accounts.get(p.accountId));
      const allNonCustomer = journalAccounts.every(
        (account) =>
          account.ownerId === undefined ||
          catalogFor(account.accountClass).fundOwnership !== 'CUSTOMER',
      );
      if (!(systemBookAction && allNonCustomer)) {
        throw new LedgerInvariantError(
          'AUTHORITY',
          'Execution Authority accountId does not bind any posting on this journal',
        );
      }
    }
  }
}

const PAYMENT_JOURNAL_SUFFIXES = new Set([
  'reserve',
  'capture-principal',
  'capture-fee',
  'fee-income',
  'fx-debit',
  'fx-credit',
  'settle',
  'release',
  'return-principal',
  'return-fx-debit',
  'return-fx-credit',
  'return-settle',
  'return-fee',
  'inbound-pending',
  'inbound-settle',
  'settle-reclass',
  'settle-direct',
  'refund',
  'fee',
  'customer-fee',
  'dispute-provisional',
  'dispute-provisional-reverse',
  'dispute-final',
  'acceptance-credit',
  'acceptance-fee',
  'cash',
]);

function paymentIdempotencyMatches(eaKey: string, journalKey: string): boolean {
  if (eaKey === journalKey) {
    return true;
  }
  if (!journalKey.startsWith(`${eaKey}:`)) {
    return false;
  }
  return PAYMENT_JOURNAL_SUFFIXES.has(journalKey.slice(eaKey.length + 1));
}
