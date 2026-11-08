/**
 * ALPHA07 — deterministic fixture observations for qualification tests.
 */

import { asUtcInstant } from '@solstice/domain';

import type { PredeclaredReturnBounds, SequentialObservation } from './types.ts';

export const ALPHA07_FIXTURE_REGISTERED_AT = asUtcInstant('2026-11-01T00:00:00.000Z');

export const ALPHA07_FIXTURE_BOUNDS: PredeclaredReturnBounds = Object.freeze({
  lowerBound: -0.05,
  upperBound: 0.05,
  registeredAt: ALPHA07_FIXTURE_REGISTERED_AT,
});

function fixtureHash01(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

/** Mild positive-mean fixture with weak serial dependence (bounded CS allowed, not IID). */
export const ALPHA07_FIXTURE_OBSERVATIONS: readonly SequentialObservation[] = Object.freeze(
  Array.from({ length: 32 }, (_, i) => {
    const activeReturn = 0.0008 + (fixtureHash01(i) - 0.5) * 0.005;
    return Object.freeze({
      at: asUtcInstant(`2026-11-01T12:${String(10 + (i % 50)).padStart(2, '0')}:00.000Z`),
      activeReturn,
      benchmarkReturn: 0.0004,
      lossDifferential: Math.max(0, -activeReturn),
      hit: activeReturn > 0,
      forecastScore: 0.55 + activeReturn * 10,
      benchmarkForecastScore: 0.52,
    });
  }),
);

/** Autocorrelated fixture — should route to block method, still inside bounds. */
export const ALPHA07_AUTOCORR_FIXTURE_OBSERVATIONS: readonly SequentialObservation[] = Object.freeze(
  (() => {
    const returns: number[] = [];
    let state = 0.001;
    for (let i = 0; i < 24; i += 1) {
      state = 0.85 * state + 0.002 * (i % 2 === 0 ? 1 : -1);
      returns.push(Math.max(-0.04, Math.min(0.04, state)));
    }
    return returns.map((activeReturn, i) =>
      Object.freeze({
        at: asUtcInstant(`2026-11-02T${String(10 + (i % 10)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`),
        activeReturn,
        benchmarkReturn: 0,
        hit: activeReturn > 0,
      }),
    );
  })(),
);
