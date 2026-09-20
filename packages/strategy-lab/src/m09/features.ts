import type { UtcInstant } from '@solstice/domain';
import { M09_Z_SCORE_SCALE } from './parameters.ts';
import type { M09BarObservation, M09FeatureSnapshot } from './types.ts';

function absBigint(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function spreadBpsFromBar(bar: M09BarObservation): bigint | null {
  if (bar.spreadBps !== null) {
    return bar.spreadBps;
  }
  if (bar.bidMinor === null || bar.askMinor === null || bar.closeMinor <= 0n) {
    return null;
  }
  const mid = (bar.bidMinor + bar.askMinor) / 2n;
  if (mid <= 0n) {
    return null;
  }
  return ((bar.askMinor - bar.bidMinor) * 10_000n) / mid;
}

function isStale(bar: M09BarObservation, now: UtcInstant, maxAgeMs: number): boolean {
  return Date.parse(now) - Date.parse(bar.knowableAt) > maxAgeMs;
}

/** Compute rolling mean of close prices over the trailing window ending at `endIndex` (inclusive). */
export function rollingMeanMinor(closes: readonly bigint[], endIndex: number, window: number): bigint | null {
  if (window <= 0 || endIndex < window - 1 || endIndex >= closes.length) {
    return null;
  }
  const start = endIndex - window + 1;
  let sum = 0n;
  for (let i = start; i <= endIndex; i += 1) {
    const value = closes[i];
    if (value === undefined) {
      return null;
    }
    sum += value;
  }
  return sum / BigInt(window);
}

/**
 * Realized volatility as population std dev of log-return proxies in bps.
 * Uses simple return (close[i]-close[i-1])/close[i-1] * 10000 for determinism.
 */
export function realizedVolBps(closes: readonly bigint[], endIndex: number, window: number): bigint | null {
  if (window < 2 || endIndex < window - 1 || endIndex >= closes.length) {
    return null;
  }
  const start = endIndex - window + 1;
  const returns: bigint[] = [];
  for (let i = start + 1; i <= endIndex; i += 1) {
    const prev = closes[i - 1];
    const current = closes[i];
    if (prev === undefined || current === undefined || prev <= 0n) {
      return null;
    }
    returns.push(((current - prev) * 10_000n) / prev);
  }
  if (returns.length === 0) {
    return null;
  }
  const mean = returns.reduce((sum, value) => sum + value, 0n) / BigInt(returns.length);
  let variance = 0n;
  for (const ret of returns) {
    const diff = ret - mean;
    variance += diff * diff;
  }
  variance /= BigInt(returns.length);
  return sqrtBigint(variance);
}

/** Integer square root for bigint (Newton's method). */
function sqrtBigint(value: bigint): bigint {
  if (value <= 0n) {
    return 0n;
  }
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

/** Volatility-normalized deviation scaled by M09_Z_SCORE_SCALE. */
export function zScoreScaled(
  closeMinor: bigint,
  meanMinor: bigint,
  volBps: bigint,
  minVolBps: bigint,
): bigint {
  const effectiveVol = volBps < minVolBps ? minVolBps : volBps;
  if (effectiveVol <= 0n || closeMinor <= 0n) {
    return 0n;
  }
  return ((closeMinor - meanMinor) * M09_Z_SCORE_SCALE * 10_000n) / (meanMinor * effectiveVol);
}

export function buildFeatureSnapshot(input: {
  readonly bars: readonly M09BarObservation[];
  readonly endIndex: number;
  readonly rollingWindow: number;
  readonly volWindow: number;
  readonly now: UtcInstant;
  readonly maxObservationAgeMs: number;
}): M09FeatureSnapshot | null {
  const bar = input.bars[input.endIndex];
  if (!bar) {
    return null;
  }
  const closes = input.bars.slice(0, input.endIndex + 1).map((row) => row.closeMinor);
  const mean = rollingMeanMinor(closes, input.endIndex, input.rollingWindow);
  const vol = realizedVolBps(closes, input.endIndex, input.volWindow);
  const spread = spreadBpsFromBar(bar);
  return Object.freeze({
    instrumentId: bar.instrumentId,
    asOf: input.now,
    closeMinor: bar.closeMinor,
    rollingMeanMinor: mean,
    realizedVolBps: vol,
    zScoreScaled: mean !== null && vol !== null ? zScoreScaled(bar.closeMinor, mean, vol, 10n) : null,
    spreadBps: spread,
    liquidityState: bar.liquidityState,
    marketState: bar.marketState,
    marketRegime: bar.marketRegime,
    sessionState: bar.sessionState,
    historyBars: closes.length,
    stale: isStale(bar, input.now, input.maxObservationAgeMs),
  });
}

export function barsForInstrument(
  allBars: readonly M09BarObservation[],
  instrumentId: string,
): readonly M09BarObservation[] {
  return Object.freeze(
    allBars
      .filter((row) => row.instrumentId === instrumentId)
      .sort((a, b) => Date.parse(a.sourceEventTime) - Date.parse(b.sourceEventTime)),
  );
}

export function indexAtOrBefore(bars: readonly M09BarObservation[], at: UtcInstant): number {
  let result = -1;
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (!bar) {
      continue;
    }
    if (Date.parse(bar.knowableAt) <= Date.parse(at) && bar.available) {
      result = i;
    } else if (Date.parse(bar.knowableAt) > Date.parse(at)) {
      break;
    }
  }
  return result;
}

export function absZScoreScaled(value: bigint | null): bigint {
  if (value === null) {
    return 0n;
  }
  return absBigint(value);
}
