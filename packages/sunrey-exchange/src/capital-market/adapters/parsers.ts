/**
 * Finnhub response parsers for capital market observations.
 */

import { canonicalJsonStringify, hashRawPayload } from '@solstice/provider-sdk';
import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { resolveCapitalMarketEntitlement } from '../entitlement.ts';
import type { RegisteredCapitalMarketInstrument } from '../instrument-registry.ts';
import {
  finnhubResolutionForTimeframe,
  periodEndForBar,
  type CapitalMarketHistoricalRange,
  type CapitalMarketTimeframe,
} from '../timeframes.ts';
import type {
  CapitalMarketBar,
  CapitalMarketProvenance,
  CapitalMarketSessionObservation,
  CapitalMarketSessionStatus,
} from '../types.ts';

export type FinnhubQuotePayload = {
  readonly c?: number;
  readonly d?: number;
  readonly dp?: number;
  readonly h?: number;
  readonly l?: number;
  readonly o?: number;
  readonly pc?: number;
  readonly t?: number;
};

export type FinnhubCandlePayload = {
  readonly c?: readonly number[];
  readonly h?: readonly number[];
  readonly l?: readonly number[];
  readonly o?: readonly number[];
  readonly v?: readonly number[];
  readonly t?: readonly number[];
  readonly s?: string;
};

export type FinnhubMarketStatusPayload = {
  readonly exchange?: string;
  readonly timezone?: string;
  readonly session?: string | null;
  readonly holiday?: string | null;
  readonly isOpen?: boolean;
  readonly t?: number;
};

export function validateFinnhubQuotePayload(raw: unknown): raw is FinnhubQuotePayload {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const payload = raw as FinnhubQuotePayload;
  if (payload.c !== undefined && (!Number.isFinite(payload.c) || payload.c < 0)) {
    return false;
  }
  if (payload.t !== undefined && (!Number.isFinite(payload.t) || payload.t <= 0)) {
    return false;
  }
  return payload.c !== undefined || payload.o !== undefined || payload.pc !== undefined;
}

export function validateFinnhubCandlePayload(raw: unknown): raw is FinnhubCandlePayload {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const payload = raw as FinnhubCandlePayload;
  if (payload.s === 'no_data') {
    return true;
  }
  if (payload.s !== 'ok') {
    return false;
  }
  if (!Array.isArray(payload.t) || payload.t.length === 0) {
    return false;
  }
  if (!Array.isArray(payload.o) || !Array.isArray(payload.h) || !Array.isArray(payload.l) || !Array.isArray(payload.c)) {
    return false;
  }
  const length = payload.t.length;
  return payload.o.length === length && payload.h.length === length && payload.l.length === length && payload.c.length === length;
}

export function finnhubCandleHasData(payload: FinnhubCandlePayload): boolean {
  return payload.s === 'ok' && Array.isArray(payload.t) && payload.t.length > 0;
}

export function validateFinnhubMarketStatusPayload(raw: unknown): raw is FinnhubMarketStatusPayload {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const payload = raw as FinnhubMarketStatusPayload;
  return typeof payload.isOpen === 'boolean';
}

export function finnhubSourceTimestamp(payload: FinnhubQuotePayload | FinnhubMarketStatusPayload): string | null {
  const t = payload.t;
  if (t === undefined || !Number.isFinite(t) || t <= 0) {
    return null;
  }
  const millis = t > 1_000_000_000_000 ? t : t * 1000;
  return new Date(millis).toISOString();
}

export function decimalToMinorUnits(value: number | undefined, scale = 2): bigint | null {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const factor = 10 ** scale;
  return BigInt(Math.round(value * factor));
}

export function volumeToUnits(value: number | undefined): bigint | null {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return BigInt(Math.round(value));
}

export function mapFinnhubSessionStatus(session: string | null | undefined, isOpen: boolean): CapitalMarketSessionStatus {
  if (!isOpen) {
    return 'CLOSED';
  }
  switch (session) {
    case 'pre-market':
      return 'PRE_MARKET';
    case 'regular':
      return 'OPEN';
    case 'post-market':
      return 'AFTER_HOURS';
    default:
      return isOpen ? 'OPEN' : 'CLOSED';
  }
}

function buildProvenance(input: {
  readonly providerId: string;
  readonly sourceUrl: string;
  readonly rawPayload: string;
  readonly observationId: string;
  readonly capability: string;
}): CapitalMarketProvenance {
  return Object.freeze({
    providerId: input.providerId,
    authorityClass: 'reference_data',
    sourceUrl: input.sourceUrl,
    rawPayloadHash: hashRawPayload(input.rawPayload).digest,
    observationId: input.observationId,
    capability: input.capability,
  });
}

