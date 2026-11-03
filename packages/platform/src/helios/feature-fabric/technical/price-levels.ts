import { RollingWindow, minorToIndicatorPrice, scaleIndicatorOutput } from './rolling.ts';
import type { TechnicalOhlcvBar } from './types.ts';

export type DonchianSeries = {
  readonly upper: readonly (number | null)[];
  readonly middle: readonly (number | null)[];
  readonly lower: readonly (number | null)[];
};

export function computeDonchianSeries(
  bars: readonly TechnicalOhlcvBar[],
  period: number,
  excludeCurrent = false,
): DonchianSeries {
  const highWindow = new RollingWindow(period);
  const lowWindow = new RollingWindow(period);
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (const bar of bars) {
    const high = minorToIndicatorPrice(bar.highMinor);
    const low = minorToIndicatorPrice(bar.lowMinor);
    if (excludeCurrent && highWindow.isFull) {
      let maxHigh = highWindow.at(0);
      let minLow = lowWindow.at(0);
      for (let i = 1; i < highWindow.size; i += 1) {
        maxHigh = Math.max(maxHigh, highWindow.at(i));
        minLow = Math.min(minLow, lowWindow.at(i));
      }
      upper.push(scaleIndicatorOutput(maxHigh));
      lower.push(scaleIndicatorOutput(minLow));
      middle.push(scaleIndicatorOutput((maxHigh + minLow) / 2));
    } else {
      highWindow.add(high);
      lowWindow.add(low);
      if (!highWindow.isFull) {
        upper.push(null);
        middle.push(null);
        lower.push(null);
      } else {
        let maxHigh = highWindow.at(0);
        let minLow = lowWindow.at(0);
        for (let i = 1; i < period; i += 1) {
          maxHigh = Math.max(maxHigh, highWindow.at(i));
          minLow = Math.min(minLow, lowWindow.at(i));
        }
        upper.push(scaleIndicatorOutput(maxHigh));
        lower.push(scaleIndicatorOutput(minLow));
        middle.push(scaleIndicatorOutput((maxHigh + minLow) / 2));
      }
    }
    if (excludeCurrent) {
      highWindow.add(high);
      lowWindow.add(low);
    }
  }
  return Object.freeze({
    upper: Object.freeze(upper),
    middle: Object.freeze(middle),
    lower: Object.freeze(lower),
  });
}
