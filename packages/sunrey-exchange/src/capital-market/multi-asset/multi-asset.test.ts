import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveCapitalMarketInstrument,
  resolveCapitalMarketInstrumentByProviderSymbol,
  resolveCapitalMarketInstrumentByTickerVenue,
} from '../instrument-registry.ts';
import { buildCanonicalInstrumentId } from './id.ts';
import {
  evaluateMultiAssetInstrumentDomainQualification,
  HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED,
} from './qualification.ts';
import {
  determineMultiAssetExecutionCapability,
  determineMultiAssetMarketDataCapability,
  filterMultiAssetInstrumentsByAssetClass,
  REGISTERED_MULTI_ASSET_INSTRUMENTS,
  resolveMultiAssetInstrument,
  resolveMultiAssetInstrumentByTickerVenue,
  resolveMultiAssetProviderMapping,
  resolveMultiAssetProviderNativeId,
  resolveMultiAssetUnderlyingChain,
  resolveMultiAssetUnderlyingDependents,
  searchMultiAssetInstruments,
  serializeMultiAssetInstrument,
} from './registry.ts';
import { MULTI_ASSET_CLASSES, MULTI_ASSET_SCHEMA, type CanonicalMultiAssetInstrument } from './types.ts';
import { validateMultiAssetInstrument } from './validation.ts';

