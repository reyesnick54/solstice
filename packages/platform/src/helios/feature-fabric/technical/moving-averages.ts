import { RollingWindow, minorToIndicatorPrice, scaleIndicatorOutput } from './rolling.ts';
import type { PriceField, TechnicalOhlcvBar } from './types.ts';
import { barPriceMinor } from './types.ts';

export function computeSmaSeries(
  bars: readonly TechnicalOhlcvBar[],
  period: number,
  priceField: PriceField = 'close',
): readonly (number | null)[] {
  const window = new RollingWindow(period);
  const out: (number | null)[] = [];
  for (const bar of bars) {
    window.add(minorToIndicatorPrice(barPriceMinor(bar, priceField)));
    out.push(window.isFull ? scaleIndicatorOutput(window.average()) : null);
  }
  return Object.freeze(out);
}

export function computeEmaSeries(
  bars: readonly TechnicalOhlcvBar[],
  period: number,
  priceField: PriceField = 'close',
): readonly (number | null)[] {
  const alpha = 2 / (period + 1);
  const out: (number | null)[] = [];
  let value: number | null = null;
  let count = 0;
  for (const bar of bars) {
    const raw = minorToIndicatorPrice(barPriceMinor(bar, priceField));
    if (value === null) {
      value = raw;
    } else {
      value = alpha * raw + (1 - alpha) * value;
    }
    count += 1;
    out.push(count >= period ? scaleIndicatorOutput(value) : null);
  }
  return Object.freeze(out);
}

export function computeWmaSeries(
  bars: readonly TechnicalOhlcvBar[],
  period: number,
  priceField: PriceField = 'close',
): readonly (number | null)[] {
  const window = new RollingWindow(period);
  const weightSumFull = (period * (period + 1)) / 2;
  const out: (number | null)[] = [];
  for (const bar of bars) {
    window.add(minorToIndicatorPrice(barPriceMinor(bar, priceField)));
    if (!window.isFull) {
      const n = window.size;
      const denom = (n * (n + 1)) / 2;
      let weighted = 0;
      for (let i = 0; i < n; i += 1) {
        weighted += window.at(i) * (i + 1);
      }
      out.push(scaleIndicatorOutput(weighted / denom));
      continue;
    }
    let weighted = 0;
    for (let i = 0; i < period; i += 1) {
      weighted += window.at(i) * (i + 1);
    }
    out.push(scaleIndicatorOutput(weighted / weightSumFull));
  }
  return Object.freeze(out);
}
