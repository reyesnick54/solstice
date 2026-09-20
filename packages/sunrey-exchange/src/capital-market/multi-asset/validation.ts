/**
 * HELIOS M01 instrument record validation.
 */

import { MULTI_ASSET_CLASSES, type CanonicalMultiAssetInstrument, type MultiAssetClass } from './types.ts';

export type MultiAssetInstrumentValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function validateMultiAssetInstrument(record: CanonicalMultiAssetInstrument): MultiAssetInstrumentValidationResult {
  if (!record.instrumentId || record.instrumentId.length < 8) {
    return { ok: false, code: 'INVALID_INSTRUMENT_ID', message: 'instrumentId is missing or too short' };
  }
  if (!record.symbol.trim()) {
    return { ok: false, code: 'INVALID_SYMBOL', message: 'symbol is required' };
  }
  if (!MULTI_ASSET_CLASSES.includes(record.assetClass)) {
    return { ok: false, code: 'INVALID_ASSET_CLASS', message: `unsupported asset class ${record.assetClass}` };
  }
  if (!record.jurisdiction.trim()) {
    return { ok: false, code: 'INVALID_JURISDICTION', message: 'jurisdiction is required' };
  }
  if (!record.venue?.venueId) {
    return { ok: false, code: 'INVALID_VENUE', message: 'venue is required' };
  }
  if (!/^[A-Z]{3}$/.test(record.tradingCurrency)) {
    return { ok: false, code: 'INVALID_TRADING_CURRENCY', message: `invalid trading currency ${record.tradingCurrency}` };
  }
  if (!/^[A-Z]{3}$/.test(record.settlementCurrency)) {
    return {
      ok: false,
      code: 'INVALID_SETTLEMENT_CURRENCY',
      message: `invalid settlement currency ${record.settlementCurrency}`,
    };
  }
  if (!Number.isInteger(record.quantityScale) || record.quantityScale < 0) {
    return { ok: false, code: 'INVALID_QUANTITY_SCALE', message: 'quantityScale must be a non-negative integer' };
  }
  if (!Number.isInteger(record.priceScale) || record.priceScale < 0) {
    return { ok: false, code: 'INVALID_PRICE_SCALE', message: 'priceScale must be a non-negative integer' };
  }

  const pairError = validatePairAssetFields(record.assetClass, record.baseAsset, record.quoteAsset);
  if (pairError) {
    return pairError;
  }

  const futureError = validateFutureFields(record);
  if (futureError) {
    return futureError;
  }

  for (const mapping of record.providerMappings) {
    if (!mapping.providerId.trim() || !mapping.symbol.trim()) {
      return { ok: false, code: 'INVALID_PROVIDER_MAPPING', message: 'provider mapping requires providerId and symbol' };
    }
  }

  return { ok: true };
}

function validatePairAssetFields(
  assetClass: MultiAssetClass,
  baseAsset: string | null,
  quoteAsset: string | null,
): MultiAssetInstrumentValidationResult | null {
  if (assetClass === 'FX_SPOT' || assetClass === 'CRYPTO_SPOT') {
    if (!baseAsset?.trim() || !quoteAsset?.trim()) {
      return {
        ok: false,
        code: 'MISSING_PAIR_ASSETS',
        message: `${assetClass} requires baseAsset and quoteAsset`,
      };
    }
  }
  return null;
}

function validateFutureFields(record: CanonicalMultiAssetInstrument): MultiAssetInstrumentValidationResult | null {
  if (record.assetClass !== 'FUTURE') {
    return null;
  }
  if (!record.contractMonth) {
    return { ok: false, code: 'MISSING_CONTRACT_MONTH', message: 'FUTURE requires contractMonth' };
  }
  if (record.contractMultiplier === null || record.contractMultiplier <= 0) {
    return { ok: false, code: 'MISSING_CONTRACT_MULTIPLIER', message: 'FUTURE requires positive contractMultiplier' };
  }
  if (!record.expiration) {
    return { ok: false, code: 'MISSING_EXPIRATION', message: 'FUTURE requires expiration' };
  }
  return null;
}
