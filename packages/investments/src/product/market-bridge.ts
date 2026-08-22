import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import {
  labelFreshness,
  STALE_AFTER_MS,
  type MarketPriceQuote,
  type MarketQuoteResult,
  type MarketQuoteSource,
} from '../../../sunrey-exchange/src/market-data/index.ts';
import type { InstrumentId, MarketId } from '../ids.ts';
import {
  type MarketDataFailure,
  type MarketDataProvider,
  type MarketQuote,
  SimulatedMarketDataProvider,
} from '../market-data.ts';
import { priceFromMinorUnits } from '../price.ts';
import type { MarketStatus } from '../types.ts';
import type { PriceFreshness } from './holdings.ts';

function parseUtcMs(instant: string): bigint {
  if (instant.length < 20) {
    return 0n;
  }
  const day = utcSeconds(instant);
  return day;
}

function utcSeconds(instant: string): bigint {
  const year = BigInt(instant.slice(0, 4));
  const month = BigInt(instant.slice(5, 7));
  const day = BigInt(instant.slice(8, 10));
  const hour = BigInt(instant.slice(11, 13));
  const minute = BigInt(instant.slice(14, 16));
  const second = BigInt(instant.slice(17, 19));
  const y = month <= 2n ? year - 1n : year;
  const m = month <= 2n ? month + 9n : month - 3n;
  const era = (y >= 0n ? y : y - 399n) / 400n;
  const yoe = y - era * 400n;
  const doy = (153n * m + 2n) / 5n + day - 1n;
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
  const days = era * 146097n + doe - 719468n;
  return ((days * 24n + hour) * 60n + minute) * 60n + second;
}

export function freshnessFromQuote(quote: MarketQuote, at: UtcInstant): PriceFreshness {
  const quotedSec = parseUtcMs(quote.quotedAt);
  const nowSec = parseUtcMs(at);
  const ageMs = nowSec > quotedSec ? (nowSec - quotedSec) * 1000n : 0n;
  const stale = at > quote.staleAfter || ageMs > STALE_AFTER_MS;
  return Object.freeze({
    source: quote.source,
    timestamp: quote.quotedAt,
    freshnessMs: ageMs,
    quality: stale ? 'STALE' : 'FRESH',
    stale,
  });
}

export function freshnessFromPhaseD(quote: MarketPriceQuote, nowUtc: string): PriceFreshness {
  const labeled = labelFreshness(quote, nowUtc);
  return Object.freeze({
    source: labeled.source,
    timestamp: labeled.timestampUtc as UtcInstant,
    freshnessMs: labeled.freshnessMs,
    quality: labeled.quality === 'CONFLICTING' ? 'UNAVAILABLE' : labeled.quality,
    stale: labeled.quality === 'STALE',
  });
}

/**
 * Adapts a Phase D MarketQuoteSource into the investments MarketDataProvider.
 * Stale quotes stay labeled stale. Unavailable providers fail closed.
 */
export class PhaseDMarketDataBridge implements MarketDataProvider {
  constructor(
    private readonly source: MarketQuoteSource,
    private readonly fallback?: SimulatedMarketDataProvider,
  ) {}

  getQuote(instrumentId: InstrumentId, at: UtcInstant): Result<MarketQuote, MarketDataFailure> {
    const spot = this.source.getSpotPrice(instrumentId, at);
    return this.toQuote(instrumentId, at, spot);
  }

  getLastPrice(instrumentId: InstrumentId, at: UtcInstant) {
    const quote = this.getQuote(instrumentId, at);
    if (!quote.ok) {
      return quote;
    }
    return ok(quote.value.price);
  }

  getValuationPrice(instrumentId: InstrumentId, at: UtcInstant): Result<MarketQuote, MarketDataFailure> {
    return this.getQuote(instrumentId, at);
  }

  getMarketStatus(marketId: MarketId, at: UtcInstant): MarketStatus {
    const status = this.source.getMarketStatus(String(marketId));
    if (!status.ok) {
      return this.fallback?.getMarketStatus(marketId, at) ?? 'CLOSED';
    }
    if (status.value === 'HALTED') {
      return 'HALTED';
    }
    if (status.value === 'OPEN') {
      return 'OPEN';
    }
    return 'CLOSED';
  }

  private toQuote(
    instrumentId: InstrumentId,
    at: UtcInstant,
    spot: MarketQuoteResult<MarketPriceQuote>,
  ): Result<MarketQuote, MarketDataFailure> {
    if (!spot.ok) {
      if (this.fallback) {
        return this.fallback.getQuote(instrumentId, at);
      }
      return err({
        code: spot.code === 'PROVIDER_UNAVAILABLE' ? 'MARKET_CLOSED' : 'UNKNOWN_INSTRUMENT',
        message: spot.message,
      });
    }
    const labeled = labelFreshness(spot.value, at);
    const priced = priceFromMinorUnits(labeled.priceUnits, labeled.currency);
    if (!priced.ok) {
      return err({ code: 'PRICE_INVALID', message: priced.error.message });
    }
    const ttl = labeled.quality === 'STALE' ? 0n : STALE_AFTER_MS;
    const quotedAt = labeled.timestampUtc as UtcInstant;
    return ok(
      Object.freeze({
        instrumentId,
        price: priced.value,
        source: labeled.source as 'SIMULATED_DETERMINISTIC',
        quotedAt,
        staleAfter: addMsSafe(quotedAt, ttl),
      }),
    );
  }
}

