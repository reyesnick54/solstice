import type { FxQuote } from './fx-quote.ts';
import { rateLabel } from './fx-rate.ts';
import type { PaymentOrder } from './payment.ts';
import type { PaymentRoute } from './route.ts';

/**
 * Application response types for a future API/UI.
 * Domain logic does not hardcode display strings.
 */
export type PaymentDisclosure = {
  readonly sendAmountMinorUnits: string;
  readonly sendCurrency: string;
  readonly feeMinorUnits: string;
  readonly feeCurrency: string;
  readonly amountDebitedMinorUnits: string;
  readonly amountDebitedCurrency: string;
  readonly recipientAmountMinorUnits: string;
  readonly recipientCurrency: string;
  readonly marketRate: string;
  readonly providerRate: string;
  readonly customerRate: string;
  readonly rateSource: string;
  readonly pricingVersion: string;
  readonly status: string;
  readonly estimatedDeliveryMs: string | null;
  readonly corridorId: string;
  readonly quoteId: string;
  readonly paymentId: string | null;
};

export type FxQuoteDisclosure = {
  readonly quoteId: string;
  readonly sourceAmountMinorUnits: string;
  readonly sourceCurrency: string;
  readonly destinationAmountMinorUnits: string;
  readonly destinationCurrency: string;
  readonly rateNumerator: string;
  readonly rateDenominator: string;
  readonly rateKind: 'CUSTOMER';
  readonly referenceRate: string;
  readonly providerRate: string;
  readonly customerRate: string;
  readonly feeMinorUnits: string;
  readonly feeCurrency: string;
  readonly spreadDisclosed: boolean;
  readonly spread: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly pricingVersion: string;
  readonly rateSource: string;
  readonly rateTimestamp: string;
  readonly status: string;
  readonly requiredApproval: 'CUSTOMER_CONFIRMATION';
  readonly provider: {
    readonly state: 'SIMULATED';
    readonly live: false;
    readonly simulation: true;
  };
  readonly corridorId: string;
};

export function fxQuoteDisclosure(quote: FxQuote): FxQuoteDisclosure {
  const spreadDisclosed = quote.providerRate.numerator !== quote.customerRate.numerator
    || quote.providerRate.denominator !== quote.customerRate.denominator;
  return Object.freeze({
    quoteId: quote.quoteId,
    sourceAmountMinorUnits: quote.sourceAmount.minorUnits.toString(),
    sourceCurrency: quote.sourceAmount.currency,
    destinationAmountMinorUnits: quote.destinationAmount.minorUnits.toString(),
    destinationCurrency: quote.destinationAmount.currency,
    rateNumerator: quote.customerRate.numerator.toString(),
    rateDenominator: quote.customerRate.denominator.toString(),
    rateKind: 'CUSTOMER',
    referenceRate: rateLabel(quote.marketRate),
    providerRate: rateLabel(quote.providerRate),
    customerRate: rateLabel(quote.customerRate),
    feeMinorUnits: quote.fee.minorUnits.toString(),
    feeCurrency: quote.fee.currency,
    spreadDisclosed,
    spread: spreadDisclosed
      ? `${quote.providerRate.numerator.toString()}/${quote.providerRate.denominator.toString()}→${quote.customerRate.numerator.toString()}/${quote.customerRate.denominator.toString()}`
      : null,
    expiresAt: quote.expiresAt,
    createdAt: quote.createdAt,
    pricingVersion: quote.pricingVersion,
    rateSource: quote.rateSource,
    rateTimestamp: quote.customerRate.timestamp,
    status: quote.status,
    requiredApproval: 'CUSTOMER_CONFIRMATION',
    provider: Object.freeze({ state: 'SIMULATED' as const, live: false, simulation: true }),
    corridorId: quote.corridorId,
  });
}

export function disclosureFromQuote(
  quote: FxQuote,
  payment?: PaymentOrder,
  route?: PaymentRoute | null,
): PaymentDisclosure {
  return Object.freeze({
    sendAmountMinorUnits: quote.sourceAmount.minorUnits.toString(),
    sendCurrency: quote.sourceAmount.currency,
    feeMinorUnits: quote.fee.minorUnits.toString(),
    feeCurrency: quote.fee.currency,
    amountDebitedMinorUnits: quote.amountDebited.minorUnits.toString(),
    amountDebitedCurrency: quote.amountDebited.currency,
    recipientAmountMinorUnits: quote.amountCredited.minorUnits.toString(),
    recipientCurrency: quote.amountCredited.currency,
    marketRate: rateLabel(quote.marketRate),
    providerRate: rateLabel(quote.providerRate),
    customerRate: rateLabel(quote.customerRate),
    rateSource: quote.rateSource,
    pricingVersion: quote.pricingVersion,
    status: payment?.status ?? quote.status,
    estimatedDeliveryMs: route ? route.estimatedSettlementMs.toString() : null,
    corridorId: quote.corridorId,
    quoteId: quote.quoteId,
    paymentId: payment?.paymentId ?? null,
  });
}
