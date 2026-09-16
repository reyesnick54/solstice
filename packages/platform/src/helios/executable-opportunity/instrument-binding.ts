import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { CanonicalInstrumentBinding, CanonicalInstrumentCandidate } from './types.ts';
import type { QualificationReasonCode } from './taxonomy.ts';

const INSTRUMENT_MAPPINGS: Readonly<Record<string, { readonly providerSymbol: string; readonly assetClass: string }>> =
  Object.freeze({
    'SIM-ETF-1': Object.freeze({ providerSymbol: 'SIMETF1', assetClass: 'ETF' }),
    'SIM-EQ-1': Object.freeze({ providerSymbol: 'SIMEQ1', assetClass: 'EQUITIES' }),
    'USD': Object.freeze({ providerSymbol: 'USD', assetClass: 'CASH' }),
  });

const PRODUCT_INSTRUMENT_SUPPORT: Readonly<Record<string, readonly string[]>> = Object.freeze({
  prod_paper_investment_review: Object.freeze(['SIM-ETF-1', 'SIM-EQ-1']),
  prod_paper_rebalance_review: Object.freeze(['SIM-ETF-1', 'SIM-EQ-1']),
  prod_paper_diversification_review: Object.freeze(['SIM-ETF-1', 'SIM-EQ-1']),
  prod_internal_transfer: Object.freeze(['USD']),
  prod_savings_deposit: Object.freeze(['USD']),
  prod_fx_conversion: Object.freeze(['USD']),
  prod_debt_payment_proposal: Object.freeze(['USD']),
});

export function bindCanonicalInstrument(input: {
  readonly candidate: CanonicalInstrumentCandidate;
  readonly jurisdiction: Jurisdiction;
}):
  | { readonly ok: true; readonly binding: CanonicalInstrumentBinding; readonly reasonCodes: readonly QualificationReasonCode[] }
  | { readonly ok: false; readonly binding: null; readonly reasonCodes: readonly QualificationReasonCode[] } {
  const supported = PRODUCT_INSTRUMENT_SUPPORT[input.candidate.productId];
  if (!supported) {
    return Object.freeze({
      ok: false,
      binding: null,
      reasonCodes: Object.freeze(['PRODUCT_CAPABILITY_DENIED']),
    });
  }
  if (!supported.includes(input.candidate.instrumentId)) {
    return Object.freeze({
      ok: false,
      binding: null,
      reasonCodes: Object.freeze(['INSTRUMENT_UNSUPPORTED']),
    });
  }
  const mapping = INSTRUMENT_MAPPINGS[input.candidate.instrumentId];
  if (!mapping) {
    return Object.freeze({
      ok: false,
      binding: null,
      reasonCodes: Object.freeze(['INSTRUMENT_MAPPING_MISSING']),
    });
  }
  return Object.freeze({
    ok: true,
    binding: Object.freeze({
      instrumentId: input.candidate.instrumentId,
      productId: input.candidate.productId,
      symbol: input.candidate.symbol,
      providerSymbol: mapping.providerSymbol,
      assetClass: mapping.assetClass,
      mappingVerified: true,
    }),
    reasonCodes: Object.freeze(['OK']),
  });
}

export function productSupportsInstrument(productId: string, instrumentId: string): boolean {
  const supported = PRODUCT_INSTRUMENT_SUPPORT[productId];
  return supported ? supported.includes(instrumentId) : false;
}
