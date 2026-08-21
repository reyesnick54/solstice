import { catalogFor } from '../../domain/src/account-class.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import {
  ledgerAmountKind,
  ledgerAssetKey,
  ledgerScaledUnits,
} from '../../money/src/ledger-amount.ts';
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
    if (!(posting.amount instanceof Money) && !(posting.amount instanceof AssetQuantity)) {
      throw new LedgerInvariantError(
        'BALANCE',
        'every posting amount must be a Money or AssetQuantity instance',
      );
    }
    if (typeof ledgerScaledUnits(posting.amount) !== 'bigint') {
      throw new LedgerInvariantError(
        'BALANCE',
        'ledger amounts must be bigint scaled units; floating-point is forbidden',
      );
    }
    if (posting.amount instanceof Money && !posting.amount.isPositive()) {
      throw new LedgerInvariantError(
        'BALANCE',
        'posting amounts must be strictly positive minor units',
      );
    }
    if (posting.amount instanceof AssetQuantity && !posting.amount.isPositive()) {
      throw new LedgerInvariantError(
        'BALANCE',
        'posting amounts must be strictly positive scaled units',
      );
    }
  }
}

/**
 * BALANCE: total debits equal total credits per asset.
 * A journal is single-asset and single-kind. Money and AssetQuantity
 * must never share a journal.
 */
export function assertBalanced(
  postings: readonly ProposedPosting[],
): { asset: string; totalScaled: bigint } {
  const kinds = new Set(postings.map((p) => ledgerAmountKind(p.amount)));
  if (kinds.size !== 1) {
    throw new LedgerInvariantError(
      'BALANCE',
      'a journal must not mix Money and AssetQuantity; mixed-kind journals are not permitted',
    );
  }
  const assets = new Set(postings.map((p) => ledgerAssetKey(p.amount)));
  if (assets.size !== 1) {
    throw new LedgerInvariantError(
      'BALANCE',
      'a journal must be single-asset; multi-asset journals are not permitted',
    );
  }
  const asset = [...assets][0]!;
  let debits = 0n;
  let credits = 0n;
  for (const posting of postings) {
    const units = ledgerScaledUnits(posting.amount);
    if (posting.direction === 'DEBIT') {
      debits += units;
    } else if (posting.direction === 'CREDIT') {
      credits += units;
    } else {
      throw new LedgerInvariantError(
        'BALANCE',
        `unknown posting direction: ${String(posting.direction)}`,
      );
    }
  }
  if (debits !== credits) {
    throw new LedgerInvariantError(
      'BALANCE',
      `debits ${debits} != credits ${credits} ${asset}`,
    );
  }
  return { asset, totalScaled: debits };
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
    status: journal.status ?? 'POSTED',
    effectiveAt: journal.effectiveAt ?? journal.createdAt,
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
        `${p.accountId}:${p.direction}:${ledgerAssetKey(p.amount)}:${ledgerScaledUnits(p.amount).toString()}`,
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
