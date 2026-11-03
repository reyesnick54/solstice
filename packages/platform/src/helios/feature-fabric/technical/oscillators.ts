import { minorToIndicatorPrice, scaleIndicatorOutput } from './rolling.ts';
import { computeEmaSeries } from './moving-averages.ts';
import type { PriceField, TechnicalOhlcvBar } from './types.ts';
import { barPriceMinor } from './types.ts';

const PERCENT_SCALE = 100;

export function computeRsiSeries(
  bars: readonly TechnicalOhlcvBar[],
  period: number,
  priceField: PriceField = 'close',
): readonly (number | null)[] {
  const out: (number | null)[] = [];
  let last: number | null = null;
  let avgGain = 0;
  let avgLoss = 0;
  let count = 0;
  for (const bar of bars) {
    const value = minorToIndicatorPrice(barPriceMinor(bar, priceField));
    if (last === null) {
      last = value;
      out.push(null);
      continue;
    }
    const change = value - last;
    last = value;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    count += 1;
    if (count <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (count < period) {
      out.push(null);
      continue;
    }
    const rsi =
      avgLoss === 0 ? PERCENT_SCALE : PERCENT_SCALE - PERCENT_SCALE / (1 + avgGain / avgLoss);
    out.push(scaleIndicatorOutput(rsi));
  }
  return Object.freeze(out);
}

export function computeRocSeries(
  bars: readonly TechnicalOhlcvBar[],
  period: number,
  priceField: PriceField = 'close',
): readonly (number | null)[] {
  const prices = bars.map((bar) => minorToIndicatorPrice(barPriceMinor(bar, priceField)));
  const out: (number | null)[] = [];
  for (let i = 0; i < prices.length; i += 1) {
    if (i < period) {
      out.push(null);
      continue;
    }
    const prev = prices[i - period];
    const current = prices[i];
    if (prev === undefined || current === undefined || prev === 0) {
      out.push(null);
      continue;
    }
    out.push(scaleIndicatorOutput(((current - prev) / prev) * PERCENT_SCALE));
  }
  return Object.freeze(out);
}

export type MacdSeries = {
  readonly macd: readonly (number | null)[];
  readonly signal: readonly (number | null)[];
  readonly histogram: readonly (number | null)[];
};

export function computeMacdSeries(
  bars: readonly TechnicalOhlcvBar[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
  priceField: PriceField = 'close',
): MacdSeries {
  const fast = computeEmaSeries(bars, fastPeriod, priceField);
  const slow = computeEmaSeries(bars, slowPeriod, priceField);
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < bars.length; i += 1) {
    const f = fast[i];
    const s = slow[i];
    if (f === null || s === null) {
      macdLine.push(null);
    } else {
      macdLine.push(f - s);
    }
  }
  const alpha = 2 / (signalPeriod + 1);
  const signalLine: (number | null)[] = [];
  let signal: number | null = null;
  let signalCount = 0;
  for (const point of macdLine) {
    if (point === null) {
      signalLine.push(null);
      continue;
    }
    const raw = point / 10_000;
    if (signal === null) {
      signal = raw;
    } else {
      signal = alpha * raw + (1 - alpha) * signal;
    }
    signalCount += 1;
    signalLine.push(signalCount >= signalPeriod ? scaleIndicatorOutput(signal) : null);
  }
  const histogram: (number | null)[] = [];
  for (let i = 0; i < macdLine.length; i += 1) {
    const m = macdLine[i];
    const s = signalLine[i];
    if (m === null || s === null) {
      histogram.push(null);
    } else {
      histogram.push(m - s);
    }
  }
  return Object.freeze({
    macd: Object.freeze(macdLine),
    signal: Object.freeze(signalLine),
    histogram: Object.freeze(histogram),
  });
}
