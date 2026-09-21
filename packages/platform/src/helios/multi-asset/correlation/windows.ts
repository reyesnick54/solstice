/**
 * HELIOS Multi-Asset M17 — configurable correlation windows per asset class.
 *
 * Does not hard-code one timeframe for all asset classes.
 */

import type { BarTimeframe } from '../../market-observation/types.ts';
import type { CorrelationWindowHorizon } from './taxonomy.ts';
import type { CorrelationWindowConfig } from './types.ts';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const OTHER_CORRELATION_WINDOW: CorrelationWindowConfig = Object.freeze({
  returnInterval: '1h' satisfies BarTimeframe,
  shortLookback: 24,
  mediumLookback: 72,
  longLookback: 168,
  minSampleSize: 15,
  staleAfterMs: 4 * HOUR_MS,
  validForMs: HOUR_MS,
});

const DEFAULT_BY_ASSET_CLASS: Readonly<Record<string, CorrelationWindowConfig>> = Object.freeze({
  equity: Object.freeze({
    returnInterval: '15m' satisfies BarTimeframe,
    shortLookback: 20,
    mediumLookback: 60,
    longLookback: 120,
    minSampleSize: 12,
    staleAfterMs: 2 * HOUR_MS,
    validForMs: 30 * 60_000,
  }),
  etf: Object.freeze({
    returnInterval: '15m' satisfies BarTimeframe,
    shortLookback: 20,
    mediumLookback: 60,
    longLookback: 120,
    minSampleSize: 12,
    staleAfterMs: 2 * HOUR_MS,
    validForMs: 30 * 60_000,
  }),
  index: Object.freeze({
    returnInterval: '15m' satisfies BarTimeframe,
    shortLookback: 20,
    mediumLookback: 60,
    longLookback: 120,
    minSampleSize: 12,
    staleAfterMs: 2 * HOUR_MS,
    validForMs: 30 * 60_000,
  }),
  crypto: Object.freeze({
    returnInterval: '1h' satisfies BarTimeframe,
    shortLookback: 24,
    mediumLookback: 72,
    longLookback: 168,
    minSampleSize: 18,
    staleAfterMs: 3 * HOUR_MS,
    validForMs: HOUR_MS,
  }),
  commodity: Object.freeze({
    returnInterval: '4h' satisfies BarTimeframe,
    shortLookback: 16,
    mediumLookback: 48,
    longLookback: 96,
    minSampleSize: 10,
    staleAfterMs: 8 * HOUR_MS,
    validForMs: 2 * HOUR_MS,
  }),
  future: Object.freeze({
    returnInterval: '4h' satisfies BarTimeframe,
    shortLookback: 16,
    mediumLookback: 48,
    longLookback: 96,
    minSampleSize: 10,
    staleAfterMs: 8 * HOUR_MS,
    validForMs: 2 * HOUR_MS,
  }),
  fx: Object.freeze({
    returnInterval: '1h' satisfies BarTimeframe,
    shortLookback: 24,
    mediumLookback: 72,
    longLookback: 168,
    minSampleSize: 18,
    staleAfterMs: 2 * HOUR_MS,
    validForMs: HOUR_MS,
  }),
  bond: Object.freeze({
    returnInterval: '1d' satisfies BarTimeframe,
    shortLookback: 20,
    mediumLookback: 60,
    longLookback: 120,
    minSampleSize: 15,
    staleAfterMs: DAY_MS,
    validForMs: 6 * HOUR_MS,
  }),
  other: OTHER_CORRELATION_WINDOW,
});

export function resolveCorrelationWindowConfig(assetClass: string): CorrelationWindowConfig {
  return DEFAULT_BY_ASSET_CLASS[assetClass] ?? OTHER_CORRELATION_WINDOW;
}

export function lookbackForHorizon(
  config: CorrelationWindowConfig,
  horizon: CorrelationWindowHorizon,
): number {
  switch (horizon) {
    case 'SHORT':
      return config.shortLookback;
    case 'MEDIUM':
      return config.mediumLookback;
    case 'LONG':
      return config.longLookback;
    default: {
      const _exhaustive: never = horizon;
      return _exhaustive;
    }
  }
}

export function mergeCorrelationWindowConfig(
  assetClassA: string,
  assetClassB: string,
): CorrelationWindowConfig {
  const configA = resolveCorrelationWindowConfig(assetClassA);
  const configB = resolveCorrelationWindowConfig(assetClassB);
  if (configA.returnInterval === configB.returnInterval) {
    return Object.freeze({
      returnInterval: configA.returnInterval,
      shortLookback: Math.max(configA.shortLookback, configB.shortLookback),
      mediumLookback: Math.max(configA.mediumLookback, configB.mediumLookback),
      longLookback: Math.max(configA.longLookback, configB.longLookback),
      minSampleSize: Math.max(configA.minSampleSize, configB.minSampleSize),
      staleAfterMs: Math.min(configA.staleAfterMs, configB.staleAfterMs),
      validForMs: Math.min(configA.validForMs, configB.validForMs),
    });
  }
  const rank: Record<BarTimeframe, number> = {
    '1m': 1,
    '5m': 2,
    '15m': 3,
    '1h': 4,
    '4h': 5,
    '1d': 6,
  };
  const coarser =
    rank[configA.returnInterval] >= rank[configB.returnInterval] ? configA : configB;
  return Object.freeze({
    ...coarser,
    minSampleSize: Math.max(configA.minSampleSize, configB.minSampleSize),
    staleAfterMs: Math.min(configA.staleAfterMs, configB.staleAfterMs),
    validForMs: Math.min(configA.validForMs, configB.validForMs),
  });
}
