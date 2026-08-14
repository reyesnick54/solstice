import {
  asJournalId,
  asJournalLineId,
  err,
  ok,
  type AccountId,
  type ActionIntentId,
  type CurrencyCode,
  type JournalId,
  type Result,
  type UtcInstant,
  Money,
  type Rational,
} from '@solstice/domain';
import {
  assertKernelAuthorizationAny,
  type KernelAuthorization,
} from '@solstice/kernel';

export type DebitCredit = 'DEBIT' | 'CREDIT';

export type JournalLine = {
  readonly id: string;
  readonly accountId: AccountId;
  readonly direction: DebitCredit;
  readonly amount: Money;
};

export type FxJournalMeta = {
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  readonly rate: Rational;
  readonly timestamp: UtcInstant;
};

export type Journal = {
  readonly id: JournalId;
  readonly intentId: ActionIntentId;
  readonly lines: readonly JournalLine[];
  readonly memo: string;
  readonly postedAt: UtcInstant;
  readonly fx?: FxJournalMeta;
  readonly compensatesJournalId?: JournalId;
  readonly authorizationHash: string;
};

export type UnbalancedJournal = {
  readonly code: 'UNBALANCED_JOURNAL';
  readonly byCurrency: Readonly<Record<string, { debit: string; credit: string }>>;
};

export type JournalDraft = {
  readonly id?: JournalId;
  readonly intentId: ActionIntentId;
  readonly lines: readonly Omit<JournalLine, 'id'>[];
  readonly memo: string;
  readonly postedAt: UtcInstant;
  readonly fx?: FxJournalMeta;
  readonly compensatesJournalId?: JournalId;
};

const JOURNAL_KINDS = [
  'POST_JOURNAL',
  'SEED_CREDIT',
  'FX_CONVERT',
  'SEND_PAYMENT',
  'COMPENSATE_PAYMENT',
] as const;

export function journalBalances(lines: readonly Omit<JournalLine, 'id'>[]): {
  readonly ok: boolean;
  readonly byCurrency: Record<string, { debit: bigint; credit: bigint }>;
} {
  const byCurrency: Record<string, { debit: bigint; credit: bigint }> = {};
  for (const line of lines) {
    const currency = line.amount.currency;
    const bucket = byCurrency[currency] ?? { debit: 0n, credit: 0n };
    if (line.direction === 'DEBIT') {
      bucket.debit += line.amount.minorUnits;
    } else {
      bucket.credit += line.amount.minorUnits;
    }
    byCurrency[currency] = bucket;
  }
  const okBalanced = Object.values(byCurrency).every((bucket) => bucket.debit === bucket.credit);
  return { ok: okBalanced, byCurrency };
}

/**
 * @kernelGated
 * Append-only journal commit. Requires KernelAuthorization.
 * Posted journals are never edited; reversals are new compensating journals.
 */
export function commitJournal(
  store: JournalStore,
  authorization: KernelAuthorization,
  draft: JournalDraft,
): Result<Journal, UnbalancedJournal> {
  assertKernelAuthorizationAny(authorization, JOURNAL_KINDS);
  const balanced = journalBalances(draft.lines);
  if (!balanced.ok) {
    const byCurrency: Record<string, { debit: string; credit: string }> = {};
    for (const [currency, bucket] of Object.entries(balanced.byCurrency)) {
      byCurrency[currency] = {
        debit: bucket.debit.toString(),
        credit: bucket.credit.toString(),
      };
    }
    return err({ code: 'UNBALANCED_JOURNAL', byCurrency });
  }

  const journal: Journal = Object.freeze({
    id: draft.id ?? asJournalId(`jnl_${authorization.intentId}_${store.list().length + 1}`),
    intentId: draft.intentId,
    lines: Object.freeze(
      draft.lines.map((line, index) =>
        Object.freeze({
          id: asJournalLineId(`${authorization.intentId}_L${index + 1}`),
          accountId: line.accountId,
          direction: line.direction,
          amount: line.amount,
        }),
      ),
    ),
    memo: draft.memo,
    postedAt: draft.postedAt,
    ...(draft.fx === undefined
      ? {}
      : {
          fx: Object.freeze({
            from: draft.fx.from,
            to: draft.fx.to,
            rate: draft.fx.rate,
            timestamp: draft.fx.timestamp,
          }),
        }),
    ...(draft.compensatesJournalId === undefined
      ? {}
      : { compensatesJournalId: draft.compensatesJournalId }),
    authorizationHash: authorization.permitHash,
  });

  store.appendJournal(journal);
  return ok(journal);
}

/**
 * Internal append surface. Only commitJournal may call this.
 * CI forbids other callers of appendJournal.
 */
export class JournalStore {
  readonly #journals: Journal[] = [];

  /** @kernelGatedInternal */
  appendJournal(journal: Journal): void {
    this.#journals.push(journal);
  }

  list(): readonly Journal[] {
    return this.#journals.slice();
  }

  getById(id: JournalId): Journal | undefined {
    return this.#journals.find((journal) => journal.id === id);
  }

  linesForAccount(accountId: AccountId): readonly JournalLine[] {
    const lines: JournalLine[] = [];
    for (const journal of this.#journals) {
      for (const line of journal.lines) {
        if (line.accountId === accountId) {
          lines.push(line);
        }
      }
    }
    return lines;
  }
}

export function signedEffect(line: JournalLine): Money {
  // Debit increases asset-class accounts; credit decreases them.
  if (line.direction === 'DEBIT') {
    return line.amount;
  }
  return line.amount.negate();
}
