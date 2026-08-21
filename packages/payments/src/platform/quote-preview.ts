import type { AccountId } from '../../../domain/src/account.ts';
import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Money } from '../../../money/src/money.ts';
import type { QuoteId } from '../ids.ts';
import type { PaymentType, RailPreference } from './payment-intent.ts';

export const QUOTE_DELIVERY_CLASSES = [
  'LEDGER_INSTANT',
  'ESTIMATED_WHEN_PROVIDER_DEFINES',
  'UNKNOWN_UNTIL_PROVIDER',
] as const;
export type QuoteDeliveryClass = (typeof QUOTE_DELIVERY_CLASSES)[number];

export const CLIENT_COMPLIANCE_STATES = [
  'CLEAR_SIMULATION',
  'REVIEW_REQUIRED',
  'STEP_UP_REQUIRED',
  'HOLD',
  'BLOCKED',
  'NOT_EVALUATED',
] as const;
export type ClientComplianceState = (typeof CLIENT_COMPLIANCE_STATES)[number];

export type PaymentQuotePreview = {
  readonly quoteId: QuoteId;
  readonly sourceAccountId: AccountId;
  readonly sourceAmount: Money;
  readonly destinationAmount: Money | null;
  readonly currency: CurrencyCode;
  readonly destinationCurrency: CurrencyCode;
  readonly fees: readonly { readonly code: string; readonly amount: Money; readonly description: string }[];
  readonly amountDebited: Money;
  readonly fx: {
    readonly rateLabel: string | null;
    readonly rateSource: string;
    readonly reference: string;
  } | null;
  readonly estimatedRoute: {
    readonly railPreference: RailPreference;
    readonly paymentType: PaymentType;
    readonly corridorId: string | null;
    readonly providerIndependent: true;
  };
  readonly estimatedDeliveryClass: QuoteDeliveryClass;
  readonly settlementTimePromise: null;
  readonly requiredApprovals: readonly (
    | 'NONE'
    | 'CUSTOMER_CONFIRMATION'
    | 'STEP_UP_AUTHENTICATION'
    | 'MANUAL_REVIEW'
    | 'KERNEL_HOLD'
  )[];
  readonly complianceState: ClientComplianceState;
  readonly expiresAt: UtcInstant;
  readonly createdAt: UtcInstant;
  readonly productionMoneyMovement: false;
};

export function freezeQuotePreview(quote: PaymentQuotePreview): PaymentQuotePreview {
  return Object.freeze({
    ...quote,
    fees: Object.freeze(quote.fees.map((fee) => Object.freeze({ ...fee }))),
    fx: quote.fx ? Object.freeze({ ...quote.fx }) : null,
    estimatedRoute: Object.freeze({ ...quote.estimatedRoute }),
    requiredApprovals: Object.freeze([...quote.requiredApprovals]),
    destinationAmount: quote.destinationAmount,
    settlementTimePromise: null,
    productionMoneyMovement: false,
  });
}

export const INTERNAL_QUOTE_TTL_MS = 15 * 60 * 1000;
