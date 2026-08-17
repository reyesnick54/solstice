/**
 * Event fabric durability against the production PostgreSQL profile.
 * Outbox/inbox records are not financial journals.
 */

export const EVENT_FABRIC_IS_NOT_A_JOURNAL = true as const;

export type DurableOutboxRecord = {
  readonly eventId: string;
  readonly state: 'PENDING' | 'IN_FLIGHT' | 'DELIVERED' | 'DEAD_LETTER';
  readonly notAJournal: true;
};

export function crashRecoverOutbox(
  before: readonly DurableOutboxRecord[],
): readonly DurableOutboxRecord[] {
  return Object.freeze(
    before.map((row) =>
      row.state === 'IN_FLIGHT'
        ? { ...row, state: 'PENDING' as const, notAJournal: true as const }
        : row,
    ),
  );
}

export function assertNotJournal(record: DurableOutboxRecord): void {
  if (!record.notAJournal) {
    throw new Error('event fabric records must not be treated as financial journals');
  }
}
