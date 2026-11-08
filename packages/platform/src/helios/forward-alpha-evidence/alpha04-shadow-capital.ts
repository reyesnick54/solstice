/**
 * ALPHA04 — shadow capital book for forward decisions (no live capital movement).
 */

import type { ForwardAlphaDecisionRecord } from './types.ts';

export const HELIOS_ALPHA04_SHADOW_CAPITAL = 'HELIOS_ALPHA04_SHADOW_CAPITAL' as const;

export type ShadowCapitalBook = {
  readonly records: readonly ForwardAlphaDecisionRecord[];
};

export function createShadowCapitalBook(): { records: ForwardAlphaDecisionRecord[] } {
  return { records: [] };
}

export function appendShadowDecision(
  book: { records: ForwardAlphaDecisionRecord[] },
  record: ForwardAlphaDecisionRecord,
): ShadowCapitalBook {
  const last = book.records[book.records.length - 1];
  if (last && last.recordedAt > record.recordedAt) {
    throw new Error('shadow book: chronological append violated');
  }
  book.records.push(record);
  return Object.freeze({ records: Object.freeze([...book.records]) });
}

export function shadowDecisionCount(book: ShadowCapitalBook): number {
  return book.records.length;
}
