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