function addMsSafe(instant: UtcInstant, add: bigint): UtcInstant {
  const sec = parseUtcMs(instant);
  const next = sec + add / 1000n;
  return formatUtc(next);
}

function formatUtc(epochSec: bigint): UtcInstant {
  const days = epochSec / 86400n;
  const rem = epochSec % 86400n;
  const hour = rem / 3600n;
  const minute = (rem % 3600n) / 60n;
  const second = rem % 60n;
  const civil = civilFromDays(days);
  return `${pad(civil.year, 4)}-${pad(civil.month, 2)}-${pad(civil.day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}.000Z` as UtcInstant;
}

function pad(value: bigint, width: number): string {
  const raw = value.toString();
  return raw.length >= width ? raw : `${'0'.repeat(width - raw.length)}${raw}`;
}

function civilFromDays(z: bigint): { year: bigint; month: bigint; day: bigint } {
  let dayNumber = z + 719468n;
  const era = (dayNumber >= 0n ? dayNumber : dayNumber - 146096n) / 146097n;
  const doe = dayNumber - era * 146097n;
  const yoe = (doe - doe / 1460n + doe / 36524n - doe / 146096n) / 365n;
  const y = yoe + era * 400n;
  const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n);
  const mp = (5n * doy + 2n) / 153n;
  const d = doy - (153n * mp + 2n) / 5n + 1n;
  const m = mp < 10n ? mp + 3n : mp - 9n;
  return { year: y + (m <= 2n ? 1n : 0n), month: m, day: d };
}

export class InvestmentMarketQuoteSource implements MarketQuoteSource {
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;
  readonly providerId = 'sunrey-investment-simulation';

  constructor(private readonly inner: SimulatedMarketDataProvider) {}

  getInstrument(instrumentId: string) {
    const quote = this.inner.getQuote(instrumentId as InstrumentId, '2026-01-01T00:00:00.000Z' as UtcInstant);
    if (!quote.ok) {
      return { ok: false as const, code: quote.error.code, message: quote.error.message };
    }
    return {
      ok: true as const,
      value: {
        instrumentId,
        symbol: instrumentId,
        baseAssetId: instrumentId,
        quoteCurrency: quote.value.price.currency,
        quoteScale: 2,
      },
    };
  }

  getSpotPrice(instrumentId: string, nowUtc: string) {
    const quote = this.inner.getQuote(instrumentId as InstrumentId, nowUtc as UtcInstant);
    if (!quote.ok) {
      return { ok: false as const, code: quote.error.code, message: quote.error.message };
    }
    return {
      ok: true as const,
      value: {
        instrument: {
          instrumentId,
          symbol: instrumentId,
          baseAssetId: instrumentId,
          quoteCurrency: quote.value.price.currency,
          quoteScale: 2,
        },
        priceUnits: quote.value.price.minorUnits,
        currency: quote.value.price.currency,
        source: this.providerId,
        timestampUtc: quote.value.quotedAt,
        freshnessMs: 0n,
        provider: this.providerId,
        quality: 'FRESH' as const,
        status: 'OPEN' as const,
        staleMasqueradingAsCurrent: false as const,
      },
    };
  }

  getTicker(instrumentId: string, nowUtc: string) {
    const last = this.getSpotPrice(instrumentId, nowUtc);
    if (!last.ok) {
      return last;
    }
    return { ok: true as const, value: { instrument: last.value.instrument, last: last.value, bid: null, ask: null, volumeUnits: 0n } };
  }

  getCandles() {
    return { ok: false as const, code: 'UNAVAILABLE', message: 'candles are not productized on the investment path' };
  }

  getHistorical() {
    return this.getCandles();
  }

  getReferenceRate(instrumentId: string, nowUtc: string) {
    const spot = this.getSpotPrice(instrumentId, nowUtc);
    if (!spot.ok) {
      return spot;
    }
    return {
      ok: true as const,
      value: {
        instrument: spot.value.instrument,
        rateNumerator: spot.value.priceUnits,
        rateDenominator: 1n,
        timestampUtc: spot.value.timestampUtc,
        freshnessMs: spot.value.freshnessMs,
        provider: this.providerId,
        quality: spot.value.quality,
        source: this.providerId,
      },
    };
  }

  getMarketStatus() {
    return { ok: true as const, value: 'OPEN' as const };
  }
}
