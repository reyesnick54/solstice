import { applyFxRate, applyRational, Money, type Rational } from '@solstice/domain';
import type { SimulatedFxQuote } from './quotes.ts';

export type QuoteComparison = {
  readonly quote: SimulatedFxQuote;
  readonly converted: Money;
  readonly totalCostFrom: Money;
  readonly spreadFromMid: Rational;
};

/**
 * Compare quotes on converted amount, fee, and settlement time.
 * All arithmetic is bigint/rational. Never floating-point.
 */
export function compareQuotes(
  sourceAmount: Money,
  quotes: readonly SimulatedFxQuote[],
): readonly QuoteComparison[] {
  const compared: QuoteComparison[] = [];
  for (const quote of quotes) {
    if (quote.from !== sourceAmount.currency) {
      continue;
    }
    const converted = applyFxRate(sourceAmount, {
      from: quote.from,
      to: quote.to,
      rate: quote.rate,
      timestamp: quote.timestamp,
    });
    compared.push(
      Object.freeze({
        quote,
        converted,
        totalCostFrom: sourceAmount.add(quote.fee),
        spreadFromMid: quote.rate,
      }),
    );
  }
  return Object.freeze(
    compared.slice().sort((a, b) => {
      if (a.converted.minorUnits !== b.converted.minorUnits) {
        return a.converted.minorUnits > b.converted.minorUnits ? -1 : 1;
      }
      if (a.quote.fee.minorUnits !== b.quote.fee.minorUnits) {
        return a.quote.fee.minorUnits < b.quote.fee.minorUnits ? -1 : 1;
      }
      if (a.quote.settlementMs !== b.quote.settlementMs) {
        return a.quote.settlementMs < b.quote.settlementMs ? -1 : 1;
      }
      return a.quote.source < b.quote.source ? -1 : 1;
    }),
  );
}

export function sourceAmountForDestination(
  destination: Money,
  rate: { readonly from: string; readonly to: string; readonly rate: Rational },
): Money {
  if (destination.currency !== rate.to) {
    throw new TypeError('destination currency must match quote.to');
  }
  const sourceMinor = applyRational(destination.minorUnits, {
    numerator: rate.rate.denominator,
    denominator: rate.rate.numerator,
  });
  return Money.of(sourceMinor, rate.from);
}
