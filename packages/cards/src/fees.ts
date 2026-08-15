import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import type { CardFeeId, CardId } from './ids.ts';

export const CARD_FEE_TYPES = [
  'PROGRAM_FEE',
  'FOREIGN_TRANSACTION_FEE',
  'ATM_FEE',
  'REPLACEMENT_FEE',
] as const;

export type CardFeeType = (typeof CARD_FEE_TYPES)[number];

/**
 * Canonical card fee framework. No production pricing is invented.
 * Every assessed fee must be an explicit Money amount and a journal.
 */
export type CardFeeAssessment = {
  readonly feeId: CardFeeId;
  readonly cardId: CardId;
  readonly feeType: CardFeeType;
  readonly amount: Money;
  readonly journalId: string;
  readonly pricingNote: 'SIMULATION_EXPLICIT_AMOUNT_ONLY';
  readonly createdAt: UtcInstant;
};

export function freezeCardFee(fee: CardFeeAssessment): CardFeeAssessment {
  if (!(fee.amount instanceof Money) || !fee.amount.isPositive()) {
    throw new TypeError('card fee must be a positive Money amount');
  }
  return Object.freeze({
    ...fee,
    pricingNote: 'SIMULATION_EXPLICIT_AMOUNT_ONLY',
  });
}
