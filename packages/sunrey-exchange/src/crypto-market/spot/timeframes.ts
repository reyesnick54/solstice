/**
 * HELIOS M06 — crypto spot bar timeframes and provider mapping hints.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';

export const CRYPTO_SPOT_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type CryptoSpotTimeframe = (typeof CRYPTO_SPOT_TIMEFRAMES)[number];

const TIMEFRAME_SECONDS: Readonly<Record<CryptoSpotTimeframe, number>> = Object.freeze({
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14_400,
  '1d': 86_400,
});

export type CryptoSpotHistoricalRange = {
  readonly from: UtcInstant;
  readonly to: UtcInstant;
};

export function isCryptoSpotTimeframe(value: string): value is CryptoSpotTimeframe {
  return (CRYPTO_SPOT_TIMEFRAMES as readonly string[]).includes(value);
}

export function cryptoTimeframeDurationSeconds(timeframe: CryptoSpotTimeframe): number {
  return TIMEFRAME_SECONDS[timeframe];
}

export function periodEndForCryptoBar(periodStart: UtcInstant, timeframe: CryptoSpotTimeframe): UtcInstant {
  const startMs = Date.parse(periodStart);
  const endMs = startMs + cryptoTimeframeDurationSeconds(timeframe) * 1000 - 1;
  return asUtcInstant(new Date(endMs).toISOString());
}

export function validateCryptoHistoricalRange(range: CryptoSpotHistoricalRange): boolean {
  return Date.parse(range.from) <= Date.parse(range.to);
}

/** CoinGecko market_chart auto-granularity hint (provider may coarsen). */
export function coingeckoDaysHintForTimeframe(timeframe: CryptoSpotTimeframe): number {
  switch (timeframe) {
    case '1m':
    case '5m':
      return 1;
    case '15m':
    case '1h':
      return 7;
    case '4h':
      return 30;
    case '1d':
      return 365;
  }
}
