import { type Brand, brandAs } from './brand.ts';
import type { UtcInstant } from './time.ts';

export type ReversalId = Brand<string, 'ReversalId'>;

export function asReversalId(value: string): ReversalId {
  if (value.length === 0) {
    throw new TypeError('ReversalId must be a non-empty string');
  }
  return brandAs<string, 'ReversalId'>(value);
}

/**
 * A compensating journal reference. The original journal is never mutated
 * or deleted. The compensating journal inverts the original postings.
 */
export type ReversalRecord = {
  readonly id: ReversalId;
  readonly originalJournalId: string;
  readonly compensatingJournalId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
};

export function freezeReversal(record: ReversalRecord): ReversalRecord {
  if (record.originalJournalId === record.compensatingJournalId) {
    throw new TypeError('compensating journal must be a new journal');
  }
  return Object.freeze({ ...record });
}
