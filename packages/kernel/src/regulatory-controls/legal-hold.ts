/**
 * Wave 7 — Legal hold support.
 *
 * Preserves specified off-chain records, prevents retention deletion,
 * and records authority/reference. Does not implement legal interpretation.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { LEGAL_REVIEW_STATUS, type RetentionCategory } from './taxonomy.ts';
import type { LegalHoldRecord } from './types.ts';

export type CreateLegalHoldInput = {
  readonly authorityRef: string;
  readonly subjectRef: string;
  readonly recordCategories: readonly RetentionCategory[];
  readonly effectiveFrom: UtcInstant;
};

export function createLegalHold(input: CreateLegalHoldInput): LegalHoldRecord {
  return Object.freeze({
    holdId: `lhold_${randomUUID()}`,
    authorityRef: input.authorityRef,
    subjectRef: input.subjectRef,
    recordCategories: Object.freeze([...input.recordCategories]),
    effectiveFrom: input.effectiveFrom,
    releasedAt: null,
    active: true,
    legalStatus: LEGAL_REVIEW_STATUS,
  });
}

export function releaseLegalHold(hold: LegalHoldRecord, releasedAt: UtcInstant): LegalHoldRecord {
  if (!hold.active) {
    throw new Error(`legal hold ${hold.holdId} is already released`);
  }
  return Object.freeze({
    ...hold,
    releasedAt,
    active: false,
  });
}

export class LegalHoldRegistry {
  private readonly holds: LegalHoldRecord[] = [];

  place(input: CreateLegalHoldInput): LegalHoldRecord {
    const hold = createLegalHold(input);
    this.holds.push(hold);
    return hold;
  }

  release(holdId: string, releasedAt: UtcInstant): LegalHoldRecord {
    const index = this.holds.findIndex((hold) => hold.holdId === holdId);
    if (index < 0) {
      throw new Error(`legal hold ${holdId} not found`);
    }
    const released = releaseLegalHold(this.holds[index]!, releasedAt);
    this.holds[index] = released;
    return released;
  }

  active(): readonly LegalHoldRecord[] {
    return Object.freeze(this.holds.filter((hold) => hold.active));
  }

  activeForSubject(subjectRef: string): readonly LegalHoldRecord[] {
    return Object.freeze(this.holds.filter((hold) => hold.active && hold.subjectRef === subjectRef));
  }

  all(): readonly LegalHoldRecord[] {
    return Object.freeze([...this.holds]);
  }
}

export function isDeletionBlockedByLegalHold(
  category: RetentionCategory,
  holds: readonly LegalHoldRecord[],
): boolean {
  return holds.some((hold) => hold.active && hold.recordCategories.includes(category));
}
