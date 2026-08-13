import { randomUUID } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import type { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
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

  constructor(
    authorityIssuer: AuthorityIssuer,
    clock: Clock,
    accounts?: AccountRegister,
  ) {
    this.authorityIssuer = authorityIssuer;
    this.clock = clock;
    this.accounts = accounts ?? new AccountRegister();
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
    if (ea.idempotencyKey !== request.idempotencyKey) {
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
      throw new LedgerInvariantError(
        'AUTHORITY',
        'Execution Authority accountId does not bind any posting on this journal',
      );
    }
  }
}
