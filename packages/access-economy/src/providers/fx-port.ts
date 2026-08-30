/**
 * FX quotation port for provider settlement currency conversion.
 *
 * Access-economy does not implement FX. Callers inject the canonical
 * payments / Exchange quotation path through this port.
 */

export type ProviderFxQuoteRequest = {
  readonly quoteId: string;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly sourceAmountMinorUnits: bigint;
  readonly corridorId: string;
  readonly at: string;
};

export type ProviderFxQuote = {
  readonly quoteId: string;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly sourceAmountMinorUnits: bigint;
  readonly destinationAmountMinorUnits: bigint;
  readonly expiresAt: string;
  readonly rateNumerator: bigint;
  readonly rateDenominator: bigint;
  readonly simulationOnly: boolean;
};

export type ProviderFxQuotePort = {
  readonly getQuote: (request: ProviderFxQuoteRequest) => ProviderFxQuote | null;
};

export class UnavailableProviderFxQuotePort implements ProviderFxQuotePort {
  getQuote(): null {
    return null;
  }
}

export function convertWithFxQuote(
  quote: ProviderFxQuote,
  sourceMinorUnits: bigint,
): bigint {
  return (sourceMinorUnits * quote.rateNumerator) / quote.rateDenominator;
}
