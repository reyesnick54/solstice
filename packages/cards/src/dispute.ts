import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import type { CardClearingId, CardId, DisputeId } from './ids.ts';

export const DISPUTE_STATES = [
  'OPEN',
  'EVIDENCE_REQUIRED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'WON',
  'LOST',
  'CLOSED',
] as const;

export type DisputeState = (typeof DISPUTE_STATES)[number];

export const DISPUTE_REASON_CATEGORIES = [
  'MERCHANDISE_NOT_RECEIVED',
  'NOT_AS_DESCRIBED',
  'DUPLICATE_CHARGE',
  'FRAUD',
  'OTHER',
] as const;

export type DisputeReasonCategory = (typeof DISPUTE_REASON_CATEGORIES)[number];

const ALLOWED: Readonly<Record<DisputeState, readonly DisputeState[]>> = {
  OPEN: ['EVIDENCE_REQUIRED', 'SUBMITTED', 'CLOSED'],
  EVIDENCE_REQUIRED: ['SUBMITTED', 'CLOSED'],
  SUBMITTED: ['UNDER_REVIEW', 'CLOSED'],
  UNDER_REVIEW: ['WON', 'LOST', 'CLOSED'],
  WON: ['CLOSED'],
  LOST: ['CLOSED'],
  CLOSED: [],
};

export type DisputeStateChange = {
  readonly from: DisputeState;
  readonly to: DisputeState;
  readonly at: UtcInstant;
  readonly note: string;
};

export type CardDispute = {
  readonly disputeId: DisputeId;
  readonly cardId: CardId;
  readonly customerId: string;
  readonly transactionRef: CardClearingId;
  readonly reasonCategory: DisputeReasonCategory;
  readonly processorReference: string;
  readonly amount: Money;
  readonly evidenceRefs: readonly string[];
  readonly deadlineAt: UtcInstant | null;
  readonly state: DisputeState;
  readonly history: readonly DisputeStateChange[];
  readonly provisionalJournalId: string | null;
  readonly finalJournalId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type IllegalDisputeTransition = {
  readonly code: 'ILLEGAL_DISPUTE_TRANSITION';
  readonly from: DisputeState;
  readonly to: DisputeState;
};

export function canTransitionDispute(from: DisputeState, to: DisputeState): boolean {
  return ALLOWED[from].includes(to);
}

export function freezeDispute(dispute: CardDispute): CardDispute {
  assertNoSensitiveCardData(dispute, 'dispute');
  return Object.freeze({
    ...dispute,
    evidenceRefs: Object.freeze([...dispute.evidenceRefs]),
    history: Object.freeze(dispute.history.map((row) => Object.freeze({ ...row }))),
  });
}

export function transitionDispute(
  dispute: CardDispute,
  to: DisputeState,
  now: UtcInstant,
  note: string,
  patch: Partial<Pick<CardDispute, 'provisionalJournalId' | 'finalJournalId' | 'evidenceRefs'>> = {},
): Result<CardDispute, IllegalDisputeTransition> {
  if (!canTransitionDispute(dispute.state, to)) {
    return err({ code: 'ILLEGAL_DISPUTE_TRANSITION', from: dispute.state, to });
  }
  return ok(
    freezeDispute({
      ...dispute,
      ...patch,
      state: to,
      updatedAt: now,
      history: [
        ...dispute.history,
        { from: dispute.state, to, at: now, note },
      ],
    }),
  );
}
