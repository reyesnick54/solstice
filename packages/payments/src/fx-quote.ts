import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { isExpired } from '../../config/src/clock.ts';
import { Money } from '../../money/src/money.ts';
import type { CorridorId, QuoteId } from './ids.ts';
import type { FxRate, PricedFxRates } from './fx-rate.ts';

export const FX_QUOTE_STATUSES = ['OPEN', 'ACCEPTED', 'EXPIRED', 'EXECUTED', 'CANCELLED'] as const;
export type FxQuoteStatus = (typeof FX_QUOTE_STATUSES)[number];

/**
 * Immutable FX quote. The rate is never mutated in place.
 * Acceptance is recorded as a separate reference, not a rate rewrite.
 */
export type FxQuote = {
  readonly quoteId: QuoteId;
  readonly baseCurrency: CurrencyCode;
  readonly quoteCurrency: CurrencyCode;
  readonly sourceAmount: Money;
  readonly destinationAmount: Money;
  readonly marketRate: FxRate;
  readonly providerRate: FxRate;
  readonly customerRate: FxRate;
  readonly fee: Money;
  readonly amountDebited: Money;
  readonly amountCredited: Money;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly rateSource: string;
  readonly pricingVersion: string;
  readonly corridorId: CorridorId;
  readonly legalEntityId: LegalEntityId;
  readonly status: FxQuoteStatus;
};

export function freezeQuote(quote: FxQuote): FxQuote {
  return Object.freeze({
    ...quote,
    marketRate: Object.freeze({ ...quote.marketRate }),
    providerRate: Object.freeze({ ...quote.providerRate }),
    customerRate: Object.freeze({ ...quote.customerRate }),
  });
}

export function quoteIsExpired(quote: FxQuote, now: UtcInstant): boolean {
  return quote.status === 'EXPIRED' || isExpired(quote.expiresAt, now);
}

export function quoteCanExecute(quote: FxQuote, now: UtcInstant): boolean {
  return quote.status === 'ACCEPTED' && !isExpired(quote.expiresAt, now);
}

export function withQuoteStatus(quote: FxQuote, status: FxQuoteStatus): FxQuote {
  return freezeQuote({ ...quote, status });
}

export function pricedRatesOf(quote: FxQuote): PricedFxRates {
  return Object.freeze({
    reference: quote.marketRate,
    market: quote.marketRate,
    provider: quote.providerRate,
    customer: quote.customerRate,
  });
}
