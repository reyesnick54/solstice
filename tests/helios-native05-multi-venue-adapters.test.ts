/**
 * HELIOS NATIVE05 — BYTEX multi-venue adapter assimilation qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { HELIOS_OS04_VENUE_IDS } from '../packages/provider-sdk/src/venue/index.ts';
import {
  HELIOS_NATIVE_VENUE_ADAPTERS,
  BINANCE_VENUE_ADAPTER,
  mapDatabentoTradeToHelios,
  mapTardisQuoteToHelios,
} from '../packages/external-data/src/venue-adapters/index.ts';
import {
  HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED,
  runHeliosNativeMultiVenueAdapterSuite,
} from '../packages/platform/src/helios/execution-routing/venue-native/index.ts';
import { createVenueRoutingAdapter } from '../packages/platform/src/helios/execution-routing/adapters/venue-routing-factory.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-21T12:00:00.000Z');

describe('HELIOS NATIVE05 multi-venue adapters', () => {
  it('qualifies all reference venues with fixture normalization and live execution disabled', async () => {
    assert.equal(HELIOS_NATIVE_VENUE_ADAPTERS.length, HELIOS_OS04_VENUE_IDS.length);
    const suite = await runHeliosNativeMultiVenueAdapterSuite({ now: NOW, ciEnvironment: true });
    assert.equal(suite.marker, HELIOS_NATIVE_MULTI_VENUE_ADAPTERS_QUALIFIED);
    assert.equal(suite.qualified, true);
    for (const venueId of HELIOS_OS04_VENUE_IDS) {
      assert.equal(suite.perVenue[venueId], true, `${venueId} must be native qualified`);
    }
  });

  it('HeliosVenueAdapter normalizes Binance symbols without live connectivity', () => {
    const symbol = BINANCE_VENUE_ADAPTER.resolveSymbol({ kind: 'canonical', value: 'BTC/USD' });
    assert.equal(symbol.raw, 'BTCUSDT');
    const quote = BINANCE_VENUE_ADAPTER.normalizeQuote(
      { u: 1, b: '1', B: '1', a: '2', A: '1' },
      symbol,
    );
    assert.equal(quote.bidPrice, '1');
    assert.equal(BINANCE_VENUE_ADAPTER.liveExecutionEnabled, false);
  });

  it('maps Databento and Tardis historical rows into canonical read models', () => {
    const trade = mapDatabentoTradeToHelios({
      venueId: 'binance',
      canonicalSymbol: 'BTC/USD',
      raw: Object.freeze({
        publisherId: 1,
        instrumentId: 2,
        rawSymbol: 'BTCUSDT',
        tsEventNs: '1690000000000000000',
        price: '67234.5',
        size: '0.01',
        side: 'B',
      }),
    });
    assert.equal(trade.side, 'buy');

    const quote = mapTardisQuoteToHelios({
      venueId: 'binance',
      canonicalSymbol: 'BTC/USD',
      row: Object.freeze({
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timestamp: 1_690_000_000_000_000,
        localTimestamp: 1_690_000_000_000_000,
        askAmount: 1,
        askPrice: 67234.5,
        bidPrice: 67234.4,
        bidAmount: 1,
      }),
    });
    assert.equal(quote.askPrice, '67234.5');
  });

  it('venue routing adapters surface health without connecting to exchanges', () => {
    const binance = createVenueRoutingAdapter('binance');
    assert.equal(binance.liveProviderConnected, false);
    assert.equal(binance.describeCapability().healthState, 'HEALTHY');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('passes HELIOS boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });
});
