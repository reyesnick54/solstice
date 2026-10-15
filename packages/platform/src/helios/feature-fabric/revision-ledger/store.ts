/**
 * In-memory AAF06 revision ledger with snapshot/restore. Entries are never overwritten.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { RevisionLedgerEntry, RevisionLedgerSnapshot } from './types.ts';

export type RevisionLedgerStore = {
  readonly append: (entry: RevisionLedgerEntry) => void;
  readonly listChain: (revisionChainId: string) => readonly RevisionLedgerEntry[];
  readonly list: () => readonly RevisionLedgerEntry[];
  readonly snapshot: () => RevisionLedgerSnapshot;
  readonly restore: (snapshot: RevisionLedgerSnapshot) => void;
};

export function createRevisionLedgerStore(): RevisionLedgerStore {
  const entries: RevisionLedgerEntry[] = [];
  const byChain = new Map<string, RevisionLedgerEntry[]>();
  const byObservationRef = new Map<string, RevisionLedgerEntry>();

  function indexEntry(entry: RevisionLedgerEntry): void {
    const chain = byChain.get(entry.revisionChainId) ?? [];
    chain.push(entry);
    chain.sort((a, b) => a.revisionSequence - b.revisionSequence);
    byChain.set(entry.revisionChainId, chain);
    byObservationRef.set(entry.observationRef, entry);
  }

  return Object.freeze({
    append(entry: RevisionLedgerEntry) {
      if (byObservationRef.has(entry.observationRef)) {
        throw new Error(`DUPLICATE_OBSERVATION_REF:${entry.observationRef}`);
      }
      entries.push(entry);
      indexEntry(entry);
    },
    listChain(revisionChainId: string) {
      return Object.freeze([...(byChain.get(revisionChainId) ?? [])]);
    },
    list() {
      return Object.freeze([...entries]);
    },
    snapshot() {
      return Object.freeze({ entries: Object.freeze([...entries]) });
    },
    restore(snapshot: RevisionLedgerSnapshot) {
      entries.length = 0;
      byChain.clear();
      byObservationRef.clear();
      for (const entry of snapshot.entries) {
        entries.push(entry);
        indexEntry(entry);
      }
    },
  });
}

export function selectKnowableRevisionAt(
  chain: readonly RevisionLedgerEntry[],
  decisionTime: UtcInstant,
  revisionPolicy: 'LATEST_KNOWABLE_REVISION' | 'INITIAL_PUBLICATION_ONLY',
): RevisionLedgerEntry | null {
  const knowable = chain.filter((row) => Date.parse(row.knowableAt) <= Date.parse(decisionTime));
  if (knowable.length === 0) {
    return null;
  }
  if (revisionPolicy === 'INITIAL_PUBLICATION_ONLY') {
    return knowable.find((row) => row.revisionSequence === 0) ?? knowable[0] ?? null;
  }
  return knowable.reduce((best, row) =>
    row.revisionSequence >= best.revisionSequence ? row : best,
  );
}
