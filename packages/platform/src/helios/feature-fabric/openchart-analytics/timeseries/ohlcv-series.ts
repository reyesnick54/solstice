import type { OhlcvBar } from '../market/bar.ts';
import { isValidOhlcvBar } from '../market/bar.ts';

export type OhlcvSeries = {
  readonly instrumentId: string;
  readonly bars: readonly OhlcvBar[];
};

export function createOhlcvSeries(instrumentId: string, bars: readonly OhlcvBar[]): OhlcvSeries {
  const sorted = [...bars].sort((a, b) => a.timeMs - b.timeMs);
  for (const bar of sorted) {
    if (!isValidOhlcvBar(bar)) {
      throw new Error(`invalid OHLCV bar at ${bar.timeMs}`);
    }
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.timeMs <= sorted[i - 1]!.timeMs) {
      throw new Error('OhlcvSeries bars must be strictly ascending by time');
    }
  }
  return Object.freeze({ instrumentId, bars: Object.freeze(sorted) });
}

export function closeSeries(series: OhlcvSeries): readonly number[] {
  return series.bars.map((bar) => bar.close);
}
