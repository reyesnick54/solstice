/**
 * Maps commercial AccessProviderQuote into ACCESS-14 ProviderQuote vocabulary.
 *
 * Only FIRM quotes are eligible for real settlement in Access Wave 3.
 * Indicative or reference quotes must not be upgraded automatically.
 */

import type { ProviderQuote } from '../types.ts';
import type { AccessProviderQuote, QuoteClassification } from './types.ts';

export type CommercialQuoteMapping = {
  readonly providerQuote: ProviderQuote;
  readonly classification: QuoteClassification;
  readonly baseAmountMinorUnits: bigint;
  readonly taxMinorUnits: bigint;
  readonly mandatoryFeeMinorUnits: bigint;
  readonly optionalFeeMinorUnits: bigint;
  readonly securityDepositMinorUnits: bigint | null;
  readonly eligibleFundingMinorUnits: bigint;
};

export function isFirmQuote(quote: AccessProviderQuote): boolean {
  return quote.classification === 'FIRM';
}

export function assertFirmQuoteForSettlement(
  quote: AccessProviderQuote,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (quote.classification !== 'FIRM') {
    return Object.freeze({
      ok: false,
      reason: `quote ${quote.providerQuoteId} is ${quote.classification}; only FIRM quotes may proceed to settlement`,
    });
  }
  return Object.freeze({ ok: true });
}

export function mapCommercialQuoteToProviderQuote(commercial: AccessProviderQuote): CommercialQuoteMapping {
  const taxMinor = commercial.taxes.reduce((sum, line) => sum + line.amount.minorUnits, 0n);
  const mandatoryMinor = commercial.mandatoryFees.reduce((sum, line) => sum + line.amount.minorUnits, 0n);
  const optionalMinor = commercial.optionalFees.reduce((sum, line) => sum + line.amount.minorUnits, 0n);
  const securityDepositMinor = commercial.securityDeposit?.minorUnits ?? null;
  const eligibleFundingMinor =
    commercial.totalAmount.minorUnits - (securityDepositMinor ?? 0n);

  const providerQuote: ProviderQuote = Object.freeze({
    quoteId: commercial.providerQuoteId,
    providerId: 'expedia',
    catalogItemId: commercial.providerProductId,
    canonicalUnit: commercial.unit,
    quantity: commercial.units,
    providerPriceMinorUnits: commercial.totalAmount.minorUnits,
    currency: commercial.totalAmount.currency,
    expiresAt: commercial.expiresAt,
    settlementTerms: Object.freeze({
      currency: commercial.totalAmount.currency,
      settlementRail: 'FIAT_PAYMENTS',
      providerReceivesMinorUnits: commercial.totalAmount.minorUnits,
      simulationOnly: commercial.provenance.source !== 'PRODUCTION',
      ...(commercial.provenance.source === 'SANDBOX' ? { sandboxOnly: true as const } : {}),
    }),
    simulationOnly: commercial.provenance.source !== 'PRODUCTION',
    ...(commercial.provenance.source === 'SANDBOX' ? { sandboxOnly: true as const } : {}),
    providerRateToken: commercial.providerReference,
  });

  return Object.freeze({
    providerQuote,
    classification: commercial.classification,
    baseAmountMinorUnits: commercial.baseAmount.minorUnits,
    taxMinorUnits: taxMinor,
    mandatoryFeeMinorUnits: mandatoryMinor,
    optionalFeeMinorUnits: optionalMinor,
    securityDepositMinorUnits: securityDepositMinor,
    eligibleFundingMinorUnits: eligibleFundingMinor > 0n ? eligibleFundingMinor : 0n,
  });
}
