import type { UtcInstant } from '../../../domain/src/time.ts';
import { newClearingInstructionId } from '../ids.ts';
import {
  type ClearingRecord,
  type ClearingState,
  type SettlementFailureCode,
  type SettlementReferences,
} from './types.ts';

const EMPTY_REFS: SettlementReferences = Object.freeze({
  ledger: Object.freeze({ cashJournalId: null, feeJournalId: null, reservationJournalId: null }),
  custody: Object.freeze({
    providerTxRef: null,
    vaultId: null,
    reservationId: null,
    confirmation: 'UNVERIFIED',
  }),
  chain: Object.freeze({ txId: null, height: null, finality: 'NONE' }),
});

const ALLOWED: Readonly<Record<ClearingState, readonly ClearingState[]>> = {
  PENDING: ['VALIDATED', 'FAILED', 'REQUIRES_REVIEW'],
  VALIDATED: ['READY_TO_SETTLE', 'FAILED', 'REQUIRES_REVIEW'],
  READY_TO_SETTLE: ['SETTLING', 'FAILED', 'REQUIRES_REVIEW'],
  SETTLING: ['SETTLED', 'FAILED', 'REQUIRES_REVIEW', 'SETTLING'],
  SETTLED: ['SETTLED'],
  FAILED: ['READY_TO_SETTLE', 'REQUIRES_REVIEW', 'FAILED'],
  REQUIRES_REVIEW: ['READY_TO_SETTLE', 'SETTLING', 'SETTLED', 'FAILED', 'REQUIRES_REVIEW'],
};

export function emptySettlementRefs(): SettlementReferences {
  return EMPTY_REFS;
}

export function mergeRefs(base: SettlementReferences, patch: Partial<SettlementReferences>): SettlementReferences {
  return Object.freeze({
    ledger: Object.freeze({ ...base.ledger, ...(patch.ledger ?? {}) }),
    custody: Object.freeze({ ...base.custody, ...(patch.custody ?? {}) }),
    chain: Object.freeze({ ...base.chain, ...(patch.chain ?? {}) }),
  });
}

export function canTransition(from: ClearingState, to: ClearingState): boolean {
  return ALLOWED[from].includes(to);
}

export function openClearing(input: {
  readonly obligationId: string;
  readonly tradeId: string;
  readonly at: UtcInstant;
}): ClearingRecord {
  return Object.freeze({
    clearingId: newClearingInstructionId(),
    obligationId: input.obligationId,
    tradeId: input.tradeId,
    state: 'PENDING',
    previousState: null,
    refs: emptySettlementRefs(),
    failureCode: null,
    reviewReason: null,
    attemptCount: 0,
    lastAttemptAt: null,
    settledAt: null,
    idempotencyKey: `exchange.clearing.${input.tradeId}`,
    duplicateTransferBlocked: false,
    updatedAt: input.at,
  });
}

export function transitionClearing(
  record: ClearingRecord,
  next: ClearingState,
  at: UtcInstant,
  patch: {
    readonly refs?: Partial<SettlementReferences> | undefined;
    readonly failureCode?: SettlementFailureCode | null | undefined;
    readonly reviewReason?: string | null | undefined;
    readonly incrementAttempt?: boolean | undefined;
    readonly duplicateTransferBlocked?: boolean | undefined;
  } = {},
): ClearingRecord {
  if (record.state === 'SETTLED' && next === 'SETTLED') {
    return Object.freeze({
      ...record,
      duplicateTransferBlocked: true,
      updatedAt: at,
    });
  }
  if (!canTransition(record.state, next)) {
    return Object.freeze({
      ...record,
      state: 'REQUIRES_REVIEW',
      previousState: record.state,
      reviewReason: `illegal_transition:${record.state}->${next}`,
      failureCode: patch.failureCode ?? record.failureCode,
      updatedAt: at,
    });
  }
  return Object.freeze({
    ...record,
    state: next,
    previousState: record.state,
    refs: patch.refs ? mergeRefs(record.refs, patch.refs) : record.refs,
    failureCode: patch.failureCode === undefined ? record.failureCode : patch.failureCode,
    reviewReason: patch.reviewReason === undefined ? record.reviewReason : patch.reviewReason,
    attemptCount: patch.incrementAttempt ? record.attemptCount + 1 : record.attemptCount,
    lastAttemptAt: patch.incrementAttempt ? at : record.lastAttemptAt,
    settledAt: next === 'SETTLED' ? at : record.settledAt,
    duplicateTransferBlocked: patch.duplicateTransferBlocked ?? record.duplicateTransferBlocked,
    updatedAt: at,
  });
}

export function orderFilledIsNotSettled(orderStatus: string, clearing: ClearingRecord): boolean {
  return (orderStatus === 'FILLED' || orderStatus === 'PARTIALLY_FILLED') && clearing.state !== 'SETTLED';
}
