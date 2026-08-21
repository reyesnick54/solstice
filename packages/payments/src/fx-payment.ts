import type { QuoteId } from './ids.ts';
import type { FxQuote } from './fx-quote.ts';
import type { PaymentOrder } from './payment.ts';
import type { PaymentDisclosure } from './responses.ts';

export const PAYMENT_FX_COMPOSITION_STATUSES = [
  'QUOTE_OPEN',
  'REVIEW',
  'APPROVED',
  'FX_EXECUTED',
  'PAYMENT_EXECUTING',
  'SETTLED',
  'FAILED',
  'RECOVERABLE',
] as const;
export type PaymentFxCompositionStatus = (typeof PAYMENT_FX_COMPOSITION_STATUSES)[number];

/**
 * Combined international-payment review. FX and payment stay in one
 * workflow so a conversion cannot strand customer funds.
 */
export type PaymentFxComposition = {
  readonly compositionId: string;
  readonly quoteId: QuoteId;
  readonly paymentId: string | null;
  readonly sourceAccountId: string;
  readonly beneficiaryId: string;
  readonly purposeReference: string;
  readonly status: PaymentFxCompositionStatus;
  readonly requiredApproval: 'CUSTOMER_CONFIRMATION';
  readonly recovery: {
    readonly stranded: false;
    readonly nextAction: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly idempotencyKey: string;
};

export type PaymentFxReview = {
  readonly composition: PaymentFxComposition;
  readonly fxQuote: FxQuote;
  readonly paymentDisclosure: PaymentDisclosure;
  readonly payment: PaymentOrder | null;
};

export function freezeComposition(row: PaymentFxComposition): PaymentFxComposition {
  return Object.freeze({
    ...row,
    recovery: Object.freeze({ ...row.recovery }),
  });
}

export function nextRecoveryAction(status: PaymentFxCompositionStatus): string {
  switch (status) {
    case 'QUOTE_OPEN':
      return 'REVIEW_AND_APPROVE_QUOTE';
    case 'REVIEW':
      return 'APPROVE_COMBINED_QUOTE';
    case 'APPROVED':
      return 'EXECUTE_PAYMENT';
    case 'FX_EXECUTED':
      return 'EXECUTE_PAYMENT';
    case 'PAYMENT_EXECUTING':
      return 'AWAIT_RAIL_OR_RECOVER';
    case 'SETTLED':
      return 'NONE';
    case 'FAILED':
      return 'RELEASE_OR_RETRY_WORKFLOW';
    case 'RECOVERABLE':
      return 'COMPLETE_OR_RELEASE_RESERVED_FUNDS';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
