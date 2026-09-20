/**
 * Capital market bar timeframes and Finnhub resolution mapping.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';

export const CAPITAL_MARKET_TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'] as const;
export type CapitalMarketTimeframe = (typeof CAPITAL_MARKET_TIMEFRAMES)[number];

export const FINNHUB_TIMEFRAME_RESOLUTIONS: Readonly<Record<CapitalMarketTimeframe, string>> = Object.freeze({
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1d': 'D',
});

const TIMEFRAME_SECONDS: Readonly<Record<CapitalMarketTimeframe, number>> = Object.freeze({
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86_400,
});

export type CapitalMarketHistoricalRange = {
  readonly from: UtcInstant;
  readonly to: UtcInstant;
};

export function isCapitalMarketTimeframe(value: string): value is CapitalMarketTimeframe {
  return (CAPITAL_MARKET_TIMEFRAMES as readonly string[]).includes(value);
}

export function timeframeDurationSeconds(timeframe: CapitalMarketTimeframe): number {
  return TIMEFRAME_SECONDS[timeframe];
}

export function finnhubResolutionForTimeframe(timeframe: CapitalMarketTimeframe): string {
  return FINNHUB_TIMEFRAME_RESOLUTIONS[timeframe];
}

export function periodEndForBar(periodStart: UtcInstant, timeframe: CapitalMarketTimeframe): UtcInstant {
  const startMs = Date.parse(periodStart);
  const endMs = startMs + timeframeDurationSeconds(timeframe) * 1000 - 1;
  return asUtcInstant(new Date(endMs).toISOString());
}

export function validateHistoricalRange(range: CapitalMarketHistoricalRange): boolean {
  return Date.parse(range.from) <= Date.parse(range.to);
}