export function parseFinnhubCandles(input: {
  readonly payload: FinnhubCandlePayload;
  readonly rawPayload: string;
  readonly instrument: RegisteredCapitalMarketInstrument;
  readonly providerSymbol: string;
  readonly timeframe: CapitalMarketTimeframe;
  readonly nowUtc: UtcInstant;
  readonly providerId?: string;
}): readonly CapitalMarketBar[] {
  if (!finnhubCandleHasData(input.payload)) {
    return Object.freeze([]);
  }

  const providerId = input.providerId ?? 'finnhub';
  const entitlement = resolveCapitalMarketEntitlement({
    providerId,
    providerDeclaredRealtime: input.timeframe !== '1d',
    feedTier: 'free_tier',
  });
  const capability = input.timeframe === '1d' ? 'equity_historical_bars' : 'equity_intraday_bars';
  const resolution = finnhubResolutionForTimeframe(input.timeframe);
  const bars: CapitalMarketBar[] = [];

  for (let index = 0; index < input.payload.t!.length; index += 1) {
    const timestampSeconds = input.payload.t![index]!;
    const periodStart = asUtcInstant(new Date(timestampSeconds * 1000).toISOString());
    const periodEnd = periodEndForBar(periodStart, input.timeframe);
    const barId = `${providerId}:${input.instrument.instrumentId}:${input.timeframe}:${periodStart}`;
    const slicePayload = canonicalJsonStringify({
      o: input.payload.o![index],
      h: input.payload.h![index],
      l: input.payload.l![index],
      c: input.payload.c![index],
      v: input.payload.v?.[index] ?? null,
      t: timestampSeconds,
    });

    bars.push(
      Object.freeze({
        schema: 'sunrey.capital-market.v1',
        authority: 'REFERENCE_ONLY',
        barId,
        instrument: Object.freeze({
          instrumentId: input.instrument.instrumentId,
          symbol: input.instrument.symbol,
          vendorSymbol: input.providerSymbol,
          assetClass: input.instrument.assetClass,
          venue: input.instrument.venue,
          currency: input.instrument.currency,
          isin: input.instrument.isin,
          figi: input.instrument.figi,
          providerNativeId: input.providerSymbol,
        }),
        timeframe: input.timeframe,
        openMinorUnits: decimalToMinorUnits(input.payload.o![index]) ?? 0n,
        highMinorUnits: decimalToMinorUnits(input.payload.h![index]) ?? 0n,
        lowMinorUnits: decimalToMinorUnits(input.payload.l![index]) ?? 0n,
        closeMinorUnits: decimalToMinorUnits(input.payload.c![index]) ?? 0n,
        volumeUnits: volumeToUnits(input.payload.v?.[index]),
        priceScale: 2,
        currency: input.instrument.currency,
        periodStart,
        periodEnd,
        providerId,
        sourceTimestamp: periodStart,
        arrivalTimestamp: input.nowUtc,
        entitlement,
        provenance: buildProvenance({
          providerId,
          sourceUrl: `https://finnhub.io/api/v1/stock/candle?symbol=${input.providerSymbol}&resolution=${resolution}`,
          rawPayload: slicePayload,
          observationId: barId,
          capability,
        }),
      }),
    );
  }

  return Object.freeze(bars);
}

export function parseFinnhubMarketStatus(input: {
  readonly payload: FinnhubMarketStatusPayload;
  readonly rawPayload: string;
  readonly exchange: string;
  readonly nowUtc: UtcInstant;
  readonly observationId: string;
  readonly providerId?: string;
}): CapitalMarketSessionObservation {
  const providerId = input.providerId ?? 'finnhub';
  const sourceTimestampRaw = finnhubSourceTimestamp(input.payload);
  const sourceTimestamp = sourceTimestampRaw ? asUtcInstant(sourceTimestampRaw) : input.nowUtc;
  const entitlement = resolveCapitalMarketEntitlement({
    providerId,
    providerDeclaredRealtime: true,
    feedTier: 'free_tier',
  });

  return Object.freeze({
    schema: 'sunrey.capital-market.v1',
    authority: 'REFERENCE_ONLY',
    observationType: 'session_status',
    exchange: input.payload.exchange ?? input.exchange,
    sessionStatus: mapFinnhubSessionStatus(input.payload.session, input.payload.isOpen ?? false),
    providerSession: input.payload.session ?? null,
    isOpen: input.payload.isOpen ?? false,
    timezone: input.payload.timezone ?? null,
    holiday: input.payload.holiday ?? null,
    providerId,
    sourceTimestamp,
    arrivalTimestamp: input.nowUtc,
    entitlement,
    provenance: Object.freeze({
      providerId,
      authorityClass: 'reference_data',
      sourceUrl: `https://finnhub.io/api/v1/stock/market-status?exchange=${input.exchange}`,
      rawPayloadHash: hashRawPayload(input.rawPayload).digest,
      observationId: input.observationId,
      capability: 'equity_session_status',
    }),
  });
}

export function unixSeconds(instant: UtcInstant): number {
  return Math.floor(Date.parse(instant) / 1000);
}

export function filterBarsToRange(
  bars: readonly CapitalMarketBar[],
  range: CapitalMarketHistoricalRange,
): readonly CapitalMarketBar[] {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);
  return Object.freeze(
    bars.filter((bar) => {
      const startMs = Date.parse(bar.periodStart);
      return startMs >= fromMs && startMs <= toMs;
    }),
  );
}
