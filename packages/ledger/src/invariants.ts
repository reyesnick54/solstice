import { catalogFor } from '../../domain/src/account-class.ts';
import { Money } from '../../money/src/money.ts';
import {
  LedgerInvariantError,
  type ClassBridge,
  type Journal,
  type LedgerAccount,
  type Posting,
  type ProposedPosting,
} from './types.ts';

export function assertIdempotencyKey(key: string): void {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new LedgerInvariantError('IDEMPOTENCY', 'an idempotency key is required on every journal');
  }
}

export function assertPostingsNonEmpty(postings: readonly ProposedPosting[]): void {
  if (postings.length < 2) {
    throw new LedgerInvariantError('BALANCE', 'a journal must have at least two postings');
  }
}

export function assertNoFloatAmounts(postings: readonly ProposedPosting[]): void {
  for (const posting of postings) {
    if (!(posting.amount instanceof Money)) {
      throw new LedgerInvariantError('BALANCE', 'every posting amount must be a Money instance');
    }
    if (typeof posting.amount.minorUnits !== 'bigint') {
      throw new LedgerInvariantError(
        'BALANCE',
        'Money minor units must be bigint; floating-point is forbidden',
      );
    }
    if (!posting.amount.isPositive()) {
      throw new LedgerInvariantError(
        'BALANCE',
        'posting amounts must be strictly positive minor units',
      );
    }
  }
}

/**
 * BALANCE: total debits equal total credits per asset.
 */
export function assertBalanced(
  postings: readonly ProposedPosting[],
): { asset: string; total: Money } {
  const assets = new Set(postings.map((p) => p.amount.currency));
  if (assets.size !== 1) {
    throw new LedgerInvariantError(
      'BALANCE',
      'a journal must be single-asset; multi-asset journals are not permitted',
    );
  }
  const asset = [...assets][0]!;
  let debits = Money.fromMinorUnits(0n, asset);
  let credits = Money.fromMinorUnits(0n, asset);
  for (const posting of postings) {
    if (posting.direction === 'DEBIT') {
      debits = debits.plus(posting.amount);
    } else if (posting.direction === 'CREDIT') {
      credits = credits.plus(posting.amount);
    } else {
      throw new LedgerInvariantError(
        'BALANCE',
        `unknown posting direction: ${String(posting.direction)}`,
      );
    }
  }
  if (!debits.equals(credits)) {
    throw new LedgerInvariantError(
      'BALANCE',
      `debits ${debits.minorUnits} != credits ${credits.minorUnits} ${asset}`,
    );
  }
  return { asset, total: debits };
}

/**
 * NO_COMMINGLING: customer and corporate funds may not share a journal.
 * A class bridge cannot waive this rule.
 */
export function assertNoCommingling(accounts: readonly LedgerAccount[]): void {
  const ownerships = new Set(accounts.map((a) => catalogFor(a.accountClass).fundOwnership));
  if (ownerships.has('CUSTOMER') && ownerships.has('CORPORATE')) {
    throw new LedgerInvariantError(
      'NO_COMMINGLING',
      'customer and corporate funds must not share a journal',
    );
  }
}

/**
 * CLASS_BRIDGE: crossing account classes requires a named disclosed bridge
 * whose from/to pair covers the classes present.
 */
export function assertClassBridge(
  accounts: readonly LedgerAccount[],
  bridge: ClassBridge | undefined,
): string | undefined {
  const classes = [...new Set(accounts.map((a) => a.accountClass))];
  if (classes.length <= 1) {
    return undefined;
  }
  if (!bridge) {
    throw new LedgerInvariantError(
      'CLASS_BRIDGE',
      `crossing account classes ${classes.join(',')} requires a named disclosed bridge`,
    );
  }
  if (bridge.disclosed !== true || bridge.name.trim().length === 0) {
    throw new LedgerInvariantError(
      'CLASS_BRIDGE',
      'class bridge must be named and disclosed; unlabelled plugs are forbidden',
    );
  }
  const pair = new Set([bridge.fromClass, bridge.toClass]);
  for (const cls of classes) {
    if (!pair.has(cls)) {
      throw new LedgerInvariantError(
        'CLASS_BRIDGE',
        `bridge ${bridge.name} does not cover class ${cls}`,
      );
    }
  }
  return bridge.name;
}

export function freezeJournal(journal: Journal): Journal {
  const postings: Posting[] = journal.postings.map((p) => Object.freeze({ ...p }));
  return Object.freeze({
    ...journal,
    postings: Object.freeze(postings),
  });
}

export function journalFingerprint(input: {
  actionType: string;
  postings: readonly ProposedPosting[];
}): string {
  const parts = input.postings
    .map(
      (p) =>
        `${p.accountId}:${p.direction}:${p.amount.currency}:${p.amount.minorUnits.toString()}`,
    )
    .sort();
  return `${input.actionType}|${parts.join('|')}`;
}

export function existingJournalFingerprint(journal: Journal): string {
  return journalFingerprint({
    actionType: journal.actionType,
    postings: journal.postings,
  });
}
