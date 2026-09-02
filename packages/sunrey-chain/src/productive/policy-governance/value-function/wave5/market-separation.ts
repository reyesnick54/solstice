/**
 * Wave 5 — Market price separation guards.
 *
 * Audits valuation inputs for accidental GPUV ↔ Exchange price coupling.
 * GPUV must not equal MoonRey price, must not directly determine Exchange
 * quotes, and Exchange quotes must not feed GPUV.
 */

import type { ProductiveValueInput, ProductiveValueReferenceFact } from '../types.ts';

export const MARKET_PRICE_COUPLING_FORBIDDEN = Object.freeze({
  gpuvEqualsMoonReyPrice: false,
  gpuvDeterminesExchangeQuote: false,
  exchangeQuoteFeedsGpuv: false,
  exchangeValuationDrivesIssuance: false,
});

export type MarketPriceCouplingViolation =
  | 'GPUV_EQUALS_MOONREY_PRICE'
  | 'EXCHANGE_PRICE_FEEDS_GPUV'
  | 'GPUV_DETERMINES_EXCHANGE_QUOTE'
  | 'MARKET_CAP_DETERMINES_ISSUANCE'
  | 'EXCHANGE_API_REQUIRED';

export type MarketSeparationAudit = {
  readonly ok: true;
  readonly couplingForbidden: typeof MARKET_PRICE_COUPLING_FORBIDDEN;
} | {
  readonly ok: false;
  readonly violation: MarketPriceCouplingViolation;
  readonly detail: string;
};

export function auditMarketPriceSeparation(input: {
  readonly valueInput: ProductiveValueInput;
  readonly exchangeApiRequired?: boolean;
  readonly exchangeQuoteFeedsGpuv?: boolean;
  readonly gpuvDeterminesExchangeQuote?: boolean;
  readonly exchangeValuationDrivesIssuance?: boolean;
}): MarketSeparationAudit {
  if (input.exchangeApiRequired) {
    return { ok: false, violation: 'EXCHANGE_API_REQUIRED', detail: 'GPUV evaluation must not require Exchange API availability' };
  }
  if (input.exchangeQuoteFeedsGpuv) {
    return { ok: false, violation: 'EXCHANGE_PRICE_FEEDS_GPUV', detail: 'Exchange quote must not feed GPUV' };
  }
  if (input.gpuvDeterminesExchangeQuote) {
    return { ok: false, violation: 'GPUV_DETERMINES_EXCHANGE_QUOTE', detail: 'GPUV must not directly determine Exchange quote' };
  }
  if (input.exchangeValuationDrivesIssuance) {
    return { ok: false, violation: 'MARKET_CAP_DETERMINES_ISSUANCE', detail: 'exchange valuation totals must not determine issuance' };
  }
  if (input.valueInput.referencePriceAlone) {
    return { ok: false, violation: 'EXCHANGE_PRICE_FEEDS_GPUV', detail: 'reference price alone cannot determine GPUV' };
  }
  if (input.valueInput.aiEconomicJudgment) {
    return { ok: false, violation: 'EXCHANGE_PRICE_FEEDS_GPUV', detail: 'AI economic judgment cannot modify deterministic GPUV' };
  }
  const moonreyPriceFacts = input.valueInput.referenceFacts.filter((fact) => fact.moonreyMarketPrice);
  if (moonreyPriceFacts.length > 0) {
    return {
      ok: false,
      violation: 'GPUV_EQUALS_MOONREY_PRICE',
      detail: `MoonRey market price facts are forbidden in GPUV inputs: ${moonreyPriceFacts.map((f) => f.factId).join(',')}`,
    };
  }
  return { ok: true, couplingForbidden: MARKET_PRICE_COUPLING_FORBIDDEN };
}

export function referenceFactUsesMoonReyMarketPrice(fact: ProductiveValueReferenceFact): boolean {
  return fact.moonreyMarketPrice === true;
}

export function exchangeApiUnavailableDoesNotAlterGpuv<T>(evaluate: () => T): T {
  return evaluate();
}
