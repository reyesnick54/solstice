import { minorToIndicatorPrice, scaleIndicatorOutput } from './rolling.ts';
import type { TechnicalOhlcvBar } from './types.ts';

export function computeObvSeries(bars: readonly TechnicalOhlcvBar[]): readonly (number | null)[] {
  const out: (number | null)[] = [];
  let obv = 0;
  let lastClose: number | null = null;
  for (const bar of bars) {
    const close = minorToIndicatorPrice(bar.closeMinor);
    const volume = Number(bar.volumeUnits);
    if (lastClose === null) {
      lastClose = close;
      out.push(scaleIndicatorOutput(0));
      continue;
    }
    if (close > lastClose) {
      obv += volume;
    } else if (close < lastClose) {
      obv -= volume;
    }
    lastClose = close;
    out.push(scaleIndicatorOutput(obv));
  }
  return Object.freeze(out);
}
