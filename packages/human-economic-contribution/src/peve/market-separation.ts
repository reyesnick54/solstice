/**
 * Wave 6 — market separation proofs.
 *
 * SunRey Exchange price does not determine PEVE.
 * PEVE does not automatically determine SunRey Exchange price.
 * Market capitalization does not automatically determine human contribution value.
 */

import type { HumanEconomicValuationResult } from './types.ts';

export const MARKET_SEPARATION = Object.freeze({
  exchangePriceDeterminesPeve: false,
  peveDeterminesExchangePrice: false,
  marketCapDeterminesContributionValue: false,
  gpuvSubstitutesPeve: false,
  peveReadsLiveExchangePrice: false,
  peveReadsMarketCap: false,
});

export type MarketPriceSnapshot = {
  readonly exchangePriceMinorUnits: bigint;
  readonly marketCapMinorUnits: bigint;
  readonly observedAtUtc: string;
};

export type GpuvQuantity = {
  readonly gpuvMinorUnits: bigint;
  readonly productiveClaimId: string;
};

/**
 * PEVE valuation must not incorporate exchange price or market cap.
 * Returns rejection if forbidden market inputs are present.
 */
export function rejectMarketPriceAsPeveInput(input: Readonly<Record<string, unknown>>): {
  readonly ok: false;
  readonly code: 'MARKET_PRICE_INPUT_FORBIDDEN';
} | null {
  const forbidden = [
    'exchangePrice',
    'exchangePriceMinorUnits',
    'marketCap',
    'marketCapMinorUnits',
    'sunreyExchangePrice',
    'liveMarketQuote',
    'currentWebPrice',
  ];
  for (const key of forbidden) {
    if (key in input && input[key] !== undefined && input[key] !== null) {
      return { ok: false, code: 'MARKET_PRICE_INPUT_FORBIDDEN' };
    }
  }
  return null;
}

/**
 * MoonRey GPUV is a productive-economy construct and cannot substitute
 * for Human Economic Valuation (PEVE).
 */
export function rejectGpuvAsPeveSubstitute(gpuv: GpuvQuantity): {
  readonly ok: false;
  readonly code: 'GPUV_CANNOT_SUBSTITUTE_PEVE';
} {
  void gpuv;
  return { ok: false, code: 'GPUV_CANNOT_SUBSTITUTE_PEVE' };
}

/**
 * Changing exchange price must not alter an already-computed PEVE result.
 */
export function peveInvariantUnderMarketPriceChange(
  prior: HumanEconomicValuationResult,
  afterMarketChange: HumanEconomicValuationResult,
  _beforeMarket: MarketPriceSnapshot,
  _afterMarket: MarketPriceSnapshot,
): boolean {
  return (
    prior.valuationDigest === afterMarketChange.valuationDigest &&
    prior.finalReferenceValue === afterMarketChange.finalReferenceValue &&
    prior.methodologyVersion === afterMarketChange.methodologyVersion
  );
}

/**
 * PEVE result must not embed exchange price fields.
 */
export function peveResultExcludesMarketPrice(result: HumanEconomicValuationResult): boolean {
  const forbidden = ['exchangePrice', 'marketCap', 'sunreyExchangePrice', 'liveMarketQuote'];
  const record = result as unknown as Record<string, unknown>;
  return !forbidden.some((term) => term in record && record[term] !== undefined && record[term] !== null);
}
