/**
 * HELIOS Multi-Asset Expansion M01 qualification gate.
 */

import {
  filterMultiAssetInstrumentsByAssetClass,
  REGISTERED_MULTI_ASSET_INSTRUMENTS,
  resolveMultiAssetInstrument,
  resolveMultiAssetProviderMapping,
  searchMultiAssetInstruments,
} from './registry.ts';
import { MULTI_ASSET_CLASSES } from './types.ts';
import { validateMultiAssetInstrument } from './validation.ts';

export const HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED =
  'HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_BLOCKED =
  'HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_BLOCKED' as const;

export type MultiAssetInstrumentDomainQualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const REQUIRED_UNIVERSE_IDS = [
  'SECURITY:US:AAPL:XNAS',
  'SECURITY:US:SPY:ARCX',
  'SECURITY:US:QQQ:XNAS',
  'CRYPTO:GLOBAL:BTC:USD:SIM',
  'CRYPTO:GLOBAL:ETH:USD:SIM',
  'COMMODITY:GLOBAL:GOLD:XCEC',
  'COMMODITY:GLOBAL:WTI:XNYM',
  'FX:GLOBAL:EUR:USD:SIM',
  'FX:GLOBAL:USD:JPY:SIM',
] as const;

export function evaluateMultiAssetInstrumentDomainQualification(): MultiAssetInstrumentDomainQualificationResult {
  const blockers: string[] = [];

  const ids = new Set(REGISTERED_MULTI_ASSET_INSTRUMENTS.map((row) => row.instrumentId));
  if (ids.size !== REGISTERED_MULTI_ASSET_INSTRUMENTS.length) {
    blockers.push('canonical instrument IDs are not unique');
  }

  for (const assetClass of MULTI_ASSET_CLASSES) {
    const rows = filterMultiAssetInstrumentsByAssetClass(assetClass);
    if (rows.length === 0) {
      blockers.push(`missing instrument for asset class ${assetClass}`);
    }
  }

  for (const instrumentId of REQUIRED_UNIVERSE_IDS) {
    if (!resolveMultiAssetInstrument(instrumentId)) {
      blockers.push(`missing required universe instrument ${instrumentId}`);
    }
  }

  for (const record of REGISTERED_MULTI_ASSET_INSTRUMENTS) {
    const validation = validateMultiAssetInstrument(record);
    if (!validation.ok) {
      blockers.push(`invalid record ${record.instrumentId}: ${validation.message}`);
    }
  }

  const aapl = resolveMultiAssetInstrument('SECURITY:US:AAPL:XNAS');
  const arcAapl = resolveMultiAssetInstrumentByTickerVenueSafe('AAPL', 'ARCX');
  if (aapl && arcAapl && aapl.instrumentId === arcAapl.instrumentId) {
    blockers.push('venue/ticker collision not prevented');
  }

  if (!resolveMultiAssetProviderMapping('finnhub', 'AAPL')) {
    blockers.push('provider mapping resolution failed for finnhub:AAPL');
  }

  const btc = resolveMultiAssetInstrument('CRYPTO:GLOBAL:BTC:USD:SIM');
  if (!btc || btc.baseAsset !== 'BTC' || btc.quoteAsset !== 'USD') {
    blockers.push('crypto base/quote resolution failed for BTC/USD');
  }

  const eurUsd = resolveMultiAssetInstrument('FX:GLOBAL:EUR:USD:SIM');
  if (!eurUsd || eurUsd.baseAsset !== 'EUR' || eurUsd.quoteAsset !== 'USD') {
    blockers.push('FX base/quote resolution failed for EUR/USD');
  }

  const future = resolveMultiAssetInstrument('FUTURE:GLOBAL:CL:XNYM:202612');
  if (!future?.contractMonth || !future.expiration) {
    blockers.push('future metadata incomplete');
  }

  const inactive = searchMultiAssetInstruments({ status: 'INACTIVE', query: 'DELIST' });
  if (inactive.length === 0) {
    blockers.push('inactive instrument search failed');
  }

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }

  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}

function resolveMultiAssetInstrumentByTickerVenueSafe(
  ticker: string,
  venueId: string,
): ReturnType<typeof resolveMultiAssetInstrument> {
  const rows = searchMultiAssetInstruments({ query: ticker, limit: 100 });
  return rows.find((row) => row.symbol === ticker && row.venue.venueId === venueId);
}
