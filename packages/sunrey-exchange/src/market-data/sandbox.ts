/**
 * Deterministic market-data sandbox adapters. Clearly non-production.
 */

import { labelFreshness } from './aggregation.ts';
import type {
  MarketCandle,
  MarketQuoteSource,
  MarketQuoteResult,
  MarketDataQuality,
  MarketDataStatus,
  MarketInstrument,
  MarketPriceQuote,
  MarketReferenceRate,
  MarketTicker,
} from './types.ts';

export type MarketDataSandboxScenario =
  | 'normal'
  | 'stale'
  | 'unavailable'
  | 'outlier'
  | 'conflicting';

const SUNREY_USD: MarketInstrument = Object.freeze({
  instrumentId: 'SUNREY_COIN/USD',
  symbol: 'SUNREYUSD',
  baseAssetId: 'SUNREY_COIN',
  quoteCurrency: 'USD',
  quoteScale: 2,
});

export class DeterministicMarketDataAdapter implements MarketQuoteSource {
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;
  #scenario: MarketDataSandboxScenario = 'normal';

  readonly providerId: string;
  readonly bookPriceUnits: bigint;

  constructor(providerId: string, bookPriceUnits: bigint) {
    this.providerId = providerId;
    this.bookPriceUnits = bookPriceUnits;
  }

  setScenario(scenario: MarketDataSandboxScenario): void {
    this.#scenario = scenario;
  }

  getInstrument(instrumentId: string): MarketQuoteResult<MarketInstrument> {
    if (instrumentId !== SUNREY_USD.instrumentId) {
      return { ok: false, code: 'UNKNOWN_INSTRUMENT', message: 'instrument not in sandbox book' };
    }
    return { ok: true, value: SUNREY_USD };
  }

  getSpotPrice(instrumentId: string, nowUtc: string): MarketQuoteResult<MarketPriceQuote> {
    if (this.#scenario === 'unavailable') {
      return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'market data provider unavailable' };
    }
    const instrument = this.getInstrument(instrumentId);
    if (!instrument.ok) return instrument;
    const quality: MarketDataQuality =
      this.#scenario === 'stale' ? 'STALE' : this.#scenario === 'outlier' ? 'OUTLIER' : 'FRESH';
    const timestampUtc = this.#scenario === 'stale' ? '2026-08-21T00:00:00.000Z' : nowUtc;
    const priceUnits = this.#scenario === 'outlier' ? this.bookPriceUnits * 20n : this.bookPriceUnits;
    return {
      ok: true,
      value: labelFreshness(
        {
          instrument: instrument.value,
          priceUnits,
          currency: instrument.value.quoteCurrency,
          source: this.providerId,
          timestampUtc,
          freshnessMs: 0n,
          provider: this.providerId,
          quality,
          status: 'OPEN',
          staleMasqueradingAsCurrent: false,
        },
        nowUtc,
      ),
    };
  }

  getTicker(instrumentId: string, nowUtc: string): MarketQuoteResult<MarketTicker> {
    const last = this.getSpotPrice(instrumentId, nowUtc);
    if (!last.ok) return last;
    return {
      ok: true,
      value: Object.freeze({
        instrument: last.value.instrument,
        last: last.value,
        bid: last.value,
        ask: last.value,
        volumeUnits: 1_000n,
      }),
    };
  }

  getCandles(instrumentId: string, nowUtc: string): MarketQuoteResult<readonly MarketCandle[]> {
    const spot = this.getSpotPrice(instrumentId, nowUtc);
    if (!spot.ok) return spot;
    return {
      ok: true,
      value: Object.freeze([
        Object.freeze({
          instrument: spot.value.instrument,
          open: spot.value.priceUnits,
          high: spot.value.priceUnits,
          low: spot.value.priceUnits,
          close: spot.value.priceUnits,
          volumeUnits: 1_000n,
          periodStartUtc: nowUtc,
          periodEndUtc: nowUtc,
          quality: spot.value.quality,
          provider: this.providerId,
        }),
      ]),
    };
  }

  getHistorical(instrumentId: string, nowUtc: string): MarketQuoteResult<readonly MarketCandle[]> {
    return this.getCandles(instrumentId, nowUtc);
  }

  getReferenceRate(instrumentId: string, nowUtc: string): MarketQuoteResult<MarketReferenceRate> {
    const spot = this.getSpotPrice(instrumentId, nowUtc);
    if (!spot.ok) return spot;
    return {
      ok: true,
      value: Object.freeze({
        instrument: spot.value.instrument,
        rateNumerator: spot.value.priceUnits,
        rateDenominator: 10n ** BigInt(spot.value.instrument.quoteScale),
        timestampUtc: spot.value.timestampUtc,
        freshnessMs: spot.value.freshnessMs,
        provider: this.providerId,
        quality: spot.value.quality,
        source: spot.value.source,
      }),
    };
  }

  getMarketStatus(instrumentId: string): MarketQuoteResult<MarketDataStatus> {
    if (this.#scenario === 'unavailable') {
      return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'market data provider unavailable' };
    }
    const instrument = this.getInstrument(instrumentId);
    if (!instrument.ok) return instrument;
    return { ok: true, value: 'OPEN' };
  }
}

export function createMarketQuoteSourceA(): DeterministicMarketDataAdapter {
  return new DeterministicMarketDataAdapter('fixture-market-data-a', 10_000n);
}

export function createMarketQuoteSourceB(): DeterministicMarketDataAdapter {
  return new DeterministicMarketDataAdapter('fixture-market-data-b', 10_050n);
}

export function runMarketDataContractSuite(
  provider: DeterministicMarketDataAdapter = createMarketQuoteSourceA(),
): {
  readonly outcome: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly cases: readonly string[];
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
} {
  const now = '2026-08-21T16:00:00.000Z';
  provider.setScenario('normal');
  const instrument = provider.getInstrument('SUNREY_COIN/USD');
  const spot = provider.getSpotPrice('SUNREY_COIN/USD', now);
  const ticker = provider.getTicker('SUNREY_COIN/USD', now);
  const candles = provider.getCandles('SUNREY_COIN/USD', now);
  const historical = provider.getHistorical('SUNREY_COIN/USD', now);
  const rate = provider.getReferenceRate('SUNREY_COIN/USD', now);
  const status = provider.getMarketStatus('SUNREY_COIN/USD');
  provider.setScenario('stale');
  const stale = provider.getSpotPrice('SUNREY_COIN/USD', now);
  const passed =
    instrument.ok &&
    spot.ok &&
    spot.value.staleMasqueradingAsCurrent === false &&
    ticker.ok &&
    candles.ok &&
    historical.ok &&
    rate.ok &&
    status.ok &&
    stale.ok &&
    stale.value.quality === 'STALE';
  return Object.freeze({
    outcome: passed ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    cases: Object.freeze([
      'instrument',
      'spot',
      'ticker',
      'ohlc',
      'historical',
      'reference_rate',
      'market_status',
      'stale_labeled',
    ]),
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
  });
}
