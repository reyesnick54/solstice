/**
 * CoinGecko payload parsers for HELIOS M06 crypto spot market data.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';

export type CoingeckoSimplePricePayload = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type CoingeckoMarketChartPayload = {
  readonly prices: readonly (readonly [number, number])[];
  readonly total_volumes: readonly (readonly [number, number])[];
  readonly market_caps?: readonly (readonly [number, number])[];
};

export type CoingeckoOhlcPayload = readonly (readonly [number, number, number, number, number])[];

export type CoingeckoTickerPayload = {
  readonly tickers?: readonly {
    readonly base: string;
    readonly target: string;
    readonly last: number;
    readonly bid?: number;
    readonly ask?: number;
    readonly volume?: number;
    readonly converted_last?: Readonly<Record<string, number>>;
    readonly converted_volume?: Readonly<Record<string, number>>;
    readonly timestamp?: string;
  }[];
};

export function validateCoingeckoSimplePricePayload(raw: unknown, coinId: string): raw is CoingeckoSimplePricePayload {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const row = (raw as CoingeckoSimplePricePayload)[coinId];
  return Boolean(row && typeof row.usd === 'number' && row.usd > 0);
}

export function validateCoingeckoMarketChartPayload(raw: unknown): raw is CoingeckoMarketChartPayload {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const payload = raw as CoingeckoMarketChartPayload;
  return Array.isArray(payload.prices) && payload.prices.length > 0;
}

export function validateCoingeckoOhlcPayload(raw: unknown): raw is CoingeckoOhlcPayload {
  return Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]) && raw[0].length === 5;
}

export function coingeckoMillisToUtc(ms: number): UtcInstant {
  return asUtcInstant(new Date(ms).toISOString());
}

export function decimalToMinorUnits(value: number, scale: number): bigint {
  const factor = 10 ** scale;
  return BigInt(Math.round(value * factor));
}

/** Quote volume in USD from provider — preserved as quote-notional, never mixed with base units. */
export function extractQuoteVolumeMinorUnits(
  volumes: readonly (readonly [number, number])[] | undefined,
  index: number,
  scale: number,
): bigint | null {
  if (!volumes || index >= volumes.length) {
    return null;
  }
  const quoteNotional = volumes[index]?.[1];
  if (typeof quoteNotional !== 'number' || quoteNotional <= 0) {
    return null;
  }
  return decimalToMinorUnits(quoteNotional, scale);
}

export function parseCoingeckoOhlcBars(
  payload: CoingeckoOhlcPayload,
  scale: number,
): readonly {
  readonly periodStart: UtcInstant;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
}[] {
  return Object.freeze(
    payload.map((row) =>
      Object.freeze({
        periodStart: coingeckoMillisToUtc(row[0]),
        openMinorUnits: decimalToMinorUnits(row[1], scale),
        highMinorUnits: decimalToMinorUnits(row[2], scale),
        lowMinorUnits: decimalToMinorUnits(row[3], scale),
        closeMinorUnits: decimalToMinorUnits(row[4], scale),
      }),
    ),
  );
}

export function parseCoingeckoMarketChartBars(
  payload: CoingeckoMarketChartPayload,
  scale: number,
): readonly {
  readonly periodStart: UtcInstant;
  readonly closeMinorUnits: bigint;
  readonly quoteVolumeMinorUnits: bigint | null;
}[] {
  return Object.freeze(
    payload.prices.map((point, index) =>
      Object.freeze({
        periodStart: coingeckoMillisToUtc(point[0]),
        closeMinorUnits: decimalToMinorUnits(point[1], scale),
        quoteVolumeMinorUnits: extractQuoteVolumeMinorUnits(payload.total_volumes, index, scale),
      }),
    ),
  );
}
