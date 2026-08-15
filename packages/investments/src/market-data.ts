import { addMs } from '../../config/src/clock.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { InstrumentId, MarketId } from './ids.ts';
import { priceFromMinorUnits, type InstrumentPrice, type PriceFailure } from './price.ts';
import type { MarketStatus } from './types.ts';

export type MarketQuote = {
  readonly instrumentId: InstrumentId;
  readonly price: InstrumentPrice;
  readonly source: 'SIMULATED_DETERMINISTIC';
  readonly quotedAt: UtcInstant;
  readonly staleAfter: UtcInstant;
};

export type MarketDataFailure = {
  readonly code: 'UNKNOWN_INSTRUMENT' | 'STALE_QUOTE' | 'MARKET_CLOSED' | 'PRICE_INVALID';
  readonly message: string;
};

export interface MarketDataProvider {
  getQuote(instrumentId: InstrumentId, at: UtcInstant): Result<MarketQuote, MarketDataFailure>;
  getLastPrice(instrumentId: InstrumentId, at: UtcInstant): Result<InstrumentPrice, MarketDataFailure>;
  getValuationPrice(instrumentId: InstrumentId, at: UtcInstant): Result<MarketQuote, MarketDataFailure>;
  getMarketStatus(marketId: MarketId, at: UtcInstant): MarketStatus;
}

export type SimulatedQuoteSeed = {
  readonly instrumentId: InstrumentId;
  readonly minorUnits: bigint;
  readonly currency: string;
  readonly marketId: MarketId;
};

/**
 * Deterministic in-process market data. No internet. No live exchange.
 * Tests and the demo mutate prices through `setPrice`.
 */
export class SimulatedMarketDataProvider implements MarketDataProvider {
  private readonly prices = new Map<string, { readonly minorUnits: bigint; readonly currency: string }>();
  private readonly markets = new Map<string, MarketId>();
  private readonly quotedAt = new Map<string, UtcInstant>();
  private readonly quoteTtlMs: bigint;
  private status: MarketStatus;

  constructor(
    seeds: readonly SimulatedQuoteSeed[],
    options: { readonly quoteTtlMs?: bigint; readonly status?: MarketStatus } = {},
  ) {
    this.quoteTtlMs = options.quoteTtlMs ?? 60_000n;
    this.status = options.status ?? 'OPEN';
    for (const seed of seeds) {
      this.prices.set(seed.instrumentId, { minorUnits: seed.minorUnits, currency: seed.currency });
      this.markets.set(seed.instrumentId, seed.marketId);
    }
  }

  setPrice(instrumentId: InstrumentId, minorUnits: bigint, currency: string): Result<true, PriceFailure> {
    const priced = priceFromMinorUnits(minorUnits, currency);
    if (!priced.ok) {
      return priced;
    }
    this.prices.set(instrumentId, { minorUnits: priced.value.minorUnits, currency: priced.value.currency });
    this.quotedAt.delete(instrumentId);
    return ok(true);
  }

  markQuotedAt(instrumentId: InstrumentId, at: UtcInstant): void {
    this.quotedAt.set(instrumentId, at);
  }

  setMarketStatus(status: MarketStatus): void {
    this.status = status;
  }

  getMarketStatus(_marketId: MarketId, _at: UtcInstant): MarketStatus {
    return this.status;
  }

  getQuote(instrumentId: InstrumentId, at: UtcInstant): Result<MarketQuote, MarketDataFailure> {
    const row = this.prices.get(instrumentId);
    if (!row) {
      return err({ code: 'UNKNOWN_INSTRUMENT', message: `no simulated quote for ${instrumentId}` });
    }
    const priced = priceFromMinorUnits(row.minorUnits, row.currency);
    if (!priced.ok) {
      return err({ code: 'PRICE_INVALID', message: priced.error.message });
    }
    const quotedAt = this.quotedAt.get(instrumentId) ?? at;
    return ok(
      Object.freeze({
        instrumentId,
        price: priced.value,
        source: 'SIMULATED_DETERMINISTIC',
        quotedAt,
        staleAfter: addMs(quotedAt, this.quoteTtlMs),
      }),
    );
  }

  getLastPrice(instrumentId: InstrumentId, at: UtcInstant): Result<InstrumentPrice, MarketDataFailure> {
    const quote = this.getQuote(instrumentId, at);
    if (!quote.ok) {
      return quote;
    }
    return ok(quote.value.price);
  }

  getValuationPrice(instrumentId: InstrumentId, at: UtcInstant): Result<MarketQuote, MarketDataFailure> {
    return this.getQuote(instrumentId, at);
  }

  isStale(quote: MarketQuote, at: UtcInstant): boolean {
    return at > quote.staleAfter;
  }
}
