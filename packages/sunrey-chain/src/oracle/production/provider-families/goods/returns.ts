/**
 * Returns and post-realization cancellations preserve history.
 *
 * A returned good does not erase historical production. Corrections are
 * new records. Monetary state is never silently clawed back. If the
 * related attribution is already settled, the book flags
 * MONETARY_ADJUSTMENT_REVIEW_REQUIRED.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { ProductiveAttributionBook } from '../../../../productive/policy-governance/attribution-accounting/book.ts';
import type { AttributionResult } from '../../../../productive/policy-governance/attribution-accounting/types.ts';
import type { AttributionCorrectionRecord } from '../../../../productive/policy-governance/attribution-accounting/types.ts';
import type { ProductiveAttributionEntry } from '../../../../productive/policy-governance/attribution-accounting/types.ts';
import type { GoodsRefusal, GoodsSourceObservation } from './types.ts';

export type GoodsReturnRecord = {
  readonly returnObservationId: string;
  readonly originalObservationId: string;
  readonly inventoryState: 'RETURNED';
  readonly historicEvidencePreserved: true;
  readonly historicEventDeleted: false;
  readonly clawbackExecuted: false;
  readonly monetaryAdjustmentReviewRequired: boolean;
};

export function evaluateGoodsReturn(
  observation: GoodsSourceObservation,
  historic: ReadonlyMap<string, GoodsSourceObservation> = new Map(),
): Result<GoodsReturnRecord, GoodsRefusal> {
  if (observation.returnOfObservationId === null && observation.goodsState !== 'RETURNED') {
    return err({ code: 'MISSING_REALIZED_EVIDENCE', detail: 'return requires a return event or RETURNED state' });
  }
  const originalId = observation.returnOfObservationId ?? observation.observationId;
  const original = historic.get(originalId);
  if (original === undefined && observation.returnOfObservationId !== null) {
    return err({
      code: 'RETURN_REPLAY_FORBIDDEN',
      detail: 'return events must reference retained historic goods evidence',
    });
  }
  if (original && original.goodsState === 'RETURNED') {
    return err({
      code: 'RETURN_REPLAY_FORBIDDEN',
      detail: 'a returned good cannot be replayed as new productive output',
    });
  }
  return ok(
    Object.freeze({
      returnObservationId: observation.observationId,
      originalObservationId: originalId,
      inventoryState: 'RETURNED',
      historicEvidencePreserved: true,
      historicEventDeleted: false,
      clawbackExecuted: false,
      monetaryAdjustmentReviewRequired: observation.monetaryAlreadySettled,
    }),
  );
}

export function returnDoesNotDeleteHistory(record: GoodsReturnRecord): true {
  return record.historicEvidencePreserved && record.historicEventDeleted === false;
}

export function returnDoesNotAutoClawback(record: GoodsReturnRecord): true {
  return record.clawbackExecuted === false;
}

/**
 * Apply a settled-attribution correction through the Chunk 122 book.
 * The book records review; it does not modify monetary balances.
 */
export function reviewSettledReturn(
  book: ProductiveAttributionBook,
  entryId: string,
): AttributionResult<{
  readonly correction: AttributionCorrectionRecord;
  readonly released: ProductiveAttributionEntry;
  readonly replacement?: ProductiveAttributionEntry;
}> {
  return book.correct({
    targetEntryId: entryId,
    reason: 'GOODS_RETURN_AFTER_SETTLEMENT',
    evidenceIds: [`return:${entryId}`],
    supersede: false,
  });
}

export function cancelledAfterCompletionRequiresHistory(observation: GoodsSourceObservation): boolean {
  return observation.cancelled && observation.cancelledAfterRealization;
}
