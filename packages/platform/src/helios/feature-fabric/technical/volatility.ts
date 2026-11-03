import { RollingWindow, minorToIndicatorPrice, scaleIndicatorOutput } from './rolling.ts';
import type { TechnicalOhlcvBar } from './types.ts';

export function computeAtrSeries(bars: readonly TechnicalOhlcvBar[], period: number): readonly (number | null)[] {
  const out: (number | null)[] = [];
  let lastClose: number | null = null;
  let atr = 0;
  let count = 0;
  for (const bar of bars) {
    const high = minorToIndicatorPrice(bar.highMinor);
    const low = minorToIndicatorPrice(bar.lowMinor);
    const close = minorToIndicatorPrice(bar.closeMinor);
    let trueRange = high - low;
    if (lastClose !== null) {
      trueRange = Math.max(trueRange, Math.abs(high - lastClose), Math.abs(low - lastClose));
    }
    lastClose = close;
    count += 1;
    if (count <= period) {
      atr += (trueRange - atr) / count;
    } else {
      atr = (atr * (period - 1) + trueRange) / period;
    }
    out.push(count >= period ? scaleIndicatorOutput(atr) : null);
  }
  return Object.freeze(out);
}

export type BollingerSeries = {
  readonly upper: readonly (number | null)[];
  readonly middle: readonly (number | null)[];
  readonly lower: readonly (number | null)[];
  readonly width: readonly (number | null)[];
};

export function computeBollingerSeries(
  bars: readonly TechnicalOhlcvBar[],
  period: number,
  k: number,
): BollingerSeries {
  const window = new RollingWindow(period);
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const width: (number | null)[] = [];
  for (const bar of bars) {
    window.add(minorToIndicatorPrice(bar.closeMinor));
    if (!window.isFull) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      width.push(null);
      continue;
    }
    const mid = window.average();
    const deviation = window.standardDeviation() * k;
    const up = mid + deviation;
    const lo = mid - deviation;
    upper.push(scaleIndicatorOutput(up));
    middle.push(scaleIndicatorOutput(mid));
    lower.push(scaleIndicatorOutput(lo));
    width.push(mid === 0 ? scaleIndicatorOutput(0) : scaleIndicatorOutput((up - lo) / mid));
  }
  return Object.freeze({
    upper: Object.freeze(upper),
    middle: Object.freeze(middle),
    lower: Object.freeze(lower),
    width: Object.freeze(width),
  });
}

export function computeRealizedVolBpsSeries(
  bars: readonly TechnicalOhlcvBar[],
  windowSize: number,
): readonly (number | null)[] {
  const closes = bars.map((bar) => bar.closeMinor);
  const out: (number | null)[] = [];
  for (let end = 0; end < closes.length; end += 1) {
    if (windowSize < 2 || end < windowSize - 1) {
      out.push(null);
      continue;
    }
    const start = end - windowSize + 1;
    const returns: number[] = [];
    for (let i = start + 1; i <= end; i += 1) {
      const prev = closes[i - 1];
      const current = closes[i];
      if (prev === undefined || current === undefined || prev <= 0n) {
        returns.length = 0;
        break;
      }
      returns.push(Number(((current - prev) * 10_000n) / prev));
    }
    if (returns.length === 0) {
      out.push(null);
      continue;
    }
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    let variance = 0;
    for (const ret of returns) {
      const diff = ret - mean;
      variance += diff * diff;
    }
    variance /= returns.length;
    out.push(Math.round(Math.sqrt(variance)));
  }
  return Object.freeze(out);
}
