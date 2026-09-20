/**
 * M08 — OHLCV bar handling and 4h trend readiness assessment.
 */

import type { BarInterval, OhlcvBar } from '../../types.ts';
import type { WtiTrendReadiness } from './types.ts';

export const TREND_4H_MINIMUM_BARS = 10;

export function filterBarsByInterval(bars: readonly OhlcvBar[], interval: BarInterval): readonly OhlcvBar[] {
  return Object.freeze(bars.filter((bar) => bar.interval === interval));
}

export function assess4hTrendReadiness(bars: readonly OhlcvBar[]): WtiTrendReadiness {
  const bars4h = filterBarsByInterval(bars, '4h');
  const barCount = bars4h.length;
  const qualified = barCount >= TREND_4H_MINIMUM_BARS;
  const latest = bars4h[bars4h.length - 1];

  return Object.freeze({
    interval: '4h',
    qualified,
    barCount,
    minimumBarsRequired: TREND_4H_MINIMUM_BARS,
    latestBarCloseTime: latest?.barCloseTime ?? null,
    message: qualified
      ? null
      : `insufficient 4h bars for trend analysis: ${barCount}/${TREND_4H_MINIMUM_BARS}`,
  });
}

export function validateBarSequence(bars: readonly OhlcvBar[]): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1]!;
    const curr = bars[i]!;
    if (Date.parse(curr.barOpenTime) <= Date.parse(prev.barCloseTime)) {
      return Object.freeze({
        ok: false,
        message: `bar sequence overlap at index ${i}`,
      });
    }
  }
  return Object.freeze({ ok: true });
}
