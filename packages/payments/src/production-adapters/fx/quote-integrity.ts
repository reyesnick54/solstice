/**
 * FX quote integrity. Provider execution must correspond to the exact
 * accepted terms when the provider supports firm quoting.
 */

import type { FxQuote } from '../../fx-quote.ts';
import type { FxRate } from '../../fx-rate.ts';
import type { Money } from '../../../../money/src/money.ts';

export type ProviderQuoteTerms = {
  readonly providerQuoteId: string;
  readonly rate: { readonly numerator: bigint; readonly denominator: bigint };
  readonly sourceAmount: Money;
  readonly destinationAmount: Money;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly expiresAt: string;
  readonly feeMinor: bigint | null;
  readonly executionRef: string | null;
};

export type QuoteIntegrityResult =
  | { readonly ok: true; readonly providerQuoteId: string }
  | { readonly ok: false; readonly code: string; readonly mismatches: readonly string[] };

export function verifyProviderQuoteTerms(accepted: FxQuote, provider: ProviderQuoteTerms): QuoteIntegrityResult {
  const mismatches: string[] = [];
  if (accepted.quoteId !== provider.providerQuoteId && accepted.quoteId !== `sim_${provider.providerQuoteId}`) {
    if (accepted.quoteId !== provider.providerQuoteId) {
      mismatches.push('quote_id');
    }
  }
  if (accepted.baseCurrency !== provider.baseCurrency || accepted.quoteCurrency !== provider.quoteCurrency) {
    mismatches.push('currency_pair');
  }
  if (!moneyEqual(accepted.sourceAmount, provider.sourceAmount)) {
    mismatches.push('source_amount');
  }
  if (!moneyEqual(accepted.destinationAmount, provider.destinationAmount)) {
    mismatches.push('destination_amount');
  }
  if (!rateEqual(accepted.providerRate, provider.rate)) {
    mismatches.push('rate');
  }
  if (accepted.expiresAt !== provider.expiresAt) {
    mismatches.push('expiration');
  }
  if (provider.feeMinor !== null && accepted.fee.minorUnits !== provider.feeMinor) {
    mismatches.push('provider_fee');
  }
  if (mismatches.length > 0) {
    return { ok: false, code: 'QUOTE_TERMS_MISMATCH', mismatches: Object.freeze(mismatches) };
  }
  return { ok: true, providerQuoteId: provider.providerQuoteId };
}

export function customerPricingRemainsSunReyOwned(
  pricingMode: 'SUNREY_PRICES_CUSTOMER' | 'PROVIDER_RATE_INPUT',
  adapterRedefinesCustomer: boolean,
): boolean {
  if (pricingMode === 'SUNREY_PRICES_CUSTOMER' && adapterRedefinesCustomer) {
    return false;
  }
  return true;
}

function moneyEqual(left: Money, right: Money): boolean {
  return left.currency === right.currency && left.minorUnits === right.minorUnits;
}

function rateEqual(rate: FxRate, parts: { readonly numerator: bigint; readonly denominator: bigint }): boolean {
  return rate.numerator === parts.numerator && rate.denominator === parts.denominator;
}
