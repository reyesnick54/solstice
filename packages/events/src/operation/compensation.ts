/**
 * Compensation is not retry. A final local financial posting is corrected
 * only by a new compensating journal. Original journals are never edited
 * or deleted.
 */

export const COMPENSATION_ERASES_JOURNAL_HISTORY = false as const;
export const COMPENSATION_EDITS_ORIGINAL_JOURNAL = false as const;

export type CompensationProposal = {
  readonly kind: 'COMPENSATING_ENTRY';
  readonly originalJournalId: string;
  readonly operationId: string;
  readonly reason: string;
  readonly erasesOriginal: false;
  readonly editsOriginal: false;
  readonly postsNewJournal: true;
  readonly coordinatorCanPost: false;
};

export function proposeCompensatingEntry(input: {
  readonly originalJournalId: string;
  readonly operationId: string;
  readonly reason: string;
}): CompensationProposal {
  return Object.freeze({
    kind: 'COMPENSATING_ENTRY',
    originalJournalId: input.originalJournalId,
    operationId: input.operationId,
    reason: input.reason,
    erasesOriginal: false,
    editsOriginal: false,
    postsNewJournal: true,
    coordinatorCanPost: false,
  });
}

export function journalHistoryPreserved(
  journals: readonly { readonly journalId: string; readonly erased?: boolean }[],
  originalJournalId: string,
): boolean {
  const original = journals.find((row) => row.journalId === originalJournalId);
  return original !== undefined && original.erased !== true;
}