describe('HELIOS M01 multi-asset instrument domain', () => {
  it('covers all asset classes', () => {
    for (const assetClass of MULTI_ASSET_CLASSES) {
      const rows = filterMultiAssetInstrumentsByAssetClass(assetClass);
      assert.ok(rows.length > 0, `missing asset class ${assetClass}`);
    }
  });

  it('keeps canonical instrument IDs unique', () => {
    const ids = REGISTERED_MULTI_ASSET_INSTRUMENTS.map((row) => row.instrumentId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('prevents venue/ticker collisions for canonical identity', () => {
    const aaplNasdaq = resolveMultiAssetInstrumentByTickerVenue('AAPL', 'XNAS');
    assert.ok(aaplNasdaq);
    assert.equal(aaplNasdaq.instrumentId, 'SECURITY:US:AAPL:XNAS');

    const missingArcAapl = resolveMultiAssetInstrumentByTickerVenue('AAPL', 'ARCX');
    assert.equal(missingArcAapl, undefined);
  });

  it('resolves provider mappings and native ids', () => {
    const bySymbol = resolveMultiAssetProviderMapping('finnhub', 'AAPL');
    assert.ok(bySymbol);
    assert.equal(bySymbol.instrumentId, 'SECURITY:US:AAPL:XNAS');

    const byNative = resolveMultiAssetProviderNativeId('sandbox', 'sandbox:btc-usd');
    assert.ok(byNative);
    assert.equal(byNative.instrumentId, 'CRYPTO:GLOBAL:BTC:USD:SIM');
  });

  it('carries futures metadata on reference contracts', () => {
    const future = resolveMultiAssetInstrument('FUTURE:GLOBAL:CL:XNYM:202612');
    assert.ok(future);
    assert.equal(future.assetClass, 'FUTURE');
    assert.equal(future.contractMonth, '202612');
    assert.equal(future.contractMultiplier, 1000n);
    assert.equal(future.expiration, '2026-11-20');
    assert.equal(future.firstNoticeDate, '2026-10-31');
    assert.equal(future.lastTradeDate, '2026-11-19');
    assert.equal(future.deliveryType, 'PHYSICAL');
  });

  it('models crypto base and quote assets', () => {
    const btc = resolveMultiAssetInstrument('CRYPTO:GLOBAL:BTC:USD:SIM');
    assert.ok(btc);
    assert.equal(btc.baseAsset, 'BTC');
    assert.equal(btc.quoteAsset, 'USD');
    assert.equal(btc.quantityScale, 8);
  });

  it('models FX base and quote assets', () => {
    const eurUsd = resolveMultiAssetInstrument('FX:GLOBAL:EUR:USD:SIM');
    assert.ok(eurUsd);
    assert.equal(eurUsd.baseAsset, 'EUR');
    assert.equal(eurUsd.quoteAsset, 'USD');

    const usdJpy = resolveMultiAssetInstrument('FX:GLOBAL:USD:JPY:SIM');
    assert.ok(usdJpy);
    assert.equal(usdJpy.baseAsset, 'USD');
    assert.equal(usdJpy.quoteAsset, 'JPY');
    assert.equal(usdJpy.tradingCurrency, 'JPY');
  });

  it('rejects invalid records', () => {
    const invalid = {
      schema: MULTI_ASSET_SCHEMA,
      instrumentId: 'FX:GLOBAL:BAD:USD:SIM',
      symbol: '',
      displayName: 'bad',
      assetClass: 'FX_SPOT',
      jurisdiction: 'GLOBAL',
      venue: { venueId: 'SIM', mic: 'XSIM', displayName: 'sim', exchange: 'SIM' },
      tradingCurrency: 'USD',
      settlementCurrency: 'USD',
      isin: null,
      figi: null,
      providerMappings: [],
      underlyingInstrumentId: null,
      baseAsset: null,
      quoteAsset: null,
      contractMultiplier: null,
      tickSizeScaledUnits: null,
      lotSizeScaledUnits: null,
      minimumQuantityScaledUnits: null,
      quantityScale: 0,
      priceScale: 2,
      expiration: null,
      firstNoticeDate: null,
      lastTradeDate: null,
      settlementType: 'T+0',
      contractMonth: null,
      deliveryType: 'NONE',
      tradingCalendarRef: null,
      capability: { marketData: 'NONE', execution: 'NONE' },
      status: 'ACTIVE',
      metadataAuthority: 'REFERENCE_ONLY',
    } satisfies CanonicalMultiAssetInstrument;

    const result = validateMultiAssetInstrument(invalid);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'INVALID_SYMBOL');
    }
  });

  it('excludes inactive instruments from capital-market resolution', () => {
    const inactive = resolveMultiAssetInstrument('SECURITY:US:DELIST:XNYS');
    assert.ok(inactive);
    assert.equal(inactive.status, 'INACTIVE');

    assert.equal(resolveCapitalMarketInstrument('SECURITY:US:DELIST:XNYS'), undefined);
    assert.equal(resolveCapitalMarketInstrumentByTickerVenue('DELIST', 'XNYS'), undefined);
    assert.equal(resolveCapitalMarketInstrumentByProviderSymbol('finnhub', 'DELIST'), undefined);
  });

  it('supports search and asset-class filtering', () => {
    const etfs = filterMultiAssetInstrumentsByAssetClass('ETF');
    assert.ok(etfs.some((row) => row.symbol === 'SPY'));
    assert.ok(etfs.some((row) => row.symbol === 'QQQ'));

    const goldHits = searchMultiAssetInstruments({ query: 'gold', limit: 10 });
    assert.ok(goldHits.some((row) => row.symbol === 'GOLD'));

    const usOnly = searchMultiAssetInstruments({ jurisdiction: 'US', limit: 20 });
    assert.ok(usOnly.every((row) => row.jurisdiction === 'US'));
  });

  it('resolves underlying relationships', () => {
    const qqq = resolveMultiAssetInstrument('SECURITY:US:QQQ:XNAS');
    assert.ok(qqq?.underlyingInstrumentId);
    const chain = resolveMultiAssetUnderlyingChain(qqq!.instrumentId);
    assert.equal(chain[0]?.instrumentId, 'INDEX:US:NDX:NDQ');

    const dependents = resolveMultiAssetUnderlyingDependents('COMMODITY:GLOBAL:WTI:XNYM');
    assert.ok(dependents.some((row) => row.instrumentId === 'FUTURE:GLOBAL:CL:XNYM:202612'));
  });

  it('determines market-data and execution capability without execution authority', () => {
    assert.equal(determineMultiAssetMarketDataCapability('SECURITY:US:AAPL:XNAS'), 'SANDBOX');
    assert.equal(determineMultiAssetExecutionCapability('SECURITY:US:AAPL:XNAS'), 'NONE');
    assert.equal(determineMultiAssetMarketDataCapability('SECURITY:US:DELIST:XNYS'), null);
    assert.equal(determineMultiAssetExecutionCapability('CASH:US:USD:SIM'), 'NONE');
  });

  it('preserves serialization stability', () => {
    const aapl = resolveMultiAssetInstrument('SECURITY:US:AAPL:XNAS');
    assert.ok(aapl);
    const first = serializeMultiAssetInstrument(aapl);
    const second = serializeMultiAssetInstrument(aapl);
    assert.equal(first, second);
    assert.equal(JSON.parse(first).instrumentId, 'SECURITY:US:AAPL:XNAS');
  });

  it('builds stable SunRey instrument IDs independent of provider naming', () => {
    assert.equal(
      buildCanonicalInstrumentId({
        assetClass: 'CRYPTO_SPOT',
        jurisdiction: 'GLOBAL',
        symbol: 'BTCUSD',
        venueId: 'SIM',
        baseAsset: 'BTC',
        quoteAsset: 'USD',
      }),
      'CRYPTO:GLOBAL:BTC:USD:SIM',
    );
  });

  it('emits HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED when gates pass', () => {
    const result = evaluateMultiAssetInstrumentDomainQualification();
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
    assert.equal(result.blockers.length, 0);
  });
});
