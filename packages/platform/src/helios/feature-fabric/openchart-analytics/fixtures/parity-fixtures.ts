/**
 * Parity vectors from OpenChart upstream tests (MIT, longsurf-ai/openchart @ 8109466b).
 *
 * - common/timeseries/src/fromPoints.test.ts
 * - server/agent/tool/tools/tea-run.test.ts (ta.sma(close, 2))
 */

import type { OhlcvBar } from '../market/bar.ts';

export const OPENCHART_UPSTREAM_SHA = '8109466bfb5d44c32e0e03e9337eaca48b837ab4' as const;

/** fromPoints.test.ts — omitted numeric → NaN, explicit null → null */
export const FROM_POINTS_PARITY = Object.freeze({
  labels: Object.freeze({ symbol: 'AAPL' }),
  input: Object.freeze([
    { timeMs: 1, close: 10, final: false },
    { timeMs: 2, close: Number.NaN, note: 'b' },
    { timeMs: 3, close: null, final: true },
  ]),
  expectedClose: Object.freeze([10, Number.NaN, null]),
  expectedFinal: Object.freeze([false, null, true]),
  expectedNote: Object.freeze([null, 'b', null]),
});

/** tea-run.test.ts rows() default closes [10, 20, 30], ta.sma(close, 2) */
export const TEA_SMA_LENGTH2_CLOSES = Object.freeze([10, 20, 30]);

export const TEA_SMA_LENGTH2_EXPECTED = Object.freeze([Number.NaN, 15, 25]);

export function teaRunSampleBars(closes: readonly number[] = TEA_SMA_LENGTH2_CLOSES): readonly OhlcvBar[] {
  return Object.freeze(
    closes.map((close, index) =>
      Object.freeze({
        timeMs: (index + 1) * 60_000,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
        final: true,
      }),
    ),
  );
}

/** Windowed subset: tea-run.test.ts samples use full.slice(1) → first average NaN, second 25 */
export const TEA_SMA_WINDOWED_EXPECTED = Object.freeze([Number.NaN, 25]);
